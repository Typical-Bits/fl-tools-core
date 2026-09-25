import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { FetLifeService } from '../src/fetlife/service.js';
import { loadFixture } from './helpers/fixture.js';

let transientSequence = 0;

function service() {
  return new FetLifeService({ idFactory: () => `transient-${++transientSequence}` });
}

for (const fixture of [
  [
    'profile',
    'https://fetlife.com/ExamplePerson',
    '[data-test-id="profile-header"]',
    'person:url:https://fetlife.com/ExamplePerson',
    'Example Person',
    'high',
  ],
  [
    'group',
    'https://fetlife.com/groups',
    'h2 > a[href^="/groups/"]',
    'group:id:301',
    'Example Group',
    'medium',
  ],
  [
    'event',
    'https://fetlife.com/events/near',
    '[data-clickable-url-value]',
    'event:url:https://fetlife.com/events/400/401/example-event',
    'Example Event',
    'high',
  ],
]) {
  test(`parses sanitized ${fixture[0]} fixture with stable identity`, async () => {
    const dom = await loadFixture(fixture[0], fixture[1]);
    const fetlife = service();
    const route = fetlife.detectRoute(dom.window.location.href);
    const candidate = fetlife.createCandidate(dom.window.document.querySelector(fixture[2]), route);

    assert.equal(candidate.kind, fixture[0]);
    assert.equal(candidate.confidence, fixture[5]);
    assert.equal(candidate.parsed.identity.key, fixture[3]);
    assert.equal(candidate.parsed.displayName ?? candidate.parsed.title, fixture[4]);
    assert.deepEqual(candidate.safeFor, { destructive: false, durable: true });
  });
}

test('parses content identity, type, and author without inventing metadata', async () => {
  const dom = await loadFixture('content', 'https://fetlife.com/ExampleAuthor/posts/701');
  const fetlife = service();
  const route = fetlife.detectRoute(dom.window.location.href);
  const candidate = fetlife.createCandidate(dom.window.document.querySelector('article'), route);

  assert.equal(candidate.kind, 'content');
  assert.equal(candidate.parsed.identity.key, 'content:id:701');
  assert.equal(candidate.parsed.metadata.authorIdentity.key, 'person:id:102');
  assert.equal(candidate.parsed.metadata.contentType, 'writings');
  assert.equal(candidate.parsed.title, 'Example Writing');
});

test('changed markup degrades to a non-destructive low-confidence candidate', async () => {
  const dom = await loadFixture('broken', 'https://fetlife.com/activity');
  const fetlife = service();
  const route = fetlife.detectRoute(dom.window.location.href);
  const candidate = fetlife.createCandidate(dom.window.document.querySelector('article'), route);

  assert.equal(candidate.kind, 'feed');
  assert.equal(candidate.confidence, 'low');
  assert.deepEqual(candidate.safeFor, { destructive: false, durable: false });
});

test('feed fixture produces feed context and content candidates separately', async () => {
  const dom = await loadFixture('feed', 'https://fetlife.com/activity');
  const fetlife = service();
  const route = fetlife.detectRoute(dom.window.location.href);
  const feed = fetlife.createCandidate(dom.window.document.querySelector('[role="feed"]'), route);
  const content = fetlife.createCandidate(
    dom.window.document.querySelector('[data-story-uid="StoryID:9001"]'),
    route,
  );

  assert.equal(feed.kind, 'feed');
  assert.equal(feed.parsed.identity, null);
  assert.equal(content.kind, 'content');
  assert.equal(content.parsed.identity.key, 'content:id:501');
  assert.equal(content.parsed.metadata.feedActivityCategory, 'post');
  assert.equal(content.parsed.metadata.feedActivityType, 'pictures');
});

test('feed content classifies posts, conversations, reactions, and social activity conservatively', () => {
  const dom = new JSDOM(
    `
    <main>
      <article data-story-uid="StoryID:1" data-dwell-content-type="Picture">
        <a href="/Example/pictures/1">Picture</a>
      </article>
      <article data-story-uid="StoryID:2" data-feed-event="commented_on_profile_update">
        <header>Example commented on a profile update</header>
      </article>
      <article data-story-uid="StoryID:3" data-story-type="superloved_video">
        <header>Example superloved a video</header>
      </article>
      <article data-story-uid="StoryID:4">
        <header>Example started following Another Person</header>
      </article>
      <article data-story-uid="StoryID:5">
        <header>Unrecognized native activity</header>
      </article>
      <article data-story-uid="StoryID:6" data-dwell-content-type="Picture">
        <header>Example loved Another Person's picture</header>
      </article>
    </main>
  `,
    { url: 'https://fetlife.com/activity' },
  );
  const fetlife = service();
  const route = fetlife.detectRoute(dom.window.document.URL);
  const parsed = [...dom.window.document.querySelectorAll('article')].map(
    (article) => fetlife.createCandidate(article, route).parsed.metadata,
  );

  assert.deepEqual(
    parsed.map(({ feedActivityCategory, feedActivityType }) => ({
      feedActivityCategory,
      feedActivityType,
    })),
    [
      { feedActivityCategory: 'post', feedActivityType: 'picture' },
      {
        feedActivityCategory: 'conversation',
        feedActivityType: 'commented_on_profile_update',
      },
      { feedActivityCategory: 'reaction', feedActivityType: 'superloved_video' },
      { feedActivityCategory: 'social', feedActivityType: null },
      { feedActivityCategory: 'unknown', feedActivityType: null },
      { feedActivityCategory: 'reaction', feedActivityType: 'picture' },
    ],
  );
  dom.window.close();
});

