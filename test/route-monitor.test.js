import assert from 'node:assert/strict';
import test from 'node:test';
import { FetLifeService } from '../src/fetlife/service.js';
import { RouteMonitor } from '../src/fetlife/route-monitor.js';
import { loadFixture } from './helpers/fixture.js';

test('RouteMonitor observes Turbo navigation that bypasses wrapped history', async () => {
  const dom = await loadFixture('feed', 'https://fetlife.com/activity');
  const changes = [];
  const originalPushState = dom.window.history.pushState;
  const monitor = new RouteMonitor({
    fetlife: new FetLifeService(),
    onChange: (current) => changes.push(current.route.kind),
    window: dom.window,
  });

  monitor.start();
  assert.notEqual(dom.window.history.pushState, originalPushState);
  dom.window.history.pushState = originalPushState;
  originalPushState.call(dom.window.history, {}, '', '/groups/301');
  assert.equal(monitor.context.route.kind, 'feed');
  dom.window.document.dispatchEvent(new dom.window.Event('turbo:load'));
  assert.equal(monitor.context.route.kind, 'group');
  assert.deepEqual(changes, ['feed', 'group']);
  monitor.stop();
});

test('RouteMonitor observes history navigation, aborts old work, and restores history', async () => {
  const dom = await loadFixture('feed', 'https://fetlife.com/activity');
  const changes = [];
  const originalPushState = dom.window.history.pushState;
  const monitor = new RouteMonitor({
    fetlife: new FetLifeService(),
    onChange: (current, previous) => changes.push({ current, previous }),
    window: dom.window,
  });

  const initial = monitor.start();
  assert.equal(initial.route.kind, 'feed');
  dom.window.history.pushState({}, '', '/groups/301');

  assert.equal(initial.signal.aborted, true);
  assert.equal(monitor.context.route.kind, 'group');
  assert.equal(changes.length, 2);
  monitor.stop();
  assert.equal(dom.window.history.pushState, originalPushState);
  assert.equal(monitor.context.signal.aborted, true);
});
