import assert from 'node:assert/strict';
import test from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import { AccountScope, deriveAccountIdentity } from '../src/storage/account-scope.js';
import { STORE_NAMES } from '../src/storage/constants.js';
import { StorageDatabase } from '../src/storage/database.js';
import { CoreStorage } from '../src/storage/service.js';

function setup({ accountId = 'account-1', beforeCommit } = {}) {
  const database = new StorageDatabase({ indexedDB: new IDBFactory() });
  const accountScope = new AccountScope({ accountId });
  let sequence = 0;
  const messages = [];
  const storage = new CoreStorage({
    accountScope,
    beforeCommit,
    crossTab: {
      publish(type, payload, options) {
        messages.push({ options, payload, type });
      },
    },
    database,
    idFactory: () => `record-${++sequence}`,
  });
  return { accountScope, database, messages, storage };
}

test('account identity requires one reliable numeric navigation identity', () => {
  const one = new JSDOM('<div data-nav--ama-toggle-user-id-value="4356621"></div>');
  const conflict = new JSDOM(
    '<div data-nav--ama-toggle-user-id-value="1"></div><div data-nav--ama-toggle-user-id-value="2"></div>',
  );
  assert.equal(deriveAccountIdentity(one.window.document), '4356621');
  assert.equal(deriveAccountIdentity(conflict.window.document), null);
  assert.equal(deriveAccountIdentity(new JSDOM('<main></main>').window.document), null);
});

test('StorageDatabase creates only the seven required logical stores', async () => {
  const { database } = setup();
  await database.open();
  const names = [];
  for (const name of STORE_NAMES) names.push(name);
  assert.deepEqual(names, ['meta', 'settings', 'people', 'history', 'watches', 'social', 'vault']);
  for (const name of names) {
    assert.deepEqual(
      await database.getAll(name),
      name === 'meta' ? [{ key: 'migration:unversioned-database', completed: true }] : [],
    );
  }
  database.close();
});

test('one Browse settings record is shared, validated, and reset by removing overrides', async () => {
  const { database, messages, storage } = setup();
  await storage.open();
  assert.deepEqual(await storage.getBrowseSettings(), {
    feed: {},
    filters: {},
    infiniteScroll: {},
    media: {},
    navigation: {},
    pageEnhancements: {},
    preset: null,
    presets: {},
    seen: {},
    softBlock: {},
    ui: {},
  });
  await storage.setBrowseSettings({
    feed: { focus: 'focused' },
    filters: { minimumAge: 30 },
    preset: 'nearby',
  });
  assert.equal((await storage.getBrowseSettings()).filters.minimumAge, 30);
  assert.equal((await storage.getBrowseSettings()).feed.focus, 'focused');
  assert.deepEqual(messages.at(-1).payload, {
    operation: 'put',
    recordKey: 'browse',
    revision: 1,
    storeName: 'settings',
  });
  await storage.resetBrowseSettings();
  assert.equal((await database.getAll('settings')).length, 0);
  assert.equal((await storage.getBrowseSettings()).preset, null);
  await assert.rejects(() => storage.setBrowseSettings({ unknown: true }), {
    code: 'STORAGE_VALIDATION_FAILED',
  });
  const malformed = {
    accountId: 'account-1',
    key: 'account-1:browse',
    recordKey: 'browse',
    revision: 1,
    schemaVersion: 1,
    updatedAt: 1,
    value: { unknown: true },
  };
  await database.put('settings', malformed);
  assert.equal((await storage.getBrowseSettings()).preset, null);
  assert.deepEqual(await database.get('settings', 'account-1:browse'), malformed);
  storage.close();
});

test('account stores are isolated and ambiguous identity prevents durable writes', async () => {
  const { accountScope, database, storage } = setup();
  await storage.open();
  await storage.put('people', '42', { note: 'A', personId: '42' });
  accountScope.set('account-2');
  assert.equal(await storage.get('people', '42'), undefined);
  await storage.put('people', '42', { note: 'B', personId: '42' });
  accountScope.set('account-1');
  assert.equal((await storage.get('people', '42')).value.note, 'A');
  accountScope.set(null);
  await assert.rejects(() => storage.put('people', '43', { personId: '43' }), {
    code: 'STORAGE_ACCOUNT_AMBIGUOUS',
  });
  assert.equal((await database.getAll('people')).length, 2);
  storage.close();
});

