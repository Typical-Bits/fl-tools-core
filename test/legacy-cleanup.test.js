import assert from 'node:assert/strict';
import test from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { StorageDatabase } from '../src/storage/database.js';
import { LegacyCleanup } from '../src/storage/legacy-cleanup.js';
import { isLegacyDynamicLocalKey } from '../src/storage/legacy-registry.js';

class MemoryStorage {
  #blocked = new Set();
  #items = new Map();
  constructor(blocked = []) {
    this.#blocked = new Set(blocked);
  }
  get length() {
    return this.#items.size;
  }
  key(index) {
    return [...this.#items.keys()][index] ?? null;
  }
  getItem(key) {
    return this.#items.get(key) ?? null;
  }
  setItem(key, value) {
    this.#items.set(key, String(value));
  }
  removeItem(key) {
    if (this.#blocked.has(key)) throw new Error('blocked');
    this.#items.delete(key);
  }
}

test('legacy cleanup detects only registered exact keys and a constrained Vault namespace', async () => {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  localStorage.setItem('fl_nick_notes', 'private');
  localStorage.setItem('fl_unrelated_other_project', 'keep');
  const dynamic = `fl_tools_vault_records_profile_schedule_${encodeURIComponent('https://fetlife.com/example')}`;
  localStorage.setItem(dynamic, 'day');
  sessionStorage.setItem('fl_private_session', '1');
  sessionStorage.setItem('fl_unknown', 'keep');
  const database = new StorageDatabase({ indexedDB: new IDBFactory() });
  await database.open();
  const cleanup = new LegacyCleanup({
    database,
    idFactory: () => 'confirm-me',
    localStorage,
    sessionStorage,
  });
  const detection = cleanup.scan();
  assert.deepEqual(detection.local, ['fl_nick_notes', dynamic]);
  assert.deepEqual(detection.session, ['fl_private_session']);
  await assert.rejects(() => cleanup.confirmAndDelete('wrong'), /confirmation is required/);
  assert.equal(localStorage.getItem('fl_nick_notes'), 'private');
  const result = await cleanup.confirmAndDelete(detection.confirmationToken);
  assert.deepEqual(result, { deletedCount: 3, verified: true });
  assert.equal(localStorage.getItem('fl_unrelated_other_project'), 'keep');
  assert.equal(sessionStorage.getItem('fl_unknown'), 'keep');
  assert.equal((await database.get('meta', 'legacy-cleanup')).status, 'complete');
  database.close();
});

test('dynamic Vault matching rejects broad or malformed prefixes', () => {
  assert.equal(isLegacyDynamicLocalKey('fl_tools_vault_records_anything'), false);
  assert.equal(isLegacyDynamicLocalKey('fl_tools_vault_records_profile_schedule_bad'), false);
  assert.equal(
    isLegacyDynamicLocalKey(
      `fl_tools_vault_records_profile_schedule_${encodeURIComponent('https://example.com/user')}`,
    ),
    false,
  );
});

test('legacy cleanup reports blocked deletion and does not mark completion', async () => {
  const localStorage = new MemoryStorage(['fl_seen_today']);
  localStorage.setItem('fl_seen_today', '{}');
  const database = new StorageDatabase({ indexedDB: new IDBFactory() });
  await database.open();
  const cleanup = new LegacyCleanup({
    database,
    idFactory: () => 'confirm-blocked',
    localStorage,
  });
  const detection = cleanup.scan();
  await assert.rejects(
    () => cleanup.confirmAndDelete(detection.confirmationToken),
    (error) => error.code === 'STORAGE_LEGACY_CLEANUP_FAILED',
  );
  assert.equal(await database.get('meta', 'legacy-cleanup'), undefined);
  database.close();
});
