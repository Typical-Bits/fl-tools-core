import { ENTITY_TYPES } from '../identity.js';
import { classifyFeedActivity } from '../feed-activity.js';
import { ROUTE_KINDS } from '../routes.js';
import { SELECTORS } from '../selectors.js';
import { freezeParsed, getBaseUrl, readKnownId, readRouteLink, text } from './common.js';

const CONTENT_TYPES = new Set(['posts', 'pictures', 'videos', 'statuses', 'writings']);

function normalizeContentType(value) {
  if (value === 'posts') return 'writings';
  return CONTENT_TYPES.has(value) ? value : null;
}

export function parseContent(element, context) {
  const isRouteRoot = element.matches?.('main') && context.route?.kind === 'content';
  const contentLink = readRouteLink(element, ROUTE_KINDS.CONTENT, context);
  const canonicalUrl = contentLink?.url ?? (isRouteRoot ? context.route.url : null);
  const route = contentLink?.route ?? (isRouteRoot ? context.route : null);
  const declaredType = element.getAttribute?.('data-content-type');
  const storyUid = element.getAttribute?.('data-story-uid');
  const storyType = storyUid?.split(':')[0] === 'Writing' ? 'writings' : null;
  const contentType =
    normalizeContentType(declaredType) ??
    normalizeContentType(route?.params?.contentType) ??
    storyType;
  const stableId =
    readKnownId(element, 'data-content-id') ??
    route?.params?.contentId ??
    (isRouteRoot ? context.route?.params?.contentId : null) ??
    storyUid ??
    canonicalUrl?.match(/\/(?:posts|pictures|videos|statuses|writings)\/(\d+)(?:\/|$)/)?.[1];
  const identity = context.identity.resolve({
    canonicalAuthority: Boolean(contentLink || isRouteRoot),
    canonicalUrl,
    element,
    stableId,
    type: ENTITY_TYPES.CONTENT,
  });
  const authorLink = readRouteLink(element, ROUTE_KINDS.PROFILE, context);
  const authorId = readKnownId(element, 'data-story-actor-id');
  const authorIdentity =
    authorLink || authorId
      ? context.identity.resolve({
          canonicalAuthority: Boolean(authorLink),
          canonicalUrl: authorLink?.url,
          element: authorLink?.anchor ?? element,
          stableId: authorId,
          type: ENTITY_TYPES.PERSON,
        })
      : null;
  const title = text(element, SELECTORS.title);
  const feedActivity = classifyFeedActivity(element, { contentType });

  return freezeParsed({
    canonicalUrl,
    evidence: [
      stableId && 'stable-id',
      canonicalUrl && 'content-link',
      contentType && 'content-type',
    ],
    identity,
    kind: 'content',
    metadata: {
      authorIdentity,
      contentType,
      feedActivityCategory: feedActivity.category,
      feedActivityType: feedActivity.type,
      sourceUrl: canonicalUrl ? new URL(canonicalUrl, getBaseUrl(element, context)).href : null,
    },
    title,
  });
}