test('stale account work cannot commit after an account transition', async () => {
  let scope;
  const state = setup({
    beforeCommit: () => scope.set('account-2'),
  });
  scope = state.accountScope;
  await state.storage.open();
  await assert.rejects(
    () => state.storage.put('people', '42', { personId: '42' }),
    (error) => error.code === 'STORAGE_ACCOUNT_STALE',
  );
  assert.deepEqual(await state.database.getAll('people'), []);
  state.storage.close();
});

test('loss-sensitive writes enforce optimistic revisions while settings remain last-write-wins', async () => {
  const { storage } = setup();
  await storage.open();
  const first = await storage.put(
    'people',
    '42',
    { note: 'first', personId: '42' },
    { expectedRevision: 0 },
  );
  await storage.put(
    'people',
    '42',
    { note: 'second', personId: '42' },
    { expectedRevision: first.revision },
  );
  await assert.rejects(
    () => storage.put('people', '42', { note: 'stale', personId: '42' }, { expectedRevision: 1 }),
    (error) => error.code === 'STORAGE_CONFLICT',
  );
  await storage.setBrowseSettings({ preset: 'one' });
  await storage.setBrowseSettings({ preset: 'two' });
  assert.equal((await storage.getBrowseSettings()).preset, 'two');
  storage.close();
});

test('history IDs are collision-safe and identical watch snapshots are not retained', async () => {
  const { database, storage } = setup();
  await storage.open();
  const firstId = await storage.appendHistory({ personId: '42', visitedAt: 100 });
  const secondId = await storage.appendHistory({ personId: '42', visitedAt: 100 });
  assert.notEqual(firstId, secondId);
  assert.equal((await database.getAll('history')).length, 2);
  assert.equal((await storage.saveWatchSnapshot('42', { name: 'A' }, 'hash-a')).changed, true);
  assert.equal((await storage.saveWatchSnapshot('42', { name: 'A' }, 'hash-a')).changed, false);
  assert.equal((await database.getAll('watches')).length, 2);
  const [one, two] = await Promise.all([
    storage.saveWatchSnapshot('42', { name: 'B' }, 'hash-b'),
    storage.saveWatchSnapshot('42', { name: 'B' }, 'hash-b'),
  ]);
  assert.equal([one, two].filter((result) => result.changed).length, 1);
  assert.equal((await database.getAll('watches')).length, 3);
  storage.close();
});

test('Vault accepts catalog metadata and rejects physical content bytes', async () => {
  const { storage } = setup();
  await storage.open();
  const metadata = {
    acquisitionState: 'saved',
    contentId: '1',
    contentType: 'image',
    deduplicationState: 'unique',
    entityIdentity: { key: 'person:id:42' },
    metadata: { width: 100 },
    relativePath: 'profiles/1/image.jpg',
    savedAt: 100,
    sourceIdentity: { url: 'https://fetlife.com/users/42/pictures/1' },
  };
  await storage.put('vault', 'item-1', metadata);
  await assert.rejects(
    () =>
      storage.put('vault', 'item-2', {
        ...metadata,
        bytes: new Uint8Array([1]),
        contentId: '2',
        relativePath: 'profiles/2/image.jpg',
      }),
    (error) => error.code === 'STORAGE_VALIDATION_FAILED',
  );
  storage.close();
});

test('malformed records are preserved in place and copied to quarantine metadata', async () => {
  const { database, storage } = setup();
  await storage.open();
  const malformed = { key: 'account-1:42', recordKey: '42', schemaVersion: 1, updatedAt: 1 };
  await database.put('people', malformed);
  assert.equal(await storage.get('people', '42'), undefined);
  assert.deepEqual(await database.get('people', 'account-1:42'), malformed);
  const quarantines = (await database.getAll('meta')).filter((record) =>
    record.key.startsWith('quarantine:'),
  );
  assert.equal(quarantines.length, 1);
  assert.deepEqual(quarantines[0].rawRecord, malformed);
  await storage.get('people', '42');
  assert.equal(
    (await database.getAll('meta')).filter((record) => record.key.startsWith('quarantine:')).length,
    1,
  );
  storage.close();
});

