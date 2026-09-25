import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { DiagnosticsService } from '../src/platform/diagnostics.js';
import { HEALTH_STATES, HealthMonitor } from '../src/platform/health.js';
import { NotificationCenter } from '../src/platform/notifications.js';
import { UpdateManager } from '../src/platform/updates.js';
import { CoreUI } from '../src/ui/core-ui.js';

function platform() {
  const health = new HealthMonitor();
  const notifications = new NotificationCenter({ clock: () => 100 });
  const diagnostics = new DiagnosticsService({
    clock: () => 200,
    contextSnapshot: () => ({
      products: [{ id: 'basic', version: '3.0.0' }],
      route: { kind: 'feed', revision: 4 },
      runtime: { state: 'ACTIVE', storageState: 'READY' },
    }),
    healthSnapshot: () => health.snapshot(),
    limit: 2,
    version: '3.0.0',
  });
  const updates = new UpdateManager({ notifications });
  return { diagnostics, health, notifications, updates };
}

test('Diagnostics bounds records, runs self-tests, and redacts shareable details', async () => {
  const { diagnostics } = platform();
  diagnostics.record({
    category: 'NETWORK',
    code: 'NETWORK_TIMEOUT',
    details: {
      authorization: 'Bearer secret',
      attempts: 2,
      nested: { privatePath: 'C:\\Users\\Person\\private.txt' },
    },
    message: 'Request failed at https://fetlife.com/users/private',
    severity: 'WARN',
  });
  diagnostics.record({
    category: 'PARSER',
    code: 'PARSER_PROFILE_UNRECOGNIZED',
    message: 'Profile markup changed',
  });
  diagnostics.record({
    category: 'STORAGE',
    code: 'STORAGE_WRITE_FAILED',
    message: 'Write failed',
  });
  assert.equal(diagnostics.recent().length, 2);
  diagnostics.registerSelfTest({
    category: 'CORE_RUNTIME',
    id: 'core.ready',
    run: () => ({ message: 'Ready', result: 'PASS' }),
  });
  diagnostics.registerSelfTest({
    category: 'FEATURE',
    id: 'feature.failure',
    run: () => {
      throw new Error('Expected injected failure');
    },
  });
  const selfTests = await diagnostics.runSelfTests();
  assert.deepEqual(
    selfTests.map(({ result }) => result),
    ['PASS', 'FAIL'],
  );
  const report = diagnostics.report({ detailed: true, selfTests });
  assert.equal(report.counts.ERROR, 2);
  assert.equal(report.categoryCounts.STORAGE, 1);
  assert.equal(report.context.runtime.state, 'ACTIVE');
  assert.equal(report.context.route.kind, 'feed');
  assert.equal(report.retainedRecords, 2);
  assert.equal(report.schemaVersion, 3);
  assert.doesNotMatch(JSON.stringify(report), /fetlife\.com|private\.txt|Bearer secret/);
});

test('Health tracks warnings, normal aborts, and significant degraded conditions', () => {
  const health = new HealthMonitor();
  health.record({ kind: 'ABORT', outcome: 'ABORTED' });
  assert.equal(health.snapshot().state, HEALTH_STATES.HEALTHY);
  health.record({ durationMs: 300, kind: 'TASK' });
  assert.equal(health.snapshot().state, HEALTH_STATES.WARNING);
  const changes = [];
  health.subscribe((snapshot) => changes.push(snapshot.state));
  health.record({ code: 'MODULE_CORE_INCOMPATIBLE', kind: 'COMPATIBILITY', outcome: 'FAIL' });
  health.record({ code: 'MODULE_CORE_INCOMPATIBLE', kind: 'COMPATIBILITY', outcome: 'FAIL' });
  assert.equal(health.snapshot().state, HEALTH_STATES.DEGRADED);
  assert.deepEqual(health.snapshot().repeatedErrors, [
    { code: 'MODULE_CORE_INCOMPATIBLE', count: 2 },
  ]);
  assert.deepEqual(changes, ['DEGRADED']);
});

