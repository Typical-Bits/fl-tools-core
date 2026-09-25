import { ENTITY_TYPES } from '../identity.js';
import { ROUTE_KINDS } from '../routes.js';
import { SELECTORS } from '../selectors.js';
import { canonicalizeFetLifeUrl } from '../url.js';
import {
  freezeParsed,
  getBaseUrl,
  readDocumentCanonical,
  readKnownId,
  readRouteLink,
  text,
} from './common.js';

function textForIcon(element, iconName) {
  const icon = element.querySelector?.(`use[href*="#icon-${iconName}"]`);
  const row = icon?.closest?.('.flex.items-start');
  return row?.querySelector?.('.break-words')?.textContent?.replace(/\s+/g, ' ').trim() || null;
}

function sourceMode(context) {
  try {
    const path = new URL(context.route?.url).pathname.replace(/\/$/, '');
    if (path === '/events/near') return 'in-person';
    if (path === '/events/virtual') return 'virtual';
  } catch {
    // An unknown route does not authorize an inferred event mode.
  }
  return null;
}

export function parseEvent(element, context) {
  const isRouteRoot = element.matches?.('main') && context.route?.kind === ROUTE_KINDS.EVENT;
  const routeCanonical = isRouteRoot ? context.route.url : null;
  const documentCanonical = routeCanonical ? readDocumentCanonical(element, context) : null;
  const clickTarget = canonicalizeFetLifeUrl(
    element.getAttribute?.('data-clickable-url-value'),
    getBaseUrl(element, context),
  );
  const linkedCanonical = readRouteLink(element, ROUTE_KINDS.EVENT, context)?.url ?? clickTarget;
  const canonicalUrl = documentCanonical ?? routeCanonical ?? linkedCanonical;
  const stableId =
    readKnownId(element, 'data-event-id') ??
    (isRouteRoot ? context.route?.params?.eventId : null) ??
    canonicalUrl?.match(/\/events\/(\d+)\/?$/)?.[1];
  const identity = context.identity.resolve({
    canonicalAuthority: Boolean(documentCanonical || routeCanonical || linkedCanonical),
    canonicalUrl,
    element,
    stableId,
    type: ENTITY_TYPES.EVENT,
  });
  const title = text(element, SELECTORS.title);
  const time = element.querySelector?.('time[datetime]')?.getAttribute('datetime') ?? null;
  const sourceDate = element.closest?.('[data-day-key]')?.getAttribute('data-day-key') ?? null;
  const category =
    element
      .querySelector?.('[data-testid="event card category"]')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim() || null;
  const timeLabel = textForIcon(element, 'clock');
  const location = textForIcon(element, 'location');
  const mode = sourceMode(context);

  return freezeParsed({
    canonicalUrl,
    evidence: [
      stableId && 'stable-id',
      canonicalUrl && 'event-link',
      title && 'title',
      time && 'time',
    ],
    identity,
    kind: 'event',
    metadata: { category, location, mode, sourceDate, time, timeLabel },
    title,
  });
}
