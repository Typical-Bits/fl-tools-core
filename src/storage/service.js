import { ContractError, StorageConflictError, StorageError } from '../errors.js';
import { ACCOUNT_STORES, BROWSE_SETTINGS_KEY, STORE_NAMES } from './constants.js';
import { isValidBrowseOverrides, mergeBrowseSettings, validateRecord } from './schema.js';

const PORTABLE_STORES = Object.freeze(['settings', 'people', 'history', 'watches']);
const MAX_PORTABLE_RECORDS = 10_000;

function portableSettingsKey(recordKey) {
  return recordKey === BROWSE_SETTINGS_KEY || recordKey.startsWith('pro.');
}

function defaultId() {
  return crypto.randomUUID();
}

export class CoreStorage {
  #accountScope;
  #beforeCommit;
  #clock;
  #crossTab;
  #database;
  #events;
  #idFactory;

  constructor({
    accountScope,
    database,
    beforeCommit,
    clock = Date.now,
    crossTab,
    events,
    idFactory = defaultId,
  }) {
    if (!accountScope || !database) throw new ContractError('Storage dependencies are required');
    this.#accountScope = accountScope;
    this.#beforeCommit = beforeCommit;
    this.#clock = clock;
    this.#crossTab = crossTab;
    this.#database = database;
    this.#events = events;
    this.#idFactory = idFactory;
  }

  async open() {
    await this.#database.open();
    return this;
  }

  close() {
    this.#database.close();
  }

  async get(storeName, recordKey) {
    const token = this.#token(storeName);
    const key = this.#key(storeName, recordKey, token);
    const record = await this.#database.get(storeName, key);
    if (!record) return undefined;
    if (!validateRecord(storeName, record)) {
      await this.#isolate(storeName, key, record, 'VALIDATION_FAILED');
      return undefined;
    }
    if (token) this.#accountScope.assertCurrent(token);
    return globalThis.structuredClone(record);
  }

  async list(storeName) {
    const token = this.#token(storeName);
    const records = await this.#database.getAll(storeName);
    const prefix = token ? `${token.accountId}:` : '';
    const valid = [];
    for (const record of records) {
      if (token && !record.key?.startsWith(prefix)) continue;
      if (validateRecord(storeName, record)) valid.push(globalThis.structuredClone(record));
      else await this.#isolate(storeName, record.key, record, 'VALIDATION_FAILED');
    }
    if (token) this.#accountScope.assertCurrent(token);
    return valid;
  }

