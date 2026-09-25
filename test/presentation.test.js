import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { CARD_STATES, MEDIA_STATES, PresentationPolicy } from '../src/ui/presentation.js';

test('PresentationPolicy follows locked precedence and Favorite never bypasses a filter', () => {
  const dom = new JSDOM('<article><a href="/users/42">Native link</a></article>');
  const policy = new PresentationPolicy({ document: dom.window.document });
  const card = dom.window.document.querySelector('article');
  const decision = policy.applyCard(card, [
    { reason: 'favorite', state: CARD_STATES.HIGHLIGHTED },
    { reason: 'filter', state: CARD_STATES.HIDDEN },
  ]);
  assert.deepEqual(decision, { reason: 'filter', state: 'HIDDEN' });
  assert.equal(card.hidden, true);
  assert.equal(card.getAttribute('aria-hidden'), 'true');
  assert.equal(card.querySelector('a').getAttribute('href'), '/users/42');
  assert.equal(policy.clearCard(card), true);
  assert.equal(card.hidden, false);
  assert.equal(card.hasAttribute('aria-hidden'), false);
});

test('dimmed and highlighted states remain present, labeled, and reversible', () => {
  const dom = new JSDOM('<article><button>Native action</button></article>');
  const policy = new PresentationPolicy({ document: dom.window.document });
  const card = dom.window.document.querySelector('article');
  policy.applyCard(card, [{ reason: 'seen', state: CARD_STATES.DIMMED }]);
  assert.equal(card.hidden, false);
  const dimmed = card.querySelector('[data-flt-presentation-indicator]');
  assert.equal(dimmed.textContent, 'Dimmed');
  assert.match(dimmed.dataset.fltTip, /already opened/);
  dimmed.click();
  assert.equal(dimmed.getAttribute('aria-expanded'), 'true');
  assert.equal(card.querySelector('button').disabled, false);
  policy.applyCard(card, [
    { reason: 'highlighter', state: CARD_STATES.HIGHLIGHTED, treatment: 'friends' },
  ]);
  assert.equal(card.querySelectorAll('[data-flt-presentation-indicator]').length, 1);
  assert.equal(card.querySelector('[data-flt-presentation-indicator]').textContent, 'Highlighted');
  assert.equal(card.dataset.fltPresentationTreatment, 'friends');
  policy.clearCard(card);
  assert.equal(card.querySelector('[data-flt-presentation-indicator]'), null);
  assert.equal(card.dataset.fltPresentationTreatment, undefined);
  assert.throws(
    () =>
      policy.applyCard(card, [
        { reason: 'highlighter', state: CARD_STATES.HIGHLIGHTED, treatment: 'not valid!' },
      ]),
    /treatment is invalid/,
  );
});

test('media policy resolves Hidden over Blurred over Visible and validates blur strength', () => {
  const dom = new JSDOM('<img alt="Native image">');
  const policy = new PresentationPolicy({ document: dom.window.document });
  const image = dom.window.document.querySelector('img');
  const decision = policy.applyMedia(
    image,
    [
      { reason: 'sfw', state: MEDIA_STATES.BLURRED },
      { reason: 'explicit-hide', state: MEDIA_STATES.HIDDEN },
    ],
    { blurPixels: 7 },
  );
  assert.equal(decision.state, 'HIDDEN');
  assert.equal(image.classList.contains('flt-media-hidden'), true);
  assert.throws(
    () =>
      policy.applyMedia(image, [{ reason: 'sfw', state: MEDIA_STATES.BLURRED }], {
        blurPixels: 11,
      }),
    /blur from 1 to 10/,
  );
  policy.applyMedia(image, [{ reason: 'sfw', state: MEDIA_STATES.BLURRED }], { blurPixels: 7 });
  assert.equal(image.style.getPropertyValue('--flt-media-blur'), '7px');
  assert.equal(policy.clearMedia(image), true);
  assert.equal(image.classList.contains('flt-media-blurred'), false);
});

test('presentation teardown reverses all owned native-page changes', () => {
  const dom = new JSDOM('<article>Card</article><img alt="Media">');
  const policy = new PresentationPolicy({ document: dom.window.document });
  const card = dom.window.document.querySelector('article');
  const media = dom.window.document.querySelector('img');
  policy.applyCard(card, [{ reason: 'quiet', state: CARD_STATES.HIDDEN }]);
  policy.applyMedia(media, [{ reason: 'policy', state: MEDIA_STATES.BLURRED }]);
  policy.destroy();
  assert.equal(card.hidden, false);
  assert.equal(card.hasAttribute('aria-hidden'), false);
  assert.equal(card.classList.contains('flt-state-hidden'), false);
  assert.equal(media.classList.contains('flt-media-blurred'), false);
});

test('presentation pruning releases detached card and media state', () => {
  const dom = new JSDOM('<main><article><img alt="Media"></article></main>');
  const policy = new PresentationPolicy({ document: dom.window.document });
  const card = dom.window.document.querySelector('article');
  const media = dom.window.document.querySelector('img');
  policy.applyCard(card, [{ reason: 'seen', state: CARD_STATES.DIMMED }]);
  policy.applyMedia(media, [{ reason: 'sfw', state: MEDIA_STATES.BLURRED }]);
  card.remove();
  assert.deepEqual(policy.pruneDisconnected(), { cards: 1, media: 1 });
  assert.equal(policy.clearCard(card), false);
  assert.equal(policy.clearMedia(media), false);
});
