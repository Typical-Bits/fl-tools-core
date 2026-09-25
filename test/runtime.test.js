import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import { CoreRuntime } from '../src/runtime/core-runtime.js';
import { installCore } from '../src/runtime/install-global.js';
import { MockBroadcastHub } from './helpers/mock-broadcast-channel.js';

function runtimeOptions(overrides = {}) {
  const hub = new MockBroadcastHub();
  let sequence = 0;
  return {
    accountId: 'account-1',
    channelFactory: hub.create,
    idFactory: () => `id-${++sequence}`,
    version: '3.0.0',
    ...overrides,
  };
}

function basicManifest(overrides = {}) {
  return {
    channel: 'development',
    coreCompatibility: '^3.0.0',
    features: ['basic.filters'],
    id: 'basic',
    name: 'FL Tools Basic',
    permissions: ['events'],
    type: 'edition',
    version: '3.0.0',
    ...overrides,
  };
}

test('CoreRuntime registers a compatible product and enforces component ownership', async () => {
  const runtime = new CoreRuntime(runtimeOptions());
  await runtime.start();

  const result = runtime.registerProduct({
    features: [{ id: 'basic.filters', owner: 'basic', permissions: ['events'] }],
    manifest: basicManifest(),
  });
  assert.deepEqual(result, {
    coreVersion: '3.0.0',
    productId: 'basic',
    status: 'REGISTERED',
  });
  assert.equal(result.capabilities.events, runtime.services.events);
  assert.equal(result.capabilities.storage, undefined);
  assert.equal(Object.keys(result).includes('capabilities'), false);
  assert.deepEqual(runtime.getStatus().products, [{ id: 'basic', version: '3.0.0' }]);
  const diagnosticContext = runtime.services.diagnostics.report().context;
  assert.equal(diagnosticContext.runtime.state, 'ACTIVE');
  assert.equal(diagnosticContext.runtime.identityState, 'SCOPED');
  assert.deepEqual(diagnosticContext.products, [
    {
      channel: 'development',
      declaredFeatures: ['basic.filters'],
      id: 'basic',
      name: 'FL Tools Basic',
      type: 'edition',
      version: '3.0.0',
    },
  ]);
  assert.deepEqual(diagnosticContext.components.features, [
    { id: 'basic.filters', owner: 'basic' },
  ]);
  await runtime.stop();
});

test('edition ownership capability is scoped to a declaring edition product', async () => {
  const runtime = new CoreRuntime(runtimeOptions());
  await runtime.start();
  const edition = runtime.registerProduct({
    manifest: basicManifest({ permissions: ['editionOwnership'] }),
  });
  const module = runtime.registerProduct({
    manifest: basicManifest({
      id: 'social',
      features: [],
      name: 'FL Tools Social',
      permissions: ['editionOwnership'],
      type: 'module',
    }),
  });
  assert.equal(typeof edition.capabilities.editionOwnership.claim, 'function');
  assert.equal(module.capabilities.editionOwnership, undefined);
  await runtime.stop();
});

test('account capability exposes only capture and stale-token assertion to declaring products', async () => {
  const runtime = new CoreRuntime(runtimeOptions());
  await runtime.start();
  const registration = runtime.registerProduct({
    manifest: basicManifest({ permissions: ['account'] }),
  });
  assert.deepEqual(Object.keys(registration.capabilities.account).sort(), [
    'assertCurrent',
    'capture',
  ]);
  const token = registration.capabilities.account.capture();
  registration.capabilities.account.assertCurrent(token);
  runtime.setAccountId('account-2');
  assert.throws(
    () => registration.capabilities.account.assertCurrent(token),
    (error) => error.code === 'STORAGE_ACCOUNT_STALE',
  );
  await runtime.stop();
});

test('action capability registers only owner-scoped commands and routes peer-safe metadata', async () => {
  const runtime = new CoreRuntime(runtimeOptions());
  await runtime.start();
  const registration = runtime.registerProduct({
    manifest: basicManifest({ permissions: ['actions'] }),
  });
  let opened = false;
  const unregister = registration.capabilities.actions.register({
    handler: () => {
      opened = true;
    },
    id: 'basic.browse',
    label: 'Open Browse',
  });
  assert.deepEqual(registration.capabilities.actions.list(), [
    { id: 'basic.browse', label: 'Open Browse', owner: 'basic' },
  ]);
  await registration.capabilities.actions.invoke('basic.browse');
  assert.equal(opened, true);
  assert.throws(
    () =>
      registration.capabilities.actions.register({
        handler() {},
        id: 'pro.people',
        label: 'Open People',
      }),
    /owner-scoped/,
  );
  unregister();
  await runtime.stop();
});

test('CoreRuntime rolls back an invalid product registration', async () => {
  const runtime = new CoreRuntime(runtimeOptions());
  await runtime.start();

  assert.throws(
    () =>
      runtime.registerProduct({
        features: [{ id: 'basic.filters', owner: 'pro', permissions: ['events'] }],
        manifest: basicManifest(),
      }),
    /owner must match/,
  );
  assert.deepEqual(runtime.getStatus().products, []);
  await runtime.stop();
});

test('CoreRuntime reports incompatible products through Diagnostics and Degraded Mode', async () => {
  const runtime = new CoreRuntime(runtimeOptions());
  await runtime.start();
  assert.throws(
    () => runtime.registerProduct({ manifest: basicManifest({ coreCompatibility: '^4.0.0' }) }),
    /incompatible/,
  );
  assert.equal(runtime.getStatus().health, 'DEGRADED');
  assert.equal(runtime.services.diagnostics.recent().at(-1).category, 'COMPATIBILITY');
  assert.equal(runtime.services.notifications.active().kind, 'DEGRADED_MODE');
  await runtime.stop();
});