  async put(storeName, recordKey, value, { expectedRevision } = {}) {
    this.#assertDomain(storeName);
    const token = this.#token(storeName);
    const key = this.#key(storeName, recordKey, token);
    const now = this.#clock();
    const result = await this.#database.atomic(storeName, async (store, request) => {
      const current = await request(store.get(key));
      if (expectedRevision !== undefined && (current?.revision ?? 0) !== expectedRevision) {
        throw new StorageConflictError('Stored record changed before this save', {
          actualRevision: current?.revision ?? 0,
          expectedRevision,
          recordKey,
          storeName,
        });
      }
      const record = {
        accountId: token?.accountId,
        key,
        recordKey,
        revision: (current?.revision ?? 0) + 1,
        schemaVersion: 1,
        updatedAt: now,
        value: globalThis.structuredClone(value),
      };
      if (!validateRecord(storeName, record)) {
        throw new StorageError('Record failed schema validation', {
          code: 'STORAGE_VALIDATION_FAILED',
          details: { recordKey, storeName },
        });
      }
      await this.#beforeCommit?.({ record, storeName, token });
      if (token) this.#accountScope.assertCurrent(token);
      await request(store.put(record));
      return record;
    });
    this.#publish(storeName, recordKey, result.revision, 'put');
    return globalThis.structuredClone(result);
  }

  async delete(storeName, recordKey, { expectedRevision } = {}) {
    this.#assertDomain(storeName);
    const token = this.#token(storeName);
    const key = this.#key(storeName, recordKey, token);
    await this.#database.atomic(storeName, async (store, request) => {
      const current = await request(store.get(key));
      if (expectedRevision !== undefined && (current?.revision ?? 0) !== expectedRevision) {
        throw new StorageConflictError('Stored record changed before this delete', {
          actualRevision: current?.revision ?? 0,
          expectedRevision,
          recordKey,
          storeName,
        });
      }
      await this.#beforeCommit?.({ operation: 'delete', storeName, token });
      if (token) this.#accountScope.assertCurrent(token);
      await request(store.delete(key));
    });
    this.#publish(storeName, recordKey, undefined, 'delete');
  }

  async getBrowseSettings() {
    const record = await this.get('settings', BROWSE_SETTINGS_KEY);
    return mergeBrowseSettings(record?.value);
  }

  async setBrowseSettings(overrides) {
    if (!isValidBrowseOverrides(overrides)) {
      throw new StorageError('Browse settings overrides are invalid', {
        code: 'STORAGE_VALIDATION_FAILED',
      });
    }
    return this.put('settings', BROWSE_SETTINGS_KEY, overrides);
  }

  async resetBrowseSettings() {
    await this.delete('settings', BROWSE_SETTINGS_KEY);
    return this.getBrowseSettings();
  }

  async appendHistory(value) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = this.#idFactory();
      try {
        await this.put('history', id, value, { expectedRevision: 0 });
        return id;
      } catch (error) {
        if (error?.code !== 'STORAGE_CONFLICT') throw error;
      }
    }
    throw new StorageError('Could not allocate a unique History record id', {
      code: 'STORAGE_ID_COLLISION',
    });
  }

  async saveWatchSnapshot(personId, snapshot, fingerprint) {
    if (!fingerprint || typeof fingerprint !== 'string') {
      throw new ContractError('Watch snapshot fingerprint is required');
    }
    const token = this.#accountScope.capture();
    const stateRecordKey = `state:${personId}`;
    const stateKey = this.#key('watches', stateRecordKey, token);
    const now = this.#clock();
    const result = await this.#database.atomic('watches', async (store, request) => {
      const current = await request(store.get(stateKey));
      if (current?.value.fingerprint === fingerprint) return { changed: false };
      const changeId = `change:${this.#idFactory()}`;
      const changeRecord = {
        accountId: token.accountId,
        key: this.#key('watches', changeId, token),
        recordKey: changeId,
        revision: 1,
        schemaVersion: 1,
        updatedAt: now,
        value: { fingerprint, observedAt: now, personId, snapshot },
      };
      if (await request(store.get(changeRecord.key))) {
        throw new StorageError('Watch change id collision', { code: 'STORAGE_ID_COLLISION' });
      }
      const stateRecord = {
        accountId: token.accountId,
        key: stateKey,
        recordKey: stateRecordKey,
        revision: (current?.revision ?? 0) + 1,
        schemaVersion: 1,
        updatedAt: now,
        value: { fingerprint, personId, snapshot },
      };
      await this.#beforeCommit?.({ record: stateRecord, storeName: 'watches', token });
      this.#accountScope.assertCurrent(token);
      await request(store.put(changeRecord));
      await request(store.put(stateRecord));
      return { changeId, changed: true, revision: stateRecord.revision };
    });
    if (result.changed) {
      this.#publish('watches', result.changeId, 1, 'put');
      this.#publish('watches', stateRecordKey, result.revision, 'put');
    }
    return Object.freeze({ changeId: result.changeId, changed: result.changed });
  }

  async replacePortableAccountData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new StorageError('Portable account data is invalid', {
        code: 'STORAGE_VALIDATION_FAILED',
      });
    }
    const token = this.#accountScope.capture();
    const now = this.#clock();
    const prepared = {};
    let total = 0;
    for (const storeName of PORTABLE_STORES) {
      const entries = data[storeName];
      if (!Array.isArray(entries)) {
        throw new StorageError('Portable account data is incomplete', {
          code: 'STORAGE_VALIDATION_FAILED',
        });
      }
      const seen = new Set();
      prepared[storeName] = entries.map((entry) => {
        if (
          !entry ||
          typeof entry !== 'object' ||
          Array.isArray(entry) ||
          typeof entry.recordKey !== 'string' ||
          entry.recordKey.length === 0 ||
          entry.recordKey.length > 500 ||
          seen.has(entry.recordKey) ||
          (storeName === 'settings' && !portableSettingsKey(entry.recordKey))
        ) {
          throw new StorageError('Portable record identity is invalid', {
            code: 'STORAGE_VALIDATION_FAILED',
          });
        }
        seen.add(entry.recordKey);
        const record = {
          accountId: token.accountId,
          key: `${token.accountId}:${entry.recordKey}`,
          recordKey: entry.recordKey,
          revision: 1,
          schemaVersion: 1,
          updatedAt: now,
          value: globalThis.structuredClone(entry.value),
        };
        if (!validateRecord(storeName, record)) {
          throw new StorageError('Portable record failed schema validation', {
            code: 'STORAGE_VALIDATION_FAILED',
          });
        }
        return record;
      });
      total += entries.length;
    }
    if (Object.keys(data).some((key) => !PORTABLE_STORES.includes(key))) {
      throw new StorageError('Portable account data contains an unknown domain', {
        code: 'STORAGE_VALIDATION_FAILED',
      });
    }
    if (total > MAX_PORTABLE_RECORDS) {
      throw new StorageError('Portable account data contains too many records', {
        code: 'STORAGE_IMPORT_TOO_LARGE',
      });
    }
    const changed = Object.fromEntries(PORTABLE_STORES.map((storeName) => [storeName, new Set()]));
    await this.#database.atomic(PORTABLE_STORES, async (stores, request) => {
      for (const storeName of PORTABLE_STORES) {
        const current = await request(stores[storeName].getAll());
        for (const record of current) {
          if (
            record.accountId === token.accountId &&
            (storeName !== 'settings' || portableSettingsKey(record.recordKey))
          ) {
            changed[storeName].add(record.recordKey);
            await request(stores[storeName].delete(record.key));
          }
        }
        for (const record of prepared[storeName]) {
          changed[storeName].add(record.recordKey);
          await this.#beforeCommit?.({ record, storeName, token });
          this.#accountScope.assertCurrent(token);
          await request(stores[storeName].put(record));
        }
      }
      this.#accountScope.assertCurrent(token);
    });
    for (const [storeName, keys] of Object.entries(changed)) {
      for (const recordKey of keys) this.#publish(storeName, recordKey, 1, 'replace');
    }
    return Object.freeze({ records: total, stores: Object.freeze([...PORTABLE_STORES]) });
  }

  async #isolate(storeName, key, record, reason) {
    const existing = (await this.#database.getAll('meta')).find(
      (entry) => entry.originalKey === key && entry.storeName === storeName,
    );
    const quarantineKey = existing?.key ?? `quarantine:${this.#idFactory()}`;
    await this.#database.put('meta', {
      key: quarantineKey,
      originalKey: key,
      rawRecord: record,
      reason,
      schemaVersion: 1,
      storeName,
      updatedAt: this.#clock(),
    });
    this.#events?.emit('storage:invalid-record', { key, quarantineKey, reason, storeName });
  }

  #token(storeName) {
    this.#assertDomain(storeName);
    return ACCOUNT_STORES.has(storeName) ? this.#accountScope.capture() : null;
  }

  #key(storeName, recordKey, token) {
    if (typeof recordKey !== 'string' || recordKey.length === 0) {
      throw new ContractError('Storage record key is required');
    }
    return ACCOUNT_STORES.has(storeName) ? `${token.accountId}:${recordKey}` : recordKey;
  }

  #assertDomain(storeName) {
    if (!STORE_NAMES.includes(storeName))
      throw new ContractError('Unknown storage domain', { storeName });
  }

  #publish(storeName, recordKey, revision, operation) {
    if (!this.#crossTab) return;
    this.#crossTab.publish(
      'storage-invalidated',
      { operation, recordKey, revision, storeName },
      { scope: storeName === 'meta' ? 'core' : 'account' },
    );
  }
}
