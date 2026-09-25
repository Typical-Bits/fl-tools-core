import { ContractError } from '../errors.js';

/**
 * Isolates component failures and sends normalized records to a private sink.
 */
export class ErrorBoundary {
  #report;

  constructor({ report }) {
    if (typeof report !== 'function')
      throw new ContractError('Error boundary requires a report sink');
    this.#report = report;
  }

  capture(owner, operation, callback, fallback) {
    try {
      const result = callback();
      if (result && typeof result.then === 'function') {
        return result.catch((error) => this.#handle(error, owner, operation, fallback));
      }
      return result;
    } catch (error) {
      return this.#handle(error, owner, operation, fallback);
    }
  }

  #handle(error, owner, operation, fallback) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.#report({
      error: normalized,
      operation,
      owner,
      timestamp: Date.now(),
    });
    if (typeof fallback === 'function') return fallback(normalized);
    return fallback;
  }
}
