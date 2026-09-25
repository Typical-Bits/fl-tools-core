import assert from 'node:assert/strict';
import test from 'node:test';
import { ErrorBoundary } from '../src/runtime/error-boundary.js';
import { Lifecycle, LIFECYCLE_STATES } from '../src/runtime/lifecycle.js';

function createLifecycle(errors = []) {
  return new Lifecycle({
    contextFor: (component, signal) => ({ componentId: component.id, signal }),
    errorBoundary: new ErrorBoundary({ report: (record) => errors.push(record) }),
  });
}

test('Lifecycle initializes by dependency and destroys in reverse order', async () => {
  const calls = [];
  const lifecycle = createLifecycle();
  const components = [
    {
      dependencies: ['core.base'],
      destroy: () => calls.push('destroy-child'),
      id: 'core.child',
      init: ({ componentId }) => calls.push(`init-${componentId}`),
      owner: 'core',
    },
    {
      dependencies: [],
      destroy: () => calls.push('destroy-base'),
      id: 'core.base',
      init: ({ componentId }) => calls.push(`init-${componentId}`),
      owner: 'core',
    },
  ];

  await lifecycle.start(components);
  assert.equal(lifecycle.state, LIFECYCLE_STATES.ACTIVE);
  await lifecycle.stop();
  assert.equal(lifecycle.state, LIFECYCLE_STATES.STOPPED);
  assert.deepEqual(calls, ['init-core.base', 'init-core.child', 'destroy-child', 'destroy-base']);
});

test('Lifecycle rolls back initialized components after a startup failure', async () => {
  const calls = [];
  const lifecycle = createLifecycle();
  const components = [
    {
      dependencies: [],
      destroy: () => calls.push('rollback-base'),
      id: 'core.base',
      init: () => calls.push('init-base'),
      owner: 'core',
    },
    {
      dependencies: ['core.base'],
      id: 'core.failure',
      init: () => {
        throw new Error('startup failed');
      },
      owner: 'core',
    },
  ];

  await assert.rejects(lifecycle.start(components), /initialization failed/);
  assert.equal(lifecycle.state, LIFECYCLE_STATES.FAILED);
  assert.deepEqual(calls, ['init-base', 'rollback-base']);
});

test('Lifecycle isolates teardown errors and continues cleanup', async () => {
  const errors = [];
  const calls = [];
  const lifecycle = createLifecycle(errors);
  await lifecycle.start([
    {
      dependencies: [],
      destroy: () => calls.push('base-clean'),
      id: 'core.base',
      owner: 'core',
    },
    {
      dependencies: ['core.base'],
      destroy: () => {
        throw new Error('teardown failed');
      },
      id: 'core.child',
      owner: 'core',
    },
  ]);

  await lifecycle.stop();
  assert.deepEqual(calls, ['base-clean']);
  assert.equal(errors[0].error.message, 'teardown failed');
});
