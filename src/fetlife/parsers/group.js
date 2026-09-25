import { ENTITY_TYPES } from '../identity.js';
import { ROUTE_KINDS } from '../routes.js';
import { SELECTORS } from '../selectors.js';
import { freezeParsed, readDocumentCanonical, readKnownId, readRouteLink, text } from './common.js';

export function parseGroup(element, context) {
  const isRouteRoot = element.matches?.('main') && context.route?.kind === ROUTE_KINDS.GROUP;
  const routeCanonical = isRouteRoot ? context.route.url : null;
  const documentCanonical = routeCanonical ? readDocumentCanonical(element, context) : null;
  const linkedCanonical = readRouteLink(element, ROUTE_KINDS.GROUP, context)?.url ?? null;
  const canonicalUrl = documentCanonical ?? routeCanonical ?? linkedCanonical;
  const stableId =
    readKnownId(element, 'data-group-id') ??
    (isRouteRoot ? context.route?.params?.groupId : null) ??
    canonicalUrl?.match(/\/groups\/(\d+)(?:\/|$)/)?.[1];
  const identity = context.identity.resolve({
    canonicalAuthority: Boolean(documentCanonical),
    canonicalUrl,
    element,
    stableId,
    type: ENTITY_TYPES.GROUP,
  });
  const title =
    text(element, SELECTORS.title) ?? element.textContent?.replace(/\s+/g, ' ').trim() ?? null;

  return freezeParsed({
    canonicalUrl,
    evidence: [stableId && 'stable-id', canonicalUrl && 'group-link', title && 'title'],
    identity,
    kind: 'group',
    metadata: {},
    title,
  });
}
