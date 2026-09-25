import assert from 'node:assert/strict';
import test from 'node:test';
import { CROSS_TAB_PROTOCOL, CrossTabCoordinator } from '../src/cross-tab/coordinator.js';
import { EventBus } from '../src/events/event-bus.js';
import { MockBroadcastHub } from './helpers/mock-broadcast-channel.js';

function idFactory(prefix) {
  let sequence = 0;
  return () => `${prefix}-${++sequence}`;
}

function coordinator(hub, accountId, prefix) {
  const eventBus = new EventBus();
  const instance = new CrossTabCoordinator({
    channelFactory: hub.create,
    eventBus,
    getAccountId: () => accountId.value,
    idFactory: idFactory(prefix),
  });
  instance.start();
  return { eventBus, instance };
}

test('CrossTabCoordinator delivers same-account messages exactly once', () => {
  const hub = new MockBroadcastHub();
  const account = { value: 'account-1' };
  const first = coordinator(hub, account, 'first');
  const second = coordinator(hub, account, 'second');
  const received = [];
  second.eventBus.on('cross-tab:settings', (message) => received.push(message));

  first.instance.publish('settings', { revision: 2 });
  assert.equal(received.length, 1);
  assert.deepEqual(received[0].payload, { revision: 2 });
  first.instance.stop();
  second.instance.stop();
});

test('CrossTabCoordinator blocks account leakage and ambiguous-account writes', () => {
  const hub = new MockBroadcastHub();
  const first = coordinator(hub, { value: 'account-1' }, 'first');
  const second = coordinator(hub, { value: 'account-2' }, 'second');
  const ambiguous = coordinator(hub, { value: null }, 'ambiguous');
  let received = 0;
  second.eventBus.on('cross-tab:private', () => ++received);

  first.instance.publish('private', { note: 'secret' });
  assert.equal(received, 0);
  assert.throws(() => ambiguous.instance.publish('private', {}), /unambiguous account/);
  first.instance.stop();
  second.instance.stop();
  ambiguous.instance.stop();
});

test('CrossTabCoordinator allows account-neutral Core messages', () => {
  const hub = new MockBroadcastHub();
  const first = coordinator(hub, { value: null }, 'first');
  const second = coordinator(hub, { value: null }, 'second');
  let received;
  second.eventBus.on('cross-tab:health', (message) => {
    received = message.payload;
  });

  first.instance.publish('health', { state: 'ready' }, { scope: 'core' });
  assert.deepEqual(received, { state: 'ready' });
  first.instance.stop();
  second.instance.stop();
});

test('CrossTabCoordinator rejects oversized and structurally unsafe messages', () => {
  const hub = new MockBroadcastHub();
  const receiver = coordinator(hub, { value: 'account-1' }, 'receiver');
  const attacker = hub.create('fl-tools-core');
  let received = 0;
  receiver.eventBus.on('cross-tab:settings', () => ++received);
  const envelope = {
    accountId: 'account-1',
    messageId: 'external-1',
    payload: { value: 'x'.repeat(16_001) },
    protocol: CROSS_TAB_PROTOCOL,
    scope: 'account',
    sourceId: 'external',
    type: 'settings',
  };
  attacker.postMessage(envelope);
  const unsafe = JSON.parse(JSON.stringify(envelope));
  unsafe.messageId = 'external-2';
  unsafe.payload = JSON.parse('{"__proto__":{"polluted":true}}');
  attacker.postMessage(unsafe);
  assert.equal(received, 0);
  assert.throws(
    () => receiver.instance.publish('settings', { value: 'x'.repeat(16_001) }),
    /small and structurally safe/,
  );
  attacker.close();
  receiver.instance.stop();
});