test('product registration can expose a provider-neutral channel-safe update handle', async () => {
  const runtime = new CoreRuntime(runtimeOptions());
  await runtime.start();
  const registration = runtime.registerProduct({
    manifest: basicManifest({ channel: 'stable' }),
    updateProvider: {
      getLatest: () => ({
        channel: 'stable',
        summary: ['Platform UX improvements'],
        version: '3.1.0',
      }),
    },
  });
  assert.equal((await registration.checkForUpdates()).status, 'AVAILABLE');
  registration.recordInstalled({ summary: ['Platform UX improvements'], version: '3.1.0' });
  assert.equal(runtime.services.updates.whatsNew('basic').version, '3.1.0');
  await runtime.stop();
});

test('installCore publishes one immutable narrow surface and reuses it during races', async () => {
  const globalObject = {};
  const first = installCore(globalObject, runtimeOptions());
  const second = installCore(globalObject, runtimeOptions({ version: '3.1.0' }));

  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(second.surface, first.surface);
  assert.equal(globalObject.FLTools.version, '3.0.0');
  assert.deepEqual(Object.keys(globalObject.FLTools).sort(), [
    'getStatus',
    'registerProduct',
    'version',
    'whenReady',
  ]);
  assert.throws(() => {
    globalObject.FLTools = {};
  }, TypeError);

  await first.ready;
  assert.equal(typeof globalObject.FLTools.whenReady.then, 'function');
  assert.deepEqual(await globalObject.FLTools.whenReady, first.runtime.getStatus());
  const registration = await globalObject.FLTools.registerProduct({ manifest: basicManifest() });
  assert.equal(registration.status, 'REGISTERED');
  await first.runtime.stop();
});

test('installCore refuses an unrelated window.FLTools occupant', () => {
  assert.throws(() => installCore({ FLTools: {} }, runtimeOptions()), /unknown runtime/);
});

test('CoreRuntime derives and dynamically switches reliable account storage scope', async () => {
  const dom = new JSDOM(
    '<nav data-nav--ama-toggle-user-id-value="1"></nav><main role="feed"></main>',
    { url: 'https://fetlife.com/home' },
  );
  const runtime = new CoreRuntime(
    runtimeOptions({
      accountId: null,
      document: dom.window.document,
      indexedDB: new IDBFactory(),
      observerFactory: (callback) => new dom.window.MutationObserver(callback),
      window: dom.window,
    }),
  );
  await runtime.start();
  assert.equal(runtime.getStatus().storage, 'READY');
  assert.equal(runtime.services.account.accountId, '1');
  assert.ok(runtime.services.ui);
  assert.ok(dom.window.document.getElementById('flt-core-theme'));
  const previousSignal = runtime.services.account.signal;
  dom.window.document.querySelector('nav').setAttribute('data-nav--ama-toggle-user-id-value', '2');
  await delay(0);
  assert.equal(previousSignal.aborted, true);
  assert.equal(runtime.services.account.accountId, '2');
  await runtime.stop();
  assert.equal(dom.window.document.getElementById('flt-core-theme'), null);
});

test('CoreRuntime remounts chrome and emits one page:settled after Turbo navigation', async () => {
  const dom = new JSDOM(
    '<!doctype html><html><head></head><body><nav data-nav--ama-toggle-user-id-value="1"></nav><main role="feed"></main></body></html>',
    { url: 'https://fetlife.com/home' },
  );
  const runtime = new CoreRuntime(
    runtimeOptions({
      document: dom.window.document,
      indexedDB: new IDBFactory(),
      observerFactory: (callback) => new dom.window.MutationObserver(callback),
      window: dom.window,
    }),
  );
  await runtime.start();
  const settled = [];
  runtime.services.events.on('page:settled', (payload) => settled.push(payload.url));
  dom.window.document.getElementById('flt-core-theme').remove();
  dom.window.document.dispatchEvent(new dom.window.Event('turbo:load'));
  dom.window.dispatchEvent(new dom.window.Event('turbo:load'));
  await delay(0);
  assert.ok(dom.window.document.getElementById('flt-core-theme')?.isConnected);
  assert.deepEqual(settled, ['https://fetlife.com/home']);
  await runtime.stop();
  dom.window.close();
});

test('every product can inspect peers and rejected registrations appear as conflicts', async () => {
  const runtime = new CoreRuntime(runtimeOptions());
  await runtime.start();
  const basic = runtime.registerProduct({ manifest: basicManifest() });
  const pro = runtime.registerProduct({
    manifest: basicManifest({ id: 'pro', name: 'Pro', features: [] }),
  });
  const compass = runtime.registerProduct({
    manifest: basicManifest({ id: 'compass', name: 'Compass', type: 'module', features: [] }),
  });
  for (const registration of [basic, pro, compass]) {
    assert.deepEqual(
      registration.capabilities.products.snapshot().plugins.map((p) => p.id),
      ['core', 'basic', 'pro', 'compass'],
    );
  }
  assert.throws(() => runtime.registerProduct({ manifest: basicManifest() }));
  assert.throws(() =>
    runtime.registerProduct({
      manifest: basicManifest({ id: 'future', coreCompatibility: '^99.0.0' }),
    }),
  );
  const report = runtime.services.diagnostics.report({ detailed: true });
  assert.equal(report.conflicts.length, 2);
  assert.equal(report.conflicts[0].productId, 'basic');
  assert.equal(report.plugins.find((p) => p.id === 'compass').status, 'REGISTERED');
  await runtime.stop();
});
