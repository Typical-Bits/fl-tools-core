import { ContractError, SchedulerError } from '../errors.js';

export const PRIORITIES = Object.freeze({
  INTERACTIVE: 0,
  VISIBLE: 1,
  NORMAL: 2,
  BACKGROUND: 3,
  IDLE: 4,
});

const PHASES = Object.freeze({ READ: 0, WRITE: 1 });

function abortError(reason = 'Task aborted') {
  const error = new Error(String(reason));
  error.name = 'AbortError';
  return error;
}

/** Bounded, priority-aware scheduler with keyed deduplication and read/write phases. */
export class Scheduler {
  #autoStart;
  #destroyed = false;
  #flushPending = false;
  #inFlight = false;
  #maxQueued;
  #metric;
  #now;
  #queue = [];
  #sequence = 0;
  #tasksByKey = new Map();

  constructor({ maxQueued = 1000, autoStart = true, metric = () => {}, now = Date.now } = {}) {
    if (!Number.isInteger(maxQueued) || maxQueued < 1) {
      throw new ContractError('maxQueued must be a positive integer');
    }
    this.#maxQueued = maxQueued;
    this.#autoStart = autoStart;
    this.#metric = metric;
    this.#now = now;
  }

  get size() {
    return this.#queue.length;
  }

  schedule({ task, priority = 'NORMAL', phase = 'READ', key, signal } = {}) {
    if (this.#destroyed) return Promise.reject(new SchedulerError('Scheduler is destroyed'));
    if (typeof task !== 'function')
      return Promise.reject(new ContractError('Scheduled task is required'));
    if (!(priority in PRIORITIES)) return Promise.reject(new ContractError('Unknown priority'));
    if (!(phase in PHASES)) return Promise.reject(new ContractError('Unknown scheduler phase'));
    if (signal?.aborted) return Promise.reject(abortError(signal.reason));
    if (key !== undefined && this.#tasksByKey.has(key)) return this.#tasksByKey.get(key).promise;
    if (this.#queue.length >= this.#maxQueued) {
      this.#metric({ depth: this.#queue.length, type: 'backpressure' });
      return Promise.reject(
        new SchedulerError('Scheduler backpressure limit reached', { maxQueued: this.#maxQueued }),
      );
    }

    let resolve;
    let reject;
    const promise = new Promise((onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    });
    const entry = {
      key,
      phase,
      priority,
      promise,
      reject,
      resolve,
      sequence: this.#sequence++,
      signal,
      task,
    };
    this.#queue.push(entry);
    this.#metric({ depth: this.#queue.length, type: 'queue' });
    if (key !== undefined) this.#tasksByKey.set(key, entry);
    if (this.#autoStart) this.#requestFlush();
    return promise;
  }

  async flush() {
    if (this.#inFlight) return;
    this.#flushPending = false;
    this.#inFlight = true;
    try {
      while (this.#queue.length > 0 && !this.#destroyed) {
        const batch = this.#queue.splice(0).sort((left, right) => {
          return (
            PRIORITIES[left.priority] - PRIORITIES[right.priority] ||
            PHASES[left.phase] - PHASES[right.phase] ||
            left.sequence - right.sequence
          );
        });
        this.#metric({ depth: this.#queue.length, type: 'queue' });
        for (const entry of batch) await this.#run(entry);
        await Promise.resolve();
      }
    } finally {
      this.#inFlight = false;
      if (this.#queue.length > 0 && !this.#destroyed && this.#autoStart) this.#requestFlush();
    }
  }

  cancel(key, reason = 'Task cancelled') {
    const entry = this.#tasksByKey.get(key);
    if (!entry) return false;
    const index = this.#queue.indexOf(entry);
    if (index !== -1) this.#queue.splice(index, 1);
    this.#metric({ depth: this.#queue.length, type: 'queue' });
    this.#tasksByKey.delete(key);
    entry.reject(abortError(reason));
    return true;
  }

  destroy(reason = 'Scheduler destroyed') {
    this.#destroyed = true;
    for (const entry of this.#queue.splice(0)) {
      if (entry.key !== undefined) this.#tasksByKey.delete(entry.key);
      entry.reject(abortError(reason));
    }
    this.#metric({ depth: 0, type: 'queue' });
  }

  #requestFlush() {
    if (this.#flushPending || this.#inFlight) return;
    this.#flushPending = true;
    queueMicrotask(() => void this.flush());
  }

  async #run(entry) {
    if (entry.key !== undefined) this.#tasksByKey.delete(entry.key);
    if (entry.signal?.aborted) {
      entry.reject(abortError(entry.signal.reason));
      return;
    }
    const startedAt = this.#now();
    try {
      entry.resolve(await entry.task({ signal: entry.signal }));
    } catch (error) {
      entry.reject(error);
    } finally {
      this.#metric({
        durationMs: Math.max(0, this.#now() - startedAt),
        taskClass: entry.key === 'core.scanner.flush' ? 'scanner' : 'scheduled',
        type: 'task',
      });
    }
  }
}
