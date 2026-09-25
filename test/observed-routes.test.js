import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { FetLifeService } from '../src/fetlife/service.js';
import { detectRoute } from '../src/fetlife/routes.js';

test('source-audited navigation surfaces expose stable route ownership', () => {
  const cases = [
    ['https://fetlife.com/settings/profile', 'settings', { section: 'profile' }],
    ['https://fetlife.com/bookmarks', 'feed', { view: 'bookmarks' }],
    [
      'https://fetlife.com/posts/new?source=Main+Navigation',
      'composer',
      { contentType: 'writings' },
    ],
    [
      'https://fetlife.com/pictures/new?source=Main+Navigation',
      'composer',
      { contentType: 'pictures' },
    ],
    ['https://fetlife.com/videos/new?source=Edit+Profile', 'composer', { contentType: 'videos' }],
    ['https://fetlife.com/requests', 'feed', { view: 'requests' }],
    [
      'https://fetlife.com/explore/following/commercial,pictures,posts,videos',
      'feed',
      { section: 'following', view: 'explore' },
    ],
    [
      'https://fetlife.com/explore/commercial,pictures,posts,videos',
      'feed',
      { section: 'popular', view: 'explore' },
    ],
    [
      'https://fetlife.com/explore/stuff-you-love',
      'feed',
      { section: 'stuff-you-love', view: 'explore' },
    ],
    ['https://fetlife.com/fetishes', 'feed', { section: 'all', view: 'fetishes' }],
    [
      'https://fetlife.com/fetishes/most_popular',
      'feed',
      { section: 'most-popular', view: 'fetishes' },
    ],
    ['https://fetlife.com/p', 'feed', { place: true, view: 'list' }],
    [
      'https://fetlife.com/p/example-country/example-region/example-city',
      'feed',
      { place: true, view: 'detail' },
    ],
  ];

  for (const [url, kind, params] of cases) {
    const route = detectRoute(url);
    assert.equal(route.kind, kind, url);
    assert.deepEqual(route.params, params, url);
  }
});

test('source-audited profile and content routes remain assigned to their entity owners', () => {
  assert.deepEqual(detectRoute('https://fetlife.com/ExamplePerson/l').params, {
    nickname: 'ExamplePerson',
    section: 'l',
  });
  assert.deepEqual(detectRoute('https://fetlife.com/ExamplePerson/posts').params, {
    nickname: 'ExamplePerson',
    section: 'posts',
  });
  assert.deepEqual(detectRoute('https://fetlife.com/ExamplePerson/videos').params, {
    nickname: 'ExamplePerson',
    section: 'videos',
  });
  assert.deepEqual(detectRoute('https://fetlife.com/ExamplePerson/pictures/501').params, {
    contentId: '501',
    contentType: 'pictures',
    ownerNickname: 'ExamplePerson',
  });
  assert.deepEqual(
    detectRoute('https://fetlife.com/p/example-country/example-region/example-city/kinksters'),
    {
      confidence: 'medium',
      kind: 'profile',
      params: { placeList: true, section: 'kinksters' },
      url: 'https://fetlife.com/p/example-country/example-region/example-city/kinksters',
    },
  );
});

test('the mixed Requests surface preserves event cards without assigning the page to Events', () => {
  const dom = new JSDOM(
    `<div data-controller="request-list">
      <div data-clickable-url-value="/events/2026/09/24/example-event">
        <a href="/events/2026/09/24/example-event"><h3>Example Event</h3></a>
      </div>
    </div>`,
    { url: 'https://fetlife.com/requests' },
  );
  const fetlife = new FetLifeService();
  const route = fetlife.detectRoute(dom.window.location.href);
  const candidate = fetlife.createCandidate(
    dom.window.document.querySelector('[data-clickable-url-value]'),
    route,
  );

  assert.equal(route.kind, 'feed');
  assert.deepEqual(route.params, { view: 'requests' });
  assert.equal(candidate.kind, 'event');
  assert.equal(candidate.parsed.identity.durable, true);
  assert.equal(candidate.parsed.metadata.mode, null);
  dom.window.close();
});
