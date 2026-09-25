import { ContractError } from '../errors.js';

function defaultId() {
  return crypto.randomUUID();
}

export class StorageLease {
  #clock;
  #database;
  #idFactory;
  #ownerId;

  constructor({ database, clock = Date.now, idFactory = defaultId, ownerId = idFactory() }) {
    if (!database || typeof ownerId !== 'string')
      throw new ContractError('Lease dependencies are required');
    this.#database = database;
    this.#clock = clock;
    this.#idFactory = idFactory;
    this.#ownerId = ownerId;
  }

  async acquire(name, durationMs) {
    this.#assert(name, durationMs);
    const key = `lease:${name}`;
    const now = this.#clock();
    return this.#database.atomic('meta', async (store, request) => {
      const current = await request(store.get(key));
      if (current && current.ownerId !== this.#ownerId && current.expiresAt > now) {
        return Object.freeze({ acquired: false, expiresAt: current.expiresAt });
      }
      const lease = {
        expiresAt: now + durationMs,
        fencingToken: this.#idFactory(),
        key,
        ownerId: this.#ownerId,
        schemaVersion: 1,
        updatedAt: now,
      };
      await request(store.put(lease));
      return Object.freeze({ acquired: true, ...lease });
    });
  }

  async renew(name, durationMs, fencingToken) {
    this.#assert(name, durationMs);
    const key = `lease:${name}`;
    const now = this.#clock();
    return this.#database.atomic('meta', async (store, request) => {
      const current = await request(store.get(key));
      if (
        !current ||
        current.ownerId !== this.#ownerId ||
        current.fencingToken !== fencingToken ||
        current.expiresAt <= now
      ) {
        return false;
      }
      await request(store.put({ ...current, expiresAt: now + durationMs, updatedAt: now }));
      return true;
    });
  }

  async release(name, fencingToken) {
    const key = `lease:${name}`;
    return this.#database.atomic('meta', async (store, request) => {
      const current = await request(store.get(key));
      if (!current || current.ownerId !== this.#ownerId || current.fencingToken !== fencingToken) {
        return false;
      }
      await request(store.delete(key));
      return true;
    });
  }

  #assert(name, durationMs) {
    if (
      typeof name !== 'string' ||
      name.length === 0 ||
      !Number.isFinite(durationMs) ||
      durationMs <= 0
    ) {
      throw new ContractError('Lease name and positive duration are required');
    }
  }
}
