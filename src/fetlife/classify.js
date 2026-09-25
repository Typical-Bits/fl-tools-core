import { ROUTE_KINDS, detectRoute } from './routes.js';
import { SELECTORS, queryFirst } from './selectors.js';

const CANDIDATE_KINDS = new Set(['content', 'event', 'feed', 'group', 'profile']);

function classified(kind, confidence, evidence) {
  return Object.freeze({ confidence, evidence, kind });
}

function containsRoute(element, kind) {
  const anchors = [
    ...(element.matches?.('a[href]') ? [element] : []),
    ...(element.querySelectorAll?.('a[href]') ?? []),
  ];
  return anchors.some(
    (anchor) => detectRoute(anchor.getAttribute('href'), element.ownerDocument?.URL).kind === kind,
  );
}

export function classifyElement(element, route) {
  const explicit = element.getAttribute?.('data-fltools-fixture-kind');
  if (CANDIDATE_KINDS.has(explicit)) return classified(explicit, 'high', 'fixture-kind');
  if (element.hasAttribute?.('data-content-id')) return classified('content', 'high', 'content-id');
  if (element.hasAttribute?.('data-story-uid')) return classified('content', 'high', 'story-uid');
  if (element.hasAttribute?.('data-event-id')) return classified('event', 'high', 'event-id');
  if (element.hasAttribute?.('data-group-id')) return classified('group', 'high', 'group-id');
  if (element.hasAttribute?.('data-user-id')) return classified('profile', 'high', 'user-id');
  if (element.hasAttribute?.('data-member-card')) {
    return classified('profile', 'medium', 'member-card');
  }
  if (element.getAttribute?.('data-test-id') === 'profile-header') {
    return classified('profile', 'high', 'profile-header');
  }
  if (/^\/events\//.test(element.getAttribute?.('data-clickable-url-value') ?? '')) {
    return classified('event', 'high', 'event-click-target');
  }
  if (element.getAttribute?.('role') === 'feed') return classified('feed', 'high', 'feed-role');

  if (element.matches?.('main')) {
    if (route?.kind === ROUTE_KINDS.PROFILE) return classified('profile', 'high', 'profile-route');
    if (route?.kind === ROUTE_KINDS.CONTENT) return classified('content', 'high', 'content-route');
    if (route?.kind === ROUTE_KINDS.GROUP) return classified('group', 'high', 'group-route');
    if (route?.kind === ROUTE_KINDS.EVENT) return classified('event', 'high', 'event-route');
    if (route?.kind === ROUTE_KINDS.FEED) return classified('feed', 'medium', 'feed-route');
  }

  if (queryFirst(element, SELECTORS.contentLink) || containsRoute(element, ROUTE_KINDS.CONTENT))
    return classified('content', 'medium', 'content-link');
  if (queryFirst(element, SELECTORS.eventLink) || containsRoute(element, ROUTE_KINDS.EVENT))
    return classified('event', 'medium', 'event-link');
  if (queryFirst(element, SELECTORS.groupLink) || containsRoute(element, ROUTE_KINDS.GROUP))
    return classified('group', 'medium', 'group-link');
  if (queryFirst(element, SELECTORS.profileLink) || containsRoute(element, ROUTE_KINDS.PROFILE))
    return classified('profile', 'medium', 'profile-link');
  if (element.matches?.('article')) return classified('feed', 'low', 'generic-article');
  return null;
}

export function candidateSafety(classification, parsed) {
  const identity = parsed.identity;
  const reliableIdentity = !identity || identity.confidence === 'high';
  return Object.freeze({
    destructive: classification.confidence === 'high' && reliableIdentity,
    durable:
      classification.confidence !== 'low' &&
      Boolean(identity?.durable) &&
      identity?.confidence !== 'low',
  });
}
