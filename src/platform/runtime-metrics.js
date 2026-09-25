const DEFAULT_BUDGETS = Object.freeze({
  queueDepth: 250,
  scannerBatchMs: 50,
  schedulerTaskMs: 100,
  storageUtilization: 0.9,
});
const MAX_ERROR_CODES = 25;

export class RuntimeMetrics {
  #backpressure = 0;
  #budgets;
  #errorCodes = new Map();
  #estimateStorage;
  #maxQueueDepth = 0;
  #queueDepth = 0;
  #scanner = { batches: 0, maxDurationMs: 0, slowBatches: 0 };
  #scheduler = { maxDurationMs: 0, slowTasks: 0, tasks: 0 };
  #storage = { available: false, quota: null, usage: null, utilization: null };

  constructor({ budgets = {}, estimateStorage } = {}) {
    this.#budgets = Object.freeze({ ...DEFAULT_BUDGETS, ...budgets });
    this.#estimateStorage = estimateStorage;
  }

  recordScheduler(metric) {
    if (metric?.type === 'queue') {
      this.#queueDepth = Math.max(0, Number(metric.depth) || 0);
      this.#maxQueueDepth = Math.max(this.#maxQueueDepth, this.#queueDepth);
    } else if (metric?.type === 'backpressure') {
      this.#backpressure += 1;
    } else if (metric?.type === 'task') {
      const duration = Math.max(0, Number(metric.durationMs) || 0);
      this.#scheduler.tasks += 1;
      this.#scheduler.maxDurationMs = Math.max(this.#scheduler.maxDurationMs, duration);
      if (duration >= this.#budgets.schedulerTaskMs) this.#scheduler.slowTasks += 1;
      if (metric.taskClass === 'scanner') {
        this.#scanner.batches += 1;
        this.#scanner.maxDurationMs = Math.max(this.#scanner.maxDurationMs, duration);
        if (duration >= this.#budgets.scannerBatchMs) this.#scanner.slowBatches += 1;
      }
    }
    return this.snapshot();
  }

  recordError(code = 'UNKNOWN') {
    const safe = /^[A-Z][A-Z0-9_]{2,79}$/.test(code) ? code : 'UNKNOWN';
    this.#errorCodes.set(safe, (this.#errorCodes.get(safe) ?? 0) + 1);
    if (this.#errorCodes.size > MAX_ERROR_CODES) {
      const first = this.#errorCodes.keys().next().value;
      this.#errorCodes.delete(first);
    }
  }

  async refreshStorage() {
    if (typeof this.#estimateStorage !== 'function') return this.snapshot();
    try {
      const estimate = await this.#estimateStorage();
      const usage = Number.isFinite(estimate?.usage) ? estimate.usage : null;
      const quota = Number.isFinite(estimate?.quota) && estimate.quota > 0 ? estimate.quota : null;
      this.#storage = {
        available: usage !== null || quota !== null,
        quota,
        usage,
        utilization: usage !== null && quota !== null ? usage / quota : null,
      };
    } catch {
      this.#storage = { available: false, quota: null, usage: null, utilization: null };
    }
    return this.snapshot();
  }

  snapshot() {
    const violations = [];
    if (this.#maxQueueDepth >= this.#budgets.queueDepth) violations.push('QUEUE_DEPTH');
    if (this.#scheduler.slowTasks) violations.push('SCHEDULER_TASK_DURATION');
    if (this.#scanner.slowBatches) violations.push('SCANNER_BATCH_DURATION');
    if (
      this.#storage.utilization !== null &&
      this.#storage.utilization >= this.#budgets.storageUtilization
    ) {
      violations.push('STORAGE_UTILIZATION');
    }
    if (this.#backpressure) violations.push('SCHEDULER_BACKPRESSURE');
    return Object.freeze({
      backpressure: this.#backpressure,
      budgets: this.#budgets,
      errors: Object.freeze(
        [...this.#errorCodes.entries()]
          .map(([code, count]) => Object.freeze({ code, count }))
          .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code)),
      ),
      queue: Object.freeze({ current: this.#queueDepth, maximum: this.#maxQueueDepth }),
      scanner: Object.freeze({ ...this.#scanner }),
      scheduler: Object.freeze({ ...this.#scheduler }),
      storage: Object.freeze({ ...this.#storage }),
      violations: Object.freeze(violations),
    });
  }
}
