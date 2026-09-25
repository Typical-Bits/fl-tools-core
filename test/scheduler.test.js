import assert from 'node:assert/strict';
import test from 'node:test';
import { Scheduler } from '../src/scheduler/scheduler.js';

test('Scheduler orders work by priority, phase, and insertion', async () => {
  const scheduler = new Scheduler({ autoStart: false });
  const calls = [];
  const promises = [
    scheduler.schedule({ task: () => calls.push('background-read'), priority: 'BACKGROUND' }),
    scheduler.schedule({
      task: () => calls.push('visible-write'),
      phase: 'WRITE',
      priority: 'VISIBLE',
    }),
    scheduler.schedule({ task: () => calls.push('visible-read'), priority: 'VISIBLE' }),
    scheduler.schedule({ task: () => calls.push('interactive'), priority: 'INTERACTIVE' }),
  ];

  await scheduler.flush();
  await Promise.all(promises);
  assert.deepEqual(calls, ['interactive', 'visible-read', 'visible-write', 'background-read']);
});

test('Scheduler deduplicates keyed work', async () => {
  const scheduler = new Scheduler({ autoStart: false });
  let runs = 0;
  const first = scheduler.schedule({ key: 'scan:1', task: () => ++runs });
  const duplicate = scheduler.schedule({ key: 'scan:1', task: () => ++runs });

  assert.equal(first, duplicate);
  await scheduler.flush();
  assert.equal(await first, 1);
  assert.equal(runs, 1);
});

test('Scheduler enforces backpressure, cancellation, and abort', async () => {
  const scheduler = new Scheduler({ autoStart: false, maxQueued: 1 });
  const cancelled = scheduler.schedule({ key: 'cancel-me', task: () => 'never' });
  const cancelledAssertion = assert.rejects(cancelled, { name: 'AbortError' });
  await assert.rejects(scheduler.schedule({ task: () => 'overflow' }), /backpressure/);
  assert.equal(scheduler.cancel('cancel-me'), true);
  await cancelledAssertion;

  const controller = new AbortController();
  controller.abort('old route');
  await assert.rejects(scheduler.schedule({ signal: controller.signal, task: () => 'never' }), {
    name: 'AbortError',
  });
});

test('Scheduler releases queued tasks during teardown', async () => {
  const scheduler = new Scheduler({ autoStart: false });
  const pending = scheduler.schedule({ task: () => 'never' });
  const assertion = assert.rejects(pending, { name: 'AbortError' });
  scheduler.destroy();
  await assertion;
  assert.equal(scheduler.size, 0);
});

test('Scheduler reports privacy-safe queue, backpressure, and task timing metrics', async () => {
  let now = 0;
  const metrics = [];
  const scheduler = new Scheduler({
    autoStart: false,
    maxQueued: 1,
    metric: (metric) => metrics.push(metric),
    now: () => now,
  });
  const task = scheduler.schedule({
    key: 'core.scanner.flush',
    task: () => {
      now = 75;
    },
  });
  await assert.rejects(scheduler.schedule({ task: () => {} }), /backpressure/);
  await scheduler.flush();
  await task;
  assert.ok(metrics.some((metric) => metric.type === 'queue' && metric.depth === 1));
  assert.ok(metrics.some((metric) => metric.type === 'backpressure'));
  assert.ok(
    metrics.some(
      (metric) =>
        metric.type === 'task' && metric.taskClass === 'scanner' && metric.durationMs === 75,
    ),
  );
  assert.doesNotMatch(JSON.stringify(metrics), /core\.scanner\.flush/);
});
