import assert from 'node:assert/strict';
import test from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { StorageDatabase } from '../src/storage/database.js';
import { StorageLease } from '../src/storage/lease.js';

test('storage leases provide crash-safe expiry, takeover, fencing, and release', async () => {
  let now = 100;
  const database = new StorageDatabase({ indexedDB: new IDBFactory() });
  await database.open();
  const first = new StorageLease({
    clock: () => now,
    database,
    idFactory: () => 'fence-a',
    ownerId: 'tab-a',
  });
  const second = new StorageLease({
    clock: () => now,
    database,
    idFactory: () => 'fence-b',
    ownerId: 'tab-b',
  });
  const acquired = await first.acquire('watch-poll', 50);
  assert.equal(acquired.acquired, true);
  assert.equal((await second.acquire('watch-poll', 50)).acquired, false);
  assert.equal(await second.release('watch-poll', acquired.fencingToken), false);
  now = 151;
  const takeover = await second.acquire('watch-poll', 50);
  assert.equal(takeover.acquired, true);
  assert.equal(await first.renew('watch-poll', 50, acquired.fencingToken), false);
  assert.equal(await second.renew('watch-poll', 50, takeover.fencingToken), true);
  assert.equal(await second.release('watch-poll', takeover.fencingToken), true);
  database.close();
});
