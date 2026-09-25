import assert from 'node:assert/strict';
import test from 'node:test';
import { ActionRegistry } from '../src/registries/action-registry.js';

test('ActionRegistry routes owner-scoped actions and exposes metadata without handlers', async () => {
  const actions = new ActionRegistry();
  let received;
  const unregister = actions.register({
    handler: (payload) => {
      received = payload;
      return 'opened';
    },
    id: 'basic.filters',
    label: 'Open Filters',
    owner: 'basic',
  });
  assert.deepEqual(actions.list(), [
    { id: 'basic.filters', label: 'Open Filters', owner: 'basic' },
  ]);
  assert.equal(await actions.invoke('basic.filters', { source: 'shortcut' }), 'opened');
  assert.deepEqual(received, { source: 'shortcut' });
  assert.throws(
    () => actions.register({ handler() {}, id: 'pro.people', label: 'People', owner: 'basic' }),
    /owner-scoped/,
  );
  assert.equal(unregister(), true);
  await assert.rejects(actions.invoke('basic.filters'), /Unknown action/);
});

test('ActionRegistry removes one product without disturbing peers', () => {
  const actions = new ActionRegistry();
  actions.register({ handler() {}, id: 'basic.filters', label: 'Filters', owner: 'basic' });
  actions.register({ handler() {}, id: 'vault.save', label: 'Save', owner: 'vault' });
  assert.equal(actions.removeOwner('basic'), 1);
  assert.deepEqual(actions.list(), [{ id: 'vault.save', label: 'Save', owner: 'vault' }]);
});
