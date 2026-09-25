import assert from 'node:assert/strict';
import test from 'node:test';
import { RuntimeMetrics } from '../src/platform/runtime-metrics.js';

test('runtime metrics enforce budgets with bounded aggregate, privacy-safe signals', async () => {
  const metrics = new RuntimeMetrics({
    budgets: { queueDepth: 2, scannerBatchMs: 20, schedulerTaskMs: 50, storageUtilization: 0.8 },
    estimateStorage: async () => ({ quota: 100, usage: 90 }),
  });
  metrics.recordScheduler({ depth: 2, type: 'queue' });
  metrics.recordScheduler({ type: 'backpressure' });
  metrics.recordScheduler({ durationMs: 60, taskClass: 'scanner', type: 'task' });
  metrics.recordError('FEATURE_EXAMPLE_FAILED');
  metrics.recordError('FEATURE_EXAMPLE_FAILED');
  await metrics.refreshStorage();
  const snapshot = metrics.snapshot();
  assert.deepEqual(snapshot.queue, { current: 2, maximum: 2 });
  assert.equal(snapshot.scanner.slowBatches, 1);
  assert.equal(snapshot.scheduler.slowTasks, 1);
  assert.equal(snapshot.storage.utilization, 0.9);
  assert.deepEqual(snapshot.errors, [{ code: 'FEATURE_EXAMPLE_FAILED', count: 2 }]);
  assert.deepEqual(snapshot.violations, [
    'QUEUE_DEPTH',
    'SCHEDULER_TASK_DURATION',
    'SCANNER_BATCH_DURATION',
    'STORAGE_UTILIZATION',
    'SCHEDULER_BACKPRESSURE',
  ]);
  assert.doesNotMatch(JSON.stringify(snapshot), /https?:|cookie|profile/i);
});

test('unavailable storage estimates are non-fatal and expose no invented values', async () => {
  const metrics = new RuntimeMetrics({
    estimateStorage: async () => {
      throw new Error('not available');
    },
  });
  await metrics.refreshStorage();
  assert.deepEqual(metrics.snapshot().storage, {
    available: false,
    quota: null,
    usage: null,
    utilization: null,
  });
});
