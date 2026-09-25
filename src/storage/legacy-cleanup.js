import { ContractError, StorageError } from '../errors.js';
import {
  isLegacyDynamicLocalKey,
  LEGACY_LOCAL_KEYS,
  LEGACY_SESSION_KEYS,
} from './legacy-registry.js';

function defaultId() {
  return crypto.randomUUID();
}

function keysIn(storage) {
  const keys = [];
  if (!storage) return keys;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
}

export class LegacyCleanup {
  #clock;
  #database;
  #detection;
  #idFactory;
  #localStorage;
  #sessionStorage;

  constructor({ database, localStorage, sessionStorage, clock = Date.now, idFactory = defaultId }) {
    if (!database) throw new ContractError('Legacy cleanup database is required');
    this.#database = database;
    this.#localStorage = localStorage;
    this.#sessionStorage = sessionStorage;
    this.#clock = clock;
    this.#idFactory = idFactory;
  }

  scan() {
    const localAllowed = new Set(LEGACY_LOCAL_KEYS);
    const sessionAllowed = new Set(LEGACY_SESSION_KEYS);
    const local = keysIn(this.#localStorage).filter(
      (key) => localAllowed.has(key) || isLegacyDynamicLocalKey(key),
    );
    const session = keysIn(this.#sessionStorage).filter((key) => sessionAllowed.has(key));
    const confirmationToken = this.#idFactory();
    this.#detection = Object.freeze({
      confirmationToken,
      found: local.length + session.length > 0,
      local: Object.freeze(local.sort()),
      session: Object.freeze(session.sort()),
    });
    return this.#detection;
  }

  async confirmAndDelete(confirmationToken) {
    if (!this.#detection || confirmationToken !== this.#detection.confirmationToken) {
      throw new ContractError('Explicit legacy cleanup confirmation is required');
    }
    const targets = this.#detection;
    for (const key of targets.local) {
      try {
        this.#localStorage?.removeItem(key);
      } catch {
        // Verification below converts blocked removal into one stable failure.
      }
    }
    for (const key of targets.session) {
      try {
        this.#sessionStorage?.removeItem(key);
      } catch {
        // Verification below converts blocked removal into one stable failure.
      }
    }
    const remaining = [
      ...targets.local.filter((key) => this.#stillExists(this.#localStorage, key)),
      ...targets.session.filter((key) => this.#stillExists(this.#sessionStorage, key)),
    ];
    if (remaining.length > 0) {
      throw new StorageError('Legacy cleanup could not be verified', {
        code: 'STORAGE_LEGACY_CLEANUP_FAILED',
        details: { remaining },
      });
    }
    await this.#database.put('meta', {
      deletedCount: targets.local.length + targets.session.length,
      key: 'legacy-cleanup',
      schemaVersion: 1,
      status: 'complete',
      updatedAt: this.#clock(),
    });
    this.#detection = undefined;
    return Object.freeze({
      deletedCount: targets.local.length + targets.session.length,
      verified: true,
    });
  }

  #stillExists(storage, key) {
    try {
      return storage?.getItem(key) !== null;
    } catch {
      return true;
    }
  }
}
