import assert from 'node:assert/strict';
import test from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { StorageDatabase } from '../src/storage/database.js';
import { STORE_NAMES } from '../src/storage/constants.js';
import { PREVIOUS_DATABASE_NAME } from '../src/storage/import-previous-database.js';

test('database rename copies every domain and account once and retains the recovery source', async () => {
  const indexedDB = new IDBFactory();
  const previous = new StorageDatabase({ indexedDB, name: PREVIOUS_DATABASE_NAME });
  await previous.open();
  for (const domain of STORE_NAMES) {
    for (const account of ['first', 'second']) {
      await previous.put(domain, { key: `${account}:record`, accountId: account, value: domain });
    }
  }
  const current = new StorageDatabase({ indexedDB });
  await current.open();
  assert.equal(current.name, 'FLTools');
  for (const domain of STORE_NAMES) {
    for (const account of ['first', 'second']) {
      assert.deepEqual(
        await current.get(domain, `${account}:record`),
        await previous.get(domain, `${account}:record`),
      );
    }
  }
  await current.delete('settings', 'first:record');
  await current.put('people', { key: 'second:record', value: 'updated' });
  current.close();
  await current.open();
  assert.equal(await current.get('settings', 'first:record'), undefined);
  assert.equal((await current.get('people', 'second:record')).value, 'updated');
  assert.ok(await previous.get('settings', 'first:record'));
  current.close();
  previous.close();
});

test('new installations do not create the previous database', async () => {
  const indexedDB = new IDBFactory();
  const database = new StorageDatabase({ indexedDB });
  await database.open();
  assert.deepEqual(
    (await indexedDB.databases()).map((db) => db.name),
    ['FLTools'],
  );
  database.close();
});

test('failed import rolls back all copied records and can retry', async () => {
  const indexedDB = new IDBFactory();
  const previous = new StorageDatabase({ indexedDB, name: PREVIOUS_DATABASE_NAME });
  await previous.open();
  await previous.put('settings', { key: 'a', value: 'same' });
  await previous.put('settings', { key: 'b', value: 'same' });
  const broken = new StorageDatabase({
    indexedDB,
    migration: ({ transaction }) => {
      transaction.objectStore('settings').createIndex('test-unique', 'value', { unique: true });
    },
  });
  await assert.rejects(broken.open(), /could not open/);
  const repaired = new StorageDatabase({
    indexedDB,
    version: 2,
    migration: ({ transaction }) => {
      const settings = transaction.objectStore('settings');
      settings.deleteIndex('test-unique');
      const cursor = settings.openCursor();
      cursor.onsuccess = () =>
        assert.equal(cursor.result, null, 'failed copy must leave no partial records');
    },
  });
  await repaired.open();
  assert.equal((await repaired.getAll('settings')).length, 2);
  repaired.close();
  previous.close();
});

test('unsupported previous schema is retained and import fails safely', async () => {
  const indexedDB = new IDBFactory();
  const previous = new StorageDatabase({ indexedDB, name: PREVIOUS_DATABASE_NAME, version: 2 });
  await previous.open();
  await previous.put('settings', { key: 'account:settings', value: 'keep' });
  const database = new StorageDatabase({ indexedDB });
  await assert.rejects(database.open(), /could not open/);
  assert.equal((await previous.get('settings', 'account:settings')).value, 'keep');
  previous.close();
});
