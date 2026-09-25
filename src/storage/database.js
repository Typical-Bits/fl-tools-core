import { ContractError, StorageError } from '../errors.js';
import { DATABASE_NAME, DATABASE_VERSION, STORE_NAMES } from './constants.js';
import { importPreviousDatabase } from './import-previous-database.js';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener(
      'abort',
      () =>
        reject(
          transaction.error ?? new globalThis.DOMException('Transaction aborted', 'AbortError'),
        ),
      { once: true },
    );
    transaction.addEventListener('error', () => reject(transaction.error), { once: true });
  });
}

export class StorageDatabase {
  #database;
  #factory;
  #migration;
  #name;
  #version;

  constructor({
    indexedDB = globalThis.indexedDB,
    migration,
    name = DATABASE_NAME,
    version = DATABASE_VERSION,
  } = {}) {
    if (!indexedDB?.open) {
      throw new StorageError('IndexedDB is unavailable', { code: 'STORAGE_UNAVAILABLE' });
    }
    this.#factory = indexedDB;
    this.#migration = migration;
    this.#name = name;
    this.#version = version;
  }

  get name() {
    return this.#name;
  }

  async open() {
    if (this.#database) return this;
    const request = this.#factory.open(this.#name, this.#version);
    let upgradeError;
    request.addEventListener('upgradeneeded', (event) => {
      const transaction = request.transaction;
      try {
        for (const storeName of STORE_NAMES) {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName, { keyPath: 'key' });
          }
        }
        this.#migration?.({
          database: request.result,
          newVersion: event.newVersion,
          oldVersion: event.oldVersion,
          transaction,
        });
        for (const storeName of STORE_NAMES) {
          if (!request.result.objectStoreNames.contains(storeName)) {
            throw new Error(`Missing required store: ${storeName}`);
          }
        }
      } catch (error) {
        upgradeError = error;
        transaction.abort();
      }
    });
    try {
      this.#database = await requestResult(request);
      this.#database.addEventListener('versionchange', () => this.close());
      if (this.#name === DATABASE_NAME) await importPreviousDatabase(this.#factory, this);
      return this;
    } catch (error) {
      this.close();
      const tooNew = error?.name === 'VersionError';
      throw new StorageError(
        tooNew
          ? 'Stored schema is newer than this Core understands'
          : 'FL Tools storage could not open',
        {
          cause: upgradeError ?? error,
          code: tooNew ? 'STORAGE_SCHEMA_TOO_NEW' : 'STORAGE_RECOVERY_REQUIRED',
        },
      );
    }
  }

  close() {
    this.#database?.close();
    this.#database = undefined;
  }

  async get(storeName, key) {
    this.#assertStore(storeName);
    const transaction = this.#database.transaction(storeName, 'readonly');
    return requestResult(transaction.objectStore(storeName).get(key));
  }

  async getAll(storeName) {
    this.#assertStore(storeName);
    const transaction = this.#database.transaction(storeName, 'readonly');
    return requestResult(transaction.objectStore(storeName).getAll());
  }

  async put(storeName, record) {
    return this.atomic(storeName, async (store) => {
      await requestResult(store.put(record));
      return record;
    });
  }

  async delete(storeName, key) {
    return this.atomic(storeName, async (store) => {
      await requestResult(store.delete(key));
    });
  }

  async atomic(storeNames, operation) {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    for (const name of names) this.#assertStore(name);
    const transaction = this.#database.transaction(names, 'readwrite');
    const stores = Object.fromEntries(names.map((name) => [name, transaction.objectStore(name)]));
    try {
      const result = await operation(names.length === 1 ? stores[names[0]] : stores, requestResult);
      await transactionDone(transaction);
      return result;
    } catch (error) {
      if (transaction.readyState !== 'done') {
        try {
          transaction.abort();
        } catch {
          // The transaction may already have completed or aborted.
        }
      }
      throw error;
    }
  }

  #assertStore(storeName) {
    if (!this.#database) throw new ContractError('Storage database is not open');
    if (!STORE_NAMES.includes(storeName))
      throw new ContractError('Unknown storage domain', { storeName });
  }
}
