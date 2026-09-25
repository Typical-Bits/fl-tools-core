import assert from 'node:assert/strict';
import test from 'node:test';
import { EventBus } from '../src/events/event-bus.js';

test('EventBus preserves order, supports once, abort, and isolates listener errors', () => {
  const errors = [];
  const seen = [];
  const controller = new AbortController();
  const bus = new EventBus({ onListenerError: (error) => errors.push(error.message) });

  bus.on('change', () => seen.push('first'));
  bus.on('change', () => {
    throw new Error('isolated');
  });
  bus.on('change', () => seen.push('once'), { once: true });
  bus.on('change', () => seen.push('aborted'), { signal: controller.signal });
  controller.abort();

  assert.equal(bus.emit('change'), 3);
  assert.equal(bus.emit('change'), 2);
  assert.deepEqual(seen, ['first', 'once', 'first']);
  assert.deepEqual(errors, ['isolated', 'isolated']);
});

test('EventBus removes all listeners on destroy', () => {
  const bus = new EventBus();
  bus.on('event', () => {});
  bus.destroy();
  assert.throws(() => bus.emit('event'), /destroyed/);
});
