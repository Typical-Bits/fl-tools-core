import { ContractError } from '../errors.js';

/**
 * In-process event service with deterministic listener order and explicit teardown.
 */
export class EventBus {
  #listeners = new Map();
  #onListenerError;
  #destroyed = false;

  constructor({ onListenerError = () => {} } = {}) {
    if (typeof onListenerError !== 'function') {
      throw new ContractError('onListenerError must be a function');
    }
    this.#onListenerError = onListenerError;
  }

  on(type, listener, { signal, once = false } = {}) {
    this.#assertActive();
    if (typeof type !== 'string' || type.length === 0 || typeof listener !== 'function') {
      throw new ContractError('Event type and listener are required');
    }
    if (signal?.aborted) return () => {};

    const entry = { listener, once };
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(entry);
    this.#listeners.set(type, listeners);

    const off = () => {
      listeners.delete(entry);
      if (listeners.size === 0) this.#listeners.delete(type);
      signal?.removeEventListener('abort', off);
    };
    signal?.addEventListener('abort', off, { once: true });
    return off;
  }

  emit(type, payload) {
    this.#assertActive();
    const listeners = [...(this.#listeners.get(type) ?? [])];
    for (const entry of listeners) {
      if (entry.once) this.#listeners.get(type)?.delete(entry);
      try {
        entry.listener(payload);
      } catch (error) {
        this.#onListenerError(error, { type, payload });
      }
    }
    if (this.#listeners.get(type)?.size === 0) this.#listeners.delete(type);
    return listeners.length;
  }

  async emitAsync(type, payload) {
    this.#assertActive();
    const listeners = [...(this.#listeners.get(type) ?? [])];
    const results = [];
    for (const entry of listeners) {
      if (entry.once) this.#listeners.get(type)?.delete(entry);
      try {
        results.push(await entry.listener(payload));
      } catch (error) {
        this.#onListenerError(error, { type, payload });
        results.push(undefined);
      }
    }
    if (this.#listeners.get(type)?.size === 0) this.#listeners.delete(type);
    return results;
  }

  clear(type) {
    if (type === undefined) this.#listeners.clear();
    else this.#listeners.delete(type);
  }

  destroy() {
    this.clear();
    this.#destroyed = true;
  }

  #assertActive() {
    if (this.#destroyed) throw new ContractError('Event bus has been destroyed');
  }
}