test('NotificationCenter shows one highest-priority message and preserves restrained ordering', () => {
  const notifications = new NotificationCenter({ clock: () => 100 });
  notifications.upsert({
    id: 'whats-new.basic',
    kind: 'POST_UPDATE',
    message: 'Basic was updated.',
    priority: 'LOW',
    title: "What's New",
  });
  notifications.upsert({
    id: 'compatibility.basic',
    kind: 'COMPATIBILITY',
    message: 'Basic cannot safely start.',
    priority: 'CRITICAL',
    title: 'Compatibility warning',
  });
  assert.equal(notifications.active().id, 'compatibility.basic');
  assert.equal(notifications.list().length, 2);
  notifications.dismiss('compatibility.basic');
  assert.equal(notifications.active().id, 'whats-new.basic');
});

test('UpdateManager keeps Stable and Beta separate and exposes only the destination summary', async () => {
  const { notifications, updates } = platform();
  let requested;
  updates.registerProduct({
    channel: 'stable',
    name: 'FL Tools Basic',
    productId: 'basic',
    provider: {
      getLatest(options) {
        requested = options;
        return { channel: 'stable', summary: ['Safer filtering'], version: '3.2.0' };
      },
      update() {},
    },
    version: '3.0.0',
  });
  const available = await updates.check('basic');
  assert.equal(requested.channel, 'stable');
  assert.equal(available.status, 'AVAILABLE');
  assert.deepEqual(notifications.active().bullets, ['Safer filtering']);
  assert.deepEqual(
    notifications.active().actions.map(({ label }) => label),
    ['Update', 'Later'],
  );
  notifications.active().actions[1].handler();
  assert.equal(notifications.active(), null);

  updates.recordInstalled({
    channel: 'stable',
    name: 'FL Tools Basic',
    productId: 'basic',
    summary: ['One relevant summary'],
    version: '3.2.0',
  });
  assert.deepEqual(updates.whatsNew('basic').summary, ['One relevant summary']);

  const isolated = new UpdateManager({ notifications: new NotificationCenter() });
  isolated.registerProduct({
    channel: 'stable',
    name: 'FL Tools Pro',
    productId: 'pro',
    provider: {
      getLatest: () => ({ channel: 'beta', summary: ['Beta only'], version: '3.1.0' }),
    },
    version: '3.0.0',
  });
  await assert.rejects(() => isolated.check('pro'), /crossed the selected release channel/);
});

