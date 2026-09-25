import { freezeParsed } from './common.js';

export function parseFeed(element, context) {
  return freezeParsed({
    canonicalUrl: context.route?.url ?? null,
    evidence: [element.getAttribute?.('role') === 'feed' && 'feed-role'],
    identity: null,
    kind: 'feed',
    metadata: { routeKind: context.route?.kind ?? 'unknown' },
  });
}
