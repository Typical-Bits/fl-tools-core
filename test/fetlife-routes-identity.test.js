import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { ENTITY_TYPES, IdentityResolver } from '../src/fetlife/identity.js';
import { detectRoute } from '../src/fetlife/routes.js';

test('detectRoute recognizes supported FetLife route families and strips tracking data', () => {
  assert.deepEqual(detectRoute('https://fetlife.com/users/101?source=test'), {
    confidence: 'high',
    kind: 'profile',
    params: { personId: '101' },
    url: 'https://fetlife.com/users/101',
  });
  assert.equal(detectRoute('https://fetlife.com/groups/301/discussion').kind, 'group');
  assert.equal(detectRoute('https://fetlife.com/events/401').kind, 'event');
  assert.deepEqual(detectRoute('https://fetlife.com/ExamplePerson').params, {
    nickname: 'ExamplePerson',
  });
  assert.deepEqual(detectRoute('https://fetlife.com/ExamplePerson/pictures').params, {
    nickname: 'ExamplePerson',
    section: 'pictures',
  });
  assert.equal(detectRoute('https://fetlife.com/home').kind, 'feed');
  assert.equal(detectRoute('https://fetlife.com/writings').kind, 'feed');
  assert.deepEqual(
    detectRoute('https://fetlife.com/p/united-states/washington/seattle/kinksters'),
    {
      confidence: 'medium',
      kind: 'profile',
      params: { placeList: true, section: 'kinksters' },
      url: 'https://fetlife.com/p/united-states/washington/seattle/kinksters',
    },
  );
  assert.deepEqual(detectRoute('https://fetlife.com/followers').params, {
    relationshipList: true,
    section: 'followers',
  });
  assert.deepEqual(detectRoute('https://fetlife.com/ExamplePerson/followers').params, {
    nickname: 'ExamplePerson',
    section: 'followers',
  });
  assert.deepEqual(detectRoute('https://fetlife.com/groups?source=main_nav').params, {
    view: 'list',
  });
  assert.deepEqual(detectRoute('https://fetlife.com/events/near').params, { view: 'list' });
  assert.deepEqual(detectRoute('https://fetlife.com/events/400/401/example-event').params, {
    pathIds: ['400', '401'],
    view: 'detail',
  });
  assert.deepEqual(detectRoute('https://fetlife.com/users/101/pictures/501').params, {
    contentId: '501',
    contentType: 'pictures',
    ownerId: '101',
  });
  assert.deepEqual(detectRoute('https://fetlife.com/ExamplePerson/pictures/501').params, {
    contentId: '501',
    contentType: 'pictures',
    ownerNickname: 'ExamplePerson',
  });
  assert.equal(detectRoute('https://fetlife.com/activity').kind, 'feed');
  assert.equal(detectRoute('https://example.com/users/101').kind, 'unknown');
});

test('IdentityResolver follows ID, authoritative URL, approved fallback, transient order', () => {
  let sequence = 0;
  const resolver = new IdentityResolver({
    idFactory: () => `session-${++sequence}`,
    supportedFallbacks: { event: ['source-key'] },
  });
  const dom = new JSDOM('<article></article>');
  const element = dom.window.document.querySelector('article');

  const byId = resolver.resolve({
    canonicalUrl: 'https://fetlife.com/users/101',
    stableId: '101',
    type: ENTITY_TYPES.PERSON,
  });
  assert.equal(byId.key, 'person:id:101');
  assert.equal(byId.durable, true);

  const byCanonical = resolver.resolve({
    canonicalAuthority: true,
    canonicalUrl: 'https://fetlife.com/groups/stable-canonical-name',
    type: ENTITY_TYPES.GROUP,
  });
  assert.equal(byCanonical.strategy, 'url');

  const byFallback = resolver.resolve({
    fallback: { namespace: 'source-key', parts: ['venue-8', '2026-10-01'] },
    type: ENTITY_TYPES.EVENT,
  });
  assert.equal(byFallback.strategy, 'fallback');

  const transient = resolver.resolve({
    canonicalUrl: 'https://fetlife.com/users/nickname-only',
    element,
    type: ENTITY_TYPES.PERSON,
  });
  assert.equal(transient.durable, false);
  assert.equal(resolver.resolve({ element, type: ENTITY_TYPES.PERSON }), transient);
});

test('display-name changes do not alter stable identity', () => {
  const resolver = new IdentityResolver();
  const before = resolver.resolve({ stableId: '101', type: ENTITY_TYPES.PERSON });
  const after = resolver.resolve({ stableId: '101', type: ENTITY_TYPES.PERSON });
  assert.equal(before.key, after.key);
});
