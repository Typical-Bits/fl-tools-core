import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { EventBus } from '../src/events/event-bus.js';
import { FetLifeService } from '../src/fetlife/service.js';
import { Scheduler } from '../src/scheduler/scheduler.js';
import { Scanner } from '../src/scanner/scanner.js';
import { loadFixture } from './helpers/fixture.js';

test('Scanner owns one observer, batches candidates, deduplicates, and detects changes', async () => {
  const dom = await loadFixture('feed', 'https://fetlife.com/activity');
  const fetlife = new FetLifeService();
  const scheduler = new Scheduler({ autoStart: false });
  const eventBus = new EventBus();
  const routeController = new AbortController();
  let observerCount = 0;
  const scanner = new Scanner({
    eventBus,
    fetlife,
    observerFactory: (callback) => {
      observerCount += 1;
      return new dom.window.MutationObserver(callback);
    },
    scheduler,
  });
  const contentCandidates = [];
  scanner.subscribe(['content'], (candidate) => contentCandidates.push(candidate));
  scanner.start({
    root: dom.window.document,
    routeContext: {
      route: fetlife.detectRoute(dom.window.location.href),
      signal: routeController.signal,
    },
  });

  await scheduler.flush();
  assert.equal(observerCount, 1);
  assert.equal(contentCandidates.length, 1);
  assert.equal(contentCandidates[0].parsed.identity.key, 'content:id:501');

  scanner.scan(dom.window.document);
  await scheduler.flush();
  assert.equal(contentCandidates.length, 1);

  scanner.refresh(dom.window.document);
  await scheduler.flush();
  assert.equal(contentCandidates.length, 2);

  const title = dom.window.document.querySelector('[data-story-uid="StoryID:9001"] h2');
  title.textContent = 'Changed sanitized title';
  await delay(0);
  await scheduler.flush();
  assert.equal(contentCandidates.length, 3);
  scanner.stop();
});

test('Scanner dispatches low-confidence changed markup with unsafe actions disabled', async () => {
  const dom = await loadFixture('broken', 'https://fetlife.com/activity');
  const fetlife = new FetLifeService();
  const scheduler = new Scheduler({ autoStart: false });
  const scanner = new Scanner({
    eventBus: new EventBus(),
    fetlife,
    observerFactory: (callback) => new dom.window.MutationObserver(callback),
    scheduler,
  });
  const candidates = [];
  scanner.subscribe(['feed'], (candidate) => candidates.push(candidate));
  scanner.start({
    root: dom.window.document,
    routeContext: {
      route: fetlife.detectRoute(dom.window.location.href),
      signal: new AbortController().signal,
    },
  });

  await scheduler.flush();
  const changedMarkup = candidates.find(({ confidence }) => confidence === 'low');
  assert.ok(changedMarkup);
  assert.deepEqual(changedMarkup.safeFor, { destructive: false, durable: false });
  scanner.stop();
});

test('Scanner subscriptions and queued route work tear down safely', async () => {
  const dom = await loadFixture('feed', 'https://fetlife.com/activity');
  const fetlife = new FetLifeService();
  const scheduler = new Scheduler({ autoStart: false });
  const scanner = new Scanner({
    eventBus: new EventBus(),
    fetlife,
    observerFactory: (callback) => new dom.window.MutationObserver(callback),
    scheduler,
  });
  const subscription = new AbortController();
  const route = new AbortController();
  let calls = 0;
  scanner.subscribe(['content'], () => ++calls, { signal: subscription.signal });
  scanner.start({
    root: dom.window.document,
    routeContext: { route: fetlife.detectRoute(dom.window.location.href), signal: route.signal },
  });
  subscription.abort();
  route.abort('navigation');
  await scheduler.flush();
  assert.equal(calls, 0);
  scanner.stop();
});

test('Scanner ignores FL Tools-only child mutations inside native candidates', async () => {
  const dom = await loadFixture('feed', 'https://fetlife.com/activity');
  const fetlife = new FetLifeService();
  const scheduler = new Scheduler({ autoStart: false });
  const scanner = new Scanner({
    eventBus: new EventBus(),
    fetlife,
    observerFactory: (callback) => new dom.window.MutationObserver(callback),
    scheduler,
  });
  let calls = 0;
  scanner.subscribe(['content'], () => ++calls);
  scanner.start({
    root: dom.window.document,
    routeContext: {
      route: fetlife.detectRoute(dom.window.location.href),
      signal: new AbortController().signal,
    },
  });
  await scheduler.flush();
  assert.equal(calls, 1);

  const candidate = dom.window.document.querySelector('[data-story-uid="StoryID:9001"]');
  const owned = dom.window.document.createElement('span');
  owned.className = 'flt-root';
  owned.textContent = 'Tool status';
  candidate.append(owned);
  await delay(0);
  await scheduler.flush();
  assert.equal(calls, 1);

  owned.remove();
  await delay(0);
  await scheduler.flush();
  assert.equal(calls, 1);
  scanner.stop();
});

test('a new route initial scan is not lost behind cancelled old-route work', async () => {
  const dom = await loadFixture('feed', 'https://fetlife.com/activity');
  const fetlife = new FetLifeService();
  const scheduler = new Scheduler({ autoStart: false });
  const scanner = new Scanner({
    eventBus: new EventBus(),
    fetlife,
    observerFactory: (callback) => new dom.window.MutationObserver(callback),
    scheduler,
  });
  const candidates = [];
  const oldRoute = new AbortController();
  scanner.subscribe(['content'], (candidate) => candidates.push(candidate));
  scanner.start({
    root: dom.window.document,
    routeContext: { route: fetlife.detectRoute(dom.window.location.href), signal: oldRoute.signal },
  });
  oldRoute.abort('navigation');
  const newRoute = new AbortController();
  scanner.setRoute({
    route: fetlife.detectRoute('https://fetlife.com/groups/301'),
    signal: newRoute.signal,
  });

  await scheduler.flush();
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].context.route.kind, 'group');
  scanner.stop();
});
