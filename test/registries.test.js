import assert from 'node:assert/strict';
import test from 'node:test';
import { ComponentRegistry } from '../src/registries/component-registry.js';
import { ProductRegistry } from '../src/registries/product-registry.js';

test('ProductRegistry accepts compatible manifests and rejects incompatible Core ranges', () => {
  const registry = new ProductRegistry({ coreVersion: '3.2.0' });
  const base = {
    channel: 'stable',
    coreCompatibility: '^3.1.0',
    features: [],
    id: 'basic',
    name: 'FL Tools Basic',
    permissions: ['events'],
    type: 'edition',
    version: '3.0.0',
  };

  assert.equal(registry.register(base).id, 'basic');
  assert.throws(
    () => registry.register({ ...base, coreCompatibility: '^4.0.0', id: 'social', type: 'module' }),
    /incompatible/,
  );
  assert.throws(
    () => registry.register({ ...base, channel: 'nightly', id: 'vault', type: 'module' }),
    /channel/,
  );
});

test('ComponentRegistry validates uniqueness and dependencies before locking', () => {
  const registry = new ComponentRegistry('feature');
  registry.register({ id: 'basic.filters', owner: 'basic' });
  registry.register({
    dependencies: ['basic.filters'],
    id: 'basic.presets',
    owner: 'basic',
  });
  registry.lock();

  assert.deepEqual(
    registry.list({ owner: 'basic' }).map(({ id }) => id),
    ['basic.filters', 'basic.presets'],
  );
  assert.throws(() => registry.register({ id: 'basic.media', owner: 'basic' }), /locked/);
});

test('ComponentRegistry rejects missing dependencies', () => {
  const registry = new ComponentRegistry('module');
  registry.register({ dependencies: ['social.missing'], id: 'social.events', owner: 'social' });
  assert.throws(() => registry.lock(), /Missing module dependency/);
});
