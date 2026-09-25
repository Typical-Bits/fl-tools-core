import { ContractError } from '../errors.js';

export const HEALTH_STATES = Object.freeze({
  DEGRADED: 'DEGRADED',
  HEALTHY: 'HEALTHY',
  WARNING: 'WARNING',
});

export class HealthMonitor {
  #aborted = 0;
  #degradedReasons = new Set();
  #featureFailures = 0;
  #errorCodes = new Map();
  #listeners = new Set();
  #parserFailures = 0;
  #parserRuns = 0;
  #slowHandlers = 0;
  #state = HEALTH_STATES.HEALTHY;
  #storageErrors = 0;

  record({ kind, outcome = 'PASS', durationMs = 0, code = null } = {}) {
    if (!['ABORT', 'COMPATIBILITY', 'FEATURE', 'PARSER', 'STORAGE', 'TASK'].includes(kind)) {
      throw new ContractError('Unknown health signal', { kind });
    }
    if (kind === 'PARSER') {
      this.#parserRuns += 1;
      if (outcome === 'FAIL') this.#parserFailures += 1;
    }
    if (kind === 'FEATURE' && outcome === 'FAIL') this.#featureFailures += 1;
    if (kind === 'STORAGE' && outcome === 'FAIL') this.#storageErrors += 1;
    if (kind === 'ABORT' || outcome === 'ABORTED') this.#aborted += 1;
    if (outcome === 'FAIL' && code) {
      this.#errorCodes.set(code, (this.#errorCodes.get(code) ?? 0) + 1);
    }
    if (Number.isFinite(durationMs) && durationMs >= 250) this.#slowHandlers += 1;
    if (kind === 'COMPATIBILITY' && outcome === 'FAIL') {
      this.#degradedReasons.add(code ?? 'COMPATIBILITY_FAILURE');
    }
    if (this.#parserRuns >= 5 && this.#parserFailures / this.#parserRuns >= 0.5) {
      this.#degradedReasons.add('PARSER_FAILURE_RATE');
    }
    if (this.#storageErrors >= 3) this.#degradedReasons.add('REPEATED_STORAGE_FAILURE');
    if (this.#featureFailures >= 3) this.#degradedReasons.add('REPEATED_FEATURE_FAILURE');
    this.#recalculate();
    return this.snapshot();
  }

  enterDegraded(code) {
    if (!/^[A-Z][A-Z0-9_]{2,79}$/.test(code ?? '')) {
      throw new ContractError('Degraded Mode requires a stable reason code');
    }
    this.#degradedReasons.add(code);
    this.#recalculate();
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new ContractError('Health listener is required');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  snapshot() {
    return Object.freeze({
      abortedWork: this.#aborted,
      degraded: this.#state === HEALTH_STATES.DEGRADED,
      featureFailures: this.#featureFailures,
      parserFailureRate: this.#parserRuns ? this.#parserFailures / this.#parserRuns : 0,
      parserRuns: this.#parserRuns,
      reasons: Object.freeze([...this.#degradedReasons]),
      repeatedErrors: Object.freeze(
        [...this.#errorCodes.entries()]
          .filter(([, count]) => count >= 2)
          .map(([code, count]) => Object.freeze({ code, count })),
      ),
      slowHandlers: this.#slowHandlers,
      state: this.#state,
      storageErrors: this.#storageErrors,
    });
  }

  #recalculate() {
    const previous = this.#state;
    if (this.#degradedReasons.size > 0) this.#state = HEALTH_STATES.DEGRADED;
    else if (
      this.#featureFailures ||
      this.#parserFailures ||
      this.#storageErrors ||
      this.#slowHandlers
    )
      this.#state = HEALTH_STATES.WARNING;
    else this.#state = HEALTH_STATES.HEALTHY;
    if (previous !== this.#state) {
      const snapshot = this.snapshot();
      for (const listener of this.#listeners) listener(snapshot, previous);
    }
  }
}