test('compatible FL Tools data remains available after Core storage reinitialization', async () => {
  const factory = new IDBFactory();
  const firstDb = new StorageDatabase({ indexedDB: factory });
  const first = new CoreStorage({
    accountScope: new AccountScope({ accountId: 'a' }),
    database: firstDb,
  });
  await first.open();
  await first.put('people', '1', { personId: '1' });
  first.close();
  const secondDb = new StorageDatabase({ indexedDB: factory });
  const second = new CoreStorage({
    accountScope: new AccountScope({ accountId: 'a' }),
    database: secondDb,
  });
  await second.open();
  assert.equal((await second.get('people', '1')).value.personId, '1');
  second.close();
});

test('portable account replacement is validated, atomic, and account scoped', async () => {
  let rejectCommit = false;
  const { accountScope, database, messages, storage } = setup({
    beforeCommit: ({ record }) => {
      if (rejectCommit && record?.recordKey === 'new-person') throw new Error('blocked commit');
    },
  });
  await storage.open();
  await storage.put('settings', 'browse', { preset: 'old' });
  await storage.put('settings', 'pro.personalization', { palette: 'old' });
  await storage.put('settings', 'unrelated.module', { keep: true });
  await storage.put('people', 'old-person', { personId: 'old-person' });
  await storage.put('history', 'old-history', { personId: 'old-person', visitedAt: 1 });
  await storage.put('watches', 'old-watch', { personId: 'old-person' });
  accountScope.set('account-2');
  await storage.put('people', 'other-person', { personId: 'other-person' });
  accountScope.set('account-1');

  const result = await storage.replacePortableAccountData({
    history: [{ recordKey: 'new-history', value: { personId: 'new-person', visitedAt: 2 } }],
    people: [{ recordKey: 'new-person', value: { note: 'restored', personId: 'new-person' } }],
    settings: [
      { recordKey: 'browse', value: { preset: 'restored' } },
      { recordKey: 'pro.personalization', value: { palette: 'forest' } },
    ],
    watches: [{ recordKey: 'new-watch', value: { personId: 'new-person' } }],
  });

  assert.equal(result.records, 5);
  assert.equal(await storage.get('people', 'old-person'), undefined);
  assert.equal((await storage.get('people', 'new-person')).value.note, 'restored');
  assert.equal((await storage.get('settings', 'unrelated.module')).value.keep, true);
  assert.equal((await storage.getBrowseSettings()).preset, 'restored');
  accountScope.set('account-2');
  assert.equal((await storage.get('people', 'other-person')).value.personId, 'other-person');
  accountScope.set('account-1');
  assert.equal(
    messages.some(({ payload }) => payload.operation === 'replace'),
    true,
  );

  const before = await database.getAll('people');
  await assert.rejects(
    () =>
      storage.replacePortableAccountData({
        history: [],
        people: [{ recordKey: 'broken', value: {} }],
        settings: [],
        watches: [],
      }),
    (error) => error.code === 'STORAGE_VALIDATION_FAILED',
  );
  assert.deepEqual(await database.getAll('people'), before);

  rejectCommit = true;
  await assert.rejects(
    () =>
      storage.replacePortableAccountData({
        history: [],
        people: [{ recordKey: 'new-person', value: { personId: 'new-person' } }],
        settings: [],
        watches: [],
      }),
    /blocked commit/,
  );
  assert.deepEqual(await database.getAll('people'), before);
  storage.close();
});

test('newer schemas are reported and never rewritten', async () => {
  const factory = new IDBFactory();
  await new Promise((resolve, reject) => {
    const request = factory.open('FLTools', 2);
    request.onupgradeneeded = () => request.result.createObjectStore('future');
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
  const database = new StorageDatabase({ indexedDB: factory });
  await assert.rejects(
    () => database.open(),
    (error) => error.code === 'STORAGE_SCHEMA_TOO_NEW',
  );
  await new Promise((resolve, reject) => {
    const request = factory.open('FLTools');
    request.onsuccess = () => {
      assert.equal(request.result.version, 2);
      assert.equal(request.result.objectStoreNames.contains('future'), true);
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
});

test('a failed transactional upgrade leaves no half-created FL Tools database', async () => {
  const factory = new IDBFactory();
  const database = new StorageDatabase({
    indexedDB: factory,
    migration: () => {
      throw new Error('migration failed');
    },
  });
  await assert.rejects(
    () => database.open(),
    (error) => error.code === 'STORAGE_RECOVERY_REQUIRED',
  );
  await new Promise((resolve, reject) => {
    const request = factory.open('FLTools');
    request.onsuccess = () => {
      assert.equal(request.result.objectStoreNames.length, 0);
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
});
