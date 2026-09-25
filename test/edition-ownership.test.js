import assert from 'node:assert/strict';
import test from 'node:test';
import { EditionOwnership } from '../src/runtime/edition-ownership.js';

test('Basic owns Browse alone, Pro takes priority, and Basic resumes after Pro releases', async () => {
  const calls = [];
  const ownership = new EditionOwnership();
  const basic = ownership.claim('basic', {
    activate: () => calls.push('basic:on'),
    deactivate: () => calls.push('basic:off'),
  });
  await basic.ready;
  assert.deepEqual(ownership.snapshot(), { claimants: ['basic'], owner: 'basic' });
  const pro = ownership.claim('pro', {
    activate: () => calls.push('pro:on'),
    deactivate: () => calls.push('pro:off'),
  });
  await pro.ready;
  assert.deepEqual(ownership.snapshot(), { claimants: ['basic', 'pro'], owner: 'pro' });
  await pro.release();
  assert.deepEqual(ownership.snapshot(), { claimants: ['basic'], owner: 'basic' });
  await basic.release();
  assert.deepEqual(ownership.snapshot(), { claimants: [], owner: null });
  assert.deepEqual(calls, ['basic:on', 'basic:off', 'pro:on', 'pro:off', 'basic:on', 'basic:off']);
});

test('failed higher-priority activation restores the usable lower-priority owner', async () => {
  const ownership = new EditionOwnership();
  const basic = ownership.claim('basic', {
    activate() {},
    deactivate() {},
  });
  await basic.ready;
  const pro = ownership.claim('pro', {
    activate() {
      throw new Error('Pro failed');
    },
    deactivate() {},
  });
  await assert.rejects(pro.ready, /Pro failed/);
  assert.deepEqual(ownership.snapshot(), { claimants: ['basic'], owner: 'basic' });
});

test('edition claims reject duplicates, unknown editions, and incomplete hooks', async () => {
  const ownership = new EditionOwnership();
  const claim = ownership.claim('basic', { activate() {}, deactivate() {} });
  await claim.ready;
  assert.throws(() => ownership.claim('basic', { activate() {}, deactivate() {} }), /already has/);
  assert.throws(
    () => ownership.claim('studio', { activate() {}, deactivate() {} }),
    /Unknown edition/,
  );
  assert.throws(() => ownership.claim('pro', { activate() {} }), /activate and deactivate/);
  await claim.release();
});