test('event cards preserve source date, time label, location, category, and authoritative route mode', () => {
  const dom = new JSDOM(
    `<div data-day-key="2026-09-19">
      <div data-clickable-url-value="/events/2026/09/19/example-event">
        <a href="/events/2026/09/19/example-event">
          <span data-testid="event card category">Workshop</span>
          <h3 data-fltools-field="title">Example Event</h3>
          <div class="flex items-start"><svg><use href="#icon-clock"></use></svg><span class="break-words">Sat, Sep 19 at 10:30 AM</span></div>
          <div class="flex items-start"><svg><use href="#icon-location"></use></svg><span class="break-words">Venue <span>Seattle</span></span></div>
        </a>
      </div>
    </div>`,
    { url: 'https://fetlife.com/events/near' },
  );
  const fetlife = service();
  const route = fetlife.detectRoute(dom.window.document.URL);
  const candidate = fetlife.createCandidate(
    dom.window.document.querySelector('[data-clickable-url-value]'),
    route,
  );
  assert.deepEqual(candidate.parsed.metadata, {
    category: 'Workshop',
    location: 'Venue Seattle',
    mode: 'in-person',
    sourceDate: '2026-09-19',
    time: null,
    timeLabel: 'Sat, Sep 19 at 10:30 AM',
  });
  dom.window.close();
});

test('a linked sidebar profile does not inherit the current profile route identity', async () => {
  const dom = await loadFixture('profile', 'https://fetlife.com/ExamplePerson');
  const sidebar = dom.window.document.createElement('article');
  sidebar.innerHTML = '<h2>Another Person</h2><a href="/AnotherPerson">Open profile</a>';
  dom.window.document.body.append(sidebar);
  const fetlife = service();
  const route = fetlife.detectRoute(dom.window.location.href);
  const candidate = fetlife.createCandidate(sidebar, route);

  assert.equal(candidate.kind, 'profile');
  assert.equal(candidate.parsed.identity.key, 'person:url:https://fetlife.com/AnotherPerson');
});

test('profile cards expose source-audited Highlighter and comparison facts without inventing missing values', async () => {
  const dom = await loadFixture('profile', 'https://fetlife.com/home');
  const card = dom.window.document.createElement('article');
  card.innerHTML = `
    <h2>Another Person</h2><a href="/users/202">Profile</a>
    <div><span class="text-sm font-bold text-gray-300">35 F dominant</span></div>
    <div class="text-sm">Seattle, Washington</div>
    <span>9 pictures</span><span>0 videos</span><span>2 writings</span>
    <turbo-frame id="relation_button_202"><button>Friends</button></turbo-frame>`;
  dom.window.document.body.append(card);
  const fetlife = service();
  const route = fetlife.detectRoute(dom.window.location.href);
  const candidate = fetlife.createCandidate(card, route);

  assert.deepEqual(candidate.parsed.metadata.profileFacts, {
    age: 35,
    gender: 'f',
    location: 'Seattle, Washington',
    pictures: 9,
    relationship: 'friends',
    relationships: ['friends'],
    roles: ['dominant'],
    videos: 0,
    writings: 2,
  });
});

test('profile cards preserve overlapping contextual relationships and unknown state', async () => {
  const dom = await loadFixture('profile', 'https://fetlife.com/following');
  const card = dom.window.document.createElement('article');
  card.innerHTML = `
    <h2>Not Followed</h2><a href="/users/203">Profile</a>
    <turbo-frame id="relation_button_203"><button>Follow</button></turbo-frame>`;
  dom.window.document.body.append(card);
  const fetlife = service();
  const route = fetlife.detectRoute(dom.window.location.href);
  const candidate = fetlife.createCandidate(card, route);
  assert.equal(candidate.parsed.metadata.profileFacts.relationship, 'none');
  assert.deepEqual(candidate.parsed.metadata.profileFacts.relationships, ['none', 'following']);

  card.querySelector("turbo-frame[id^='relation_button']").remove();
  const contextual = fetlife.createCandidate(card, route);
  assert.equal(contextual.parsed.metadata.profileFacts.relationship, 'following');
  assert.deepEqual(contextual.parsed.metadata.profileFacts.relationships, ['following']);
  const unknown = fetlife.createCandidate(card, fetlife.detectRoute('https://fetlife.com/home'));
  assert.equal(unknown.parsed.metadata.profileFacts.relationship, null);
  assert.equal(unknown.parsed.metadata.profileFacts.relationships, null);
  dom.window.close();
});

test('place kinkster cards become presentable profile candidates', async () => {
  const dom = await loadFixture(
    'place-kinksters',
    'https://fetlife.com/p/united-states/washington/seattle/kinksters',
  );
  const fetlife = service();
  const route = fetlife.detectRoute(dom.window.location.href);
  const card = dom.window.document.querySelector('[data-member-card]');
  const candidate = fetlife.createCandidate(card, route);

  assert.equal(candidate.kind, 'profile');
  assert.equal(candidate.confidence, 'medium');
  assert.equal(candidate.parsed.displayName, 'ExampleNearby');
  assert.equal(candidate.parsed.identity.key, 'person:url:https://fetlife.com/ExampleNearby');
  assert.deepEqual(candidate.safeFor, { destructive: false, durable: true });
  assert.deepEqual(candidate.parsed.metadata.profileFacts, {
    age: 35,
    gender: 'f',
    location: 'Seattle, Washington',
    pictures: 5,
    relationship: 'none',
    relationships: ['none'],
    roles: ['dominant'],
    videos: null,
    writings: null,
  });
  dom.window.close();
});
