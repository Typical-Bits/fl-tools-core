import { ContractError } from '../errors.js';

const EDITION_PRIORITY = Object.freeze({ basic: 1, pro: 2 });

function validateHooks(editionId, hooks) {
  if (!(editionId in EDITION_PRIORITY)) {
    throw new ContractError('Unknown edition ownership claimant', { editionId });
  }
  if (typeof hooks?.activate !== 'function' || typeof hooks?.deactivate !== 'function') {
    throw new ContractError('Edition ownership requires activate and deactivate hooks', {
      editionId,
    });
  }
}

/** Serializes shared Browse ownership so Pro can replace Basic without duplicate execution. */
export class EditionOwnership {
  #claims = new Map();
  #onChange;
  #owner = null;
  #queue = Promise.resolve();

  constructor({ onChange } = {}) {
    this.#onChange = onChange;
  }

  claim(editionId, hooks) {
    validateHooks(editionId, hooks);
    if (this.#claims.has(editionId)) {
      throw new ContractError('Edition already has an ownership claim', { editionId });
    }
    const claim = { ...hooks, editionId, released: false };
    this.#claims.set(editionId, claim);
    const ready = this.#reconcile();
    return Object.freeze({
      ready,
      release: async () => {
        if (claim.released) return this.snapshot();
        claim.released = true;
        await this.#reconcile();
        this.#claims.delete(editionId);
        return this.snapshot();
      },
      snapshot: () => this.snapshot(),
    });
  }

  snapshot() {
    return Object.freeze({
      claimants: Object.freeze(
        [...this.#claims.entries()]
          .filter(([, claim]) => !claim.released)
          .map(([editionId]) => editionId)
          .sort(),
      ),
      owner: this.#owner,
    });
  }

  async stop() {
    const claims = [...this.#claims.values()];
    this.#claims.clear();
    await this.#enqueue(async () => {
      const previousOwner = this.#owner;
      this.#owner = null;
      const previous = claims.find((claim) => claim.editionId === previousOwner);
      await previous?.deactivate({ nextOwner: null, previousOwner });
      this.#notify(previousOwner);
    });
  }

  #enqueue(operation) {
    const transition = this.#queue.catch(() => {}).then(operation);
    this.#queue = transition;
    return transition;
  }

  #nextOwner() {
    return (
      [...this.#claims.entries()]
        .filter(([, claim]) => !claim.released)
        .map(([editionId]) => editionId)
        .sort((left, right) => EDITION_PRIORITY[right] - EDITION_PRIORITY[left])[0] ?? null
    );
  }

  #notify(previousOwner) {
    this.#onChange?.(
      Object.freeze({
        ...this.snapshot(),
        previousOwner,
      }),
    );
  }

  #reconcile() {
    return this.#enqueue(async () => {
      const nextOwner = this.#nextOwner();
      if (nextOwner === this.#owner) return this.snapshot();
      const previousOwner = this.#owner;
      const previous = previousOwner ? this.#claims.get(previousOwner) : null;
      this.#owner = null;
      await previous?.deactivate({ nextOwner, previousOwner });
      const next = nextOwner ? this.#claims.get(nextOwner) : null;
      if (next) {
        try {
          await next.activate({ nextOwner, previousOwner });
          this.#owner = nextOwner;
        } catch (error) {
          next.released = true;
          this.#claims.delete(nextOwner);
          const fallbackOwner = this.#nextOwner();
          const fallback = fallbackOwner ? this.#claims.get(fallbackOwner) : null;
          await fallback?.activate({ nextOwner: fallbackOwner, previousOwner: nextOwner });
          this.#owner = fallbackOwner;
          this.#notify(previousOwner);
          throw error;
        }
      }
      this.#notify(previousOwner);
      return this.snapshot();
    });
  }
}
