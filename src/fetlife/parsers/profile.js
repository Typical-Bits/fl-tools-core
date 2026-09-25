import { ENTITY_TYPES } from '../identity.js';
import { ROUTE_KINDS } from '../routes.js';
import { SELECTORS, queryFirst } from '../selectors.js';
import { freezeParsed, readDocumentCanonical, readKnownId, readRouteLink } from './common.js';

const GENDER_TOKENS = new Set([
  'ag',
  'andro',
  'bg',
  'cd/tv',
  'cis',
  'db',
  'dg',
  'demig',
  'dw',
  'fem',
  'gfae',
  'gn',
  'gnc',
  'masc',
  'pg',
  'qg',
  'tg',
  'tm',
  'tw',
  'twos',
  'uog',
  'w',
  'm',
  'f',
  'mtf',
  'ftm',
  'cd',
  'tv',
  'ts',
  'is',
  'b',
  'gf',
  'gq',
  'nb',
  't',
  'male',
  'female',
  'intersex',
  'trans',
  'non-binary',
  'nonbinary',
  'agender',
  'bigender',
  'genderqueer',
  'genderfluid',
]);

function visibleCount(element, label) {
  const value = element.textContent ?? '';
  const match =
    value.match(new RegExp(`(\\d[\\d,]*)\\s*(?:${label})`, 'i')) ??
    value.match(new RegExp(`(?:${label})\\s*\\((\\d[\\d,]*)\\)`, 'i'));
  if (!match) return null;
  const count = Number(match[1].replaceAll(',', ''));
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function profileFacts(element, context) {
  const tag = queryFirst(element, SELECTORS.profileTag);
  const tagText = tag?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const match = tagText.match(/^(\d{2,4})\s*([A-Za-z+][\w+/-]{0,24})?\s*(.*)$/);
  const age = Number(match?.[1]);
  const genderToken = match?.[2]?.toLocaleLowerCase() ?? '';
  const gender = GENDER_TOKENS.has(genderToken) ? genderToken : null;
  const role = match
    ? `${gender ? '' : genderToken} ${match[3] ?? ''}`.trim().toLocaleLowerCase() || null
    : null;
  const locationLine = tag?.closest('div')?.nextElementSibling;
  const linkedLocation = [...element.querySelectorAll(SELECTORS.profileLocation.join(','))]
    .map((link) => link.textContent?.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(', ');
  const location =
    linkedLocation ||
    (locationLine &&
    /text-sm/.test(locationLine.className ?? '') &&
    !locationLine.querySelector('a')
      ? locationLine.textContent?.replace(/\s+/g, ' ').trim() || null
      : null);
  const relationText = SELECTORS.relationControl
    .map(
      (selector) => element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    )
    .find(Boolean);
  const relationships = new Set();
  if (element.querySelector(SELECTORS.followsYouMarker[0])) relationships.add('follows-you');
  if (/^friends?$/i.test(relationText)) relationships.add('friends');
  else if (/following/i.test(relationText)) relationships.add('following');
  else if (/^follow$/i.test(relationText)) relationships.add('none');
  if (context.route?.params?.relationshipList) {
    const contextual = {
      followers: 'follows-you',
      following: 'following',
      friends: 'friends',
    }[context.route.params.section];
    if (contextual) relationships.add(contextual);
  }
  const relationshipList = [...relationships];
  const relationship = relationshipList[0] ?? null;
  return Object.freeze({
    age: Number.isFinite(age) && age >= 18 && age <= 9999 ? age : null,
    gender,
    location,
    pictures: visibleCount(element, 'pics?|photos?|pictures?'),
    relationship,
    relationships: relationshipList.length ? Object.freeze(relationshipList) : null,
    roles: role ? Object.freeze([role]) : null,
    videos: visibleCount(element, 'vids?|videos?'),
    writings: visibleCount(element, 'writings?|posts?'),
  });
}

export function parseProfile(element, context) {
  const isRouteRoot =
    element.matches?.('main, [data-test-id="profile-header"]') &&
    context.route?.kind === ROUTE_KINDS.PROFILE;
  const routeCanonical = isRouteRoot ? context.route.url : null;
  const documentCanonical = routeCanonical ? readDocumentCanonical(element, context) : null;
  const linkedCanonical = readRouteLink(element, ROUTE_KINDS.PROFILE, context)?.url ?? null;
  const canonicalUrl = documentCanonical ?? routeCanonical ?? linkedCanonical;
  const stableId =
    readKnownId(element, 'data-user-id') ??
    (isRouteRoot ? context.route?.params?.personId : null) ??
    canonicalUrl?.match(/\/users\/(\d+)(?:\/|$)/)?.[1];
  const identity = context.identity.resolve({
    canonicalAuthority: Boolean(documentCanonical || routeCanonical || linkedCanonical),
    canonicalUrl,
    element,
    stableId,
    type: ENTITY_TYPES.PERSON,
  });
  const nameElement = queryFirst(element, SELECTORS.displayName)?.cloneNode(true);
  if (element.matches?.('[data-test-id="profile-header"]')) {
    for (const tag of nameElement?.querySelectorAll('span.select-none') ?? []) tag.remove();
  }
  const displayName =
    (nameElement?.textContent?.replace(/\s+/g, ' ').trim() || null) ??
    element.getAttribute?.('data-member-card')?.trim() ??
    null;

  return freezeParsed({
    canonicalUrl,
    displayName,
    evidence: [
      stableId && 'stable-id',
      documentCanonical && 'document-canonical',
      !documentCanonical && linkedCanonical && 'profile-link',
      displayName && 'display-name',
    ],
    identity,
    kind: 'profile',
    metadata: { profileFacts: profileFacts(element, context) },
  });
}