test('CoreUI renders one accessible notification and privacy-redacted Diagnostics dialog', async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'https://fetlife.com/home',
  });
  const services = platform();
  let copiedText = '';
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    value: {
      async writeText(value) {
        copiedText = value;
      },
    },
  });
  services.diagnostics.record({
    category: 'NETWORK',
    code: 'NETWORK_TIMEOUT',
    details: { token: 'secret-token' },
    message: 'Timed out at https://fetlife.com/private',
    severity: 'WARN',
  });
  let sequence = 0;
  const ui = new CoreUI({
    ...services,
    document: dom.window.document,
    idFactory: () => `platform-${++sequence}`,
    version: '3.0.0',
  });
  ui.start();
  services.notifications.upsert({
    id: 'core.degraded',
    kind: 'DEGRADED_MODE',
    message: 'Riskier features are paused.',
    priority: 'HIGH',
    title: 'Degraded Mode',
  });
  const notice = dom.window.document.querySelector('.flt-notice');
  assert.equal(notice.getAttribute('role'), 'alert');
  assert.equal(dom.window.document.querySelectorAll('.flt-notice').length, 1);
  assert.match(
    dom.window.document.querySelector('[data-flt-live="assertive"]').textContent,
    /Degraded Mode/,
  );
  ui.notifications.setEnabled(false);
  assert.equal(dom.window.document.querySelector('.flt-notice'), null);
  services.notifications.upsert({
    id: 'core.compatibility',
    kind: 'COMPATIBILITY',
    message: 'A product needs attention.',
    priority: 'CRITICAL',
    title: 'Compatibility issue',
  });
  assert.equal(dom.window.document.querySelector('.flt-notice'), null);
  ui.notifications.setEnabled(true);
  assert.equal(
    dom.window.document.querySelector('.flt-notice-title').textContent,
    'Compatibility issue',
  );

  const container = dom.window.document.createElement('div');
  dom.window.document.body.append(container);
  await ui.mountDiagnostics(container);
  assert.doesNotMatch(container.textContent, /Nothing is sent automatically/);
  assert.match(container.querySelector('h3').dataset.fltTip, /Nothing is sent automatically/);
  const press = async (label) => {
    const button = [...container.querySelectorAll('button')].find(
      (item) => item.textContent === label,
    );
    assert.ok(button, label);
    button.click();
    while (button.disabled) await new Promise((resolve) => setTimeout(resolve, 0));
  };
  assert.equal(container.querySelector('.flt-report').hidden, true);
  await press('Show Diagnostics');
  assert.equal(container.querySelector('.flt-report').hidden, false);
  await press('Hide Diagnostics');
  assert.equal(container.querySelector('.flt-report').hidden, true);
  await press('Copy Diagnostics');
  const copiedReport = JSON.parse(copiedText);
  assert.equal(copiedReport.recent[0].code, 'NETWORK_TIMEOUT');
  assert.doesNotMatch(copiedText, /secret-token|fetlife\.com\/private/);
  services.diagnostics.record({ category: 'FEATURE', code: 'NEW_EVENT', message: 'New event' });
  await press('Copy Diagnostics');
  assert.equal(JSON.parse(copiedText).recent.length, 2, 'copy must take a fresh snapshot');
  let exported;
  let downloadName;
  dom.window.URL.createObjectURL = (blob) => {
    exported = blob;
    return 'blob:test';
  };
  dom.window.URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () {
    downloadName = this.download;
  };
  await press('Export JSON');
  assert.equal(exported.type, 'application/json');
  assert.match(downloadName, /^fl-tools-diagnostics-.*\.json$/);
  await press('Clear Activity Log');
  assert.equal(services.diagnostics.recent().length, 0);
  await press('Reset Session State');
  assert.equal(container.querySelector('[role="status"]').textContent, 'Session Reset');
  const opening = ui.openDiagnostics();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const dialog = dom.window.document.querySelector('.flt-dialog');
  assert.deepEqual(
    [...dialog.querySelectorAll('.flt-diagnostics-actions button')].map((b) => b.textContent),
    [...container.querySelectorAll('button')].map((b) => b.textContent),
  );
  dialog.querySelector('.flt-dialog-actions button').click();
  await opening;
  ui.stop();
  dom.window.close();
});

test('console capture is bounded, redacted, preserves forwarding and restores on stop', () => {
  const dom = new JSDOM('<body></body>');
  let forwarded = 0;
  const original = () => {
    forwarded++;
  };
  dom.window.console.warn = original;
  const diagnostics = new DiagnosticsService({ version: '0.0.2', limit: 2 });
  diagnostics.captureConsole(dom.window);
  diagnostics.captureConsole(dom.window);
  dom.window.console.warn('first');
  dom.window.console.warn('token=private https://example.com/private', { private: 'hidden' });
  dom.window.dispatchEvent(new dom.window.ErrorEvent('error', { message: 'failure' }));
  const report = diagnostics.report({ detailed: true });
  assert.equal(forwarded, 2);
  assert.equal(report.console.retained, 2);
  assert.doesNotMatch(JSON.stringify(report), /token=private|example.com|hidden/);
  assert.equal(report.console.records[1].text, 'failure');
  diagnostics.clearActivity();
  assert.equal(diagnostics.report().console.retained, 0);
  diagnostics.stopCapture();
  assert.equal(dom.window.console.warn, original);
  assert.equal(diagnostics.report().console.active, false);
  dom.window.close();
});
