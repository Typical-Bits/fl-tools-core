import { canonicalizeFetLifeUrl, toUrl } from './url.js';

export const ROUTE_KINDS = Object.freeze({
  COMPOSER: 'composer',
  CONTENT: 'content',
  EVENT: 'event',
  FEED: 'feed',
  GROUP: 'group',
  PROFILE: 'profile',
  REFERENCE: 'reference',
  SETTINGS: 'settings',
  UNKNOWN: 'unknown',
});

const CONTENT_PATTERNS = [
  {
    ownerParam: 'ownerId',
    pattern: /^\/users\/(\d+)\/(posts|pictures|videos|statuses|writings)\/(\d+)(?:\/|$)/,
  },
  {
    ownerParam: 'ownerNickname',
    pattern: /^\/([^/]+)\/(posts|pictures|videos|statuses|writings)\/(\d+)(?:\/|$)/,
  },
  { pattern: /^\/(posts|pictures|videos|statuses|writings)\/(\d+)(?:\/|$)/ },
];

const FEED_PATHS = new Set(['/home', '/writings']);
const RESERVED_ROOT_PATHS = new Set([
  'bookmarks',
  'events',
  'explore',
  'fetishes',
  'groups',
  'home',
  'kinktionary',
  'p',
  'pictures',
  'posts',
  'requests',
  'settings',
  'users',
  'videos',
  'writings',
]);

function result(kind, url, confidence, params = {}) {
  return Object.freeze({ confidence, kind, params: Object.freeze(params), url });
}

export function detectRoute(value, baseUrl) {
  const parsed = toUrl(value, baseUrl);
  const canonicalUrl = canonicalizeFetLifeUrl(value, baseUrl);
  if (!parsed || !canonicalUrl) return result(ROUTE_KINDS.UNKNOWN, null, 'low');
  const path = parsed.pathname.replace(/\/{2,}/g, '/');
  const reference = path.match(/^\/kinktionary(?:\/([^/]+))?\/?$/);
  if (reference) {
    return result(ROUTE_KINDS.REFERENCE, canonicalUrl, 'medium', {
      view: 'kinktionary',
      ...(reference[1] ? { article: reference[1] } : {}),
    });
  }

  for (const { pattern, ownerParam } of CONTENT_PATTERNS) {
    const match = path.match(pattern);
    if (match) {
      const hasOwner = Boolean(ownerParam);
      return result(ROUTE_KINDS.CONTENT, canonicalUrl, 'high', {
        contentId: hasOwner ? match[3] : match[2],
        contentType: hasOwner ? match[2] : match[1],
        ...(hasOwner ? { [ownerParam]: match[1] } : {}),
      });
    }
  }

  const composer = path.match(/^\/(posts|pictures|videos)\/new\/?$/);
  if (composer) {
    return result(ROUTE_KINDS.COMPOSER, canonicalUrl, 'medium', {
      contentType: composer[1] === 'posts' ? 'writings' : composer[1],
    });
  }
  const settings = path.match(/^\/settings\/(profile)\/?$/);
  if (settings) {
    return result(ROUTE_KINDS.SETTINGS, canonicalUrl, 'medium', {
      section: settings[1],
    });
  }
  if (/^\/bookmarks\/?$/.test(path)) {
    return result(ROUTE_KINDS.FEED, canonicalUrl, 'medium', { view: 'bookmarks' });
  }

  const profile = path.match(/^\/users\/(\d+)(?:\/|$)/);
  if (profile) return result(ROUTE_KINDS.PROFILE, canonicalUrl, 'high', { personId: profile[1] });
  const group = path.match(/^\/groups\/(\d+)(?:\/|$)/);
  if (group) return result(ROUTE_KINDS.GROUP, canonicalUrl, 'high', { groupId: group[1] });
  if (/^\/groups\/?$/.test(path)) {
    return result(ROUTE_KINDS.GROUP, canonicalUrl, 'medium', { view: 'list' });
  }
  const event = path.match(/^\/events\/(\d+)\/?$/);
  if (event) return result(ROUTE_KINDS.EVENT, canonicalUrl, 'high', { eventId: event[1] });
  const eventDetail = path.match(/^\/events\/(\d+)\/(\d+)(?:\/[^/]+)?\/?$/);
  if (eventDetail) {
    return result(ROUTE_KINDS.EVENT, canonicalUrl, 'medium', {
      pathIds: Object.freeze([eventDetail[1], eventDetail[2]]),
      view: 'detail',
    });
  }
  if (/^\/events(?:\/near)?\/?$/.test(path)) {
    return result(ROUTE_KINDS.EVENT, canonicalUrl, 'medium', { view: 'list' });
  }
  if (path === '/requests') {
    return result(ROUTE_KINDS.FEED, canonicalUrl, 'medium', { view: 'requests' });
  }
  const explore = path.match(/^\/explore(?:\/([^/]+))?(?:\/[^/]+)?\/?$/);
  if (explore) {
    const section =
      {
        following: 'following',
        'fresh-and-pervy': 'fresh-and-pervy',
        'stuff-you-love': 'stuff-you-love',
      }[explore[1]] ?? 'popular';
    return result(ROUTE_KINDS.FEED, canonicalUrl, 'medium', {
      section,
      view: 'explore',
    });
  }
  const fetishes = path.match(/^\/fetishes(?:\/(most_popular))?\/?$/);
  if (fetishes) {
    return result(ROUTE_KINDS.FEED, canonicalUrl, 'medium', {
      section: fetishes[1] ? 'most-popular' : 'all',
      view: 'fetishes',
    });
  }
  if (/^\/p\/(?:[^/]+\/){1,3}kinksters\/?$/.test(path)) {
    return result(ROUTE_KINDS.PROFILE, canonicalUrl, 'medium', {
      placeList: true,
      section: 'kinksters',
    });
  }
  if (/^\/p\/?$/.test(path)) {
    return result(ROUTE_KINDS.FEED, canonicalUrl, 'medium', {
      place: true,
      view: 'list',
    });
  }
  if (/^\/p(?:\/[^/]+){1,4}\/?$/.test(path)) {
    return result(ROUTE_KINDS.FEED, canonicalUrl, 'medium', {
      place: true,
      view: 'detail',
    });
  }
  if (
    FEED_PATHS.has(path.replace(/\/$/, '') || '/') ||
    /^\/(?:$|activity(?:\/|$)|explore(?:\/|$)|feed(?:\/|$))/.test(path)
  ) {
    return result(ROUTE_KINDS.FEED, canonicalUrl, 'medium');
  }
  const relationshipList = path.match(/^\/(friends|followers|following)\/?$/);
  if (relationshipList) {
    return result(ROUTE_KINDS.PROFILE, canonicalUrl, 'high', {
      relationshipList: true,
      section: relationshipList[1],
    });
  }
  const rootSlug = path.match(/^\/([^/]+)\/?$/)?.[1];
  if (rootSlug && !RESERVED_ROOT_PATHS.has(rootSlug)) {
    return result(ROUTE_KINDS.PROFILE, canonicalUrl, 'medium', { nickname: rootSlug });
  }
  const profileSection = path.match(
    /^\/([^/]+)\/(activity|pictures|videos|posts|l|friends|followers|following|profile\/groups)\/?$/,
  );
  if (profileSection && !RESERVED_ROOT_PATHS.has(profileSection[1])) {
    return result(ROUTE_KINDS.PROFILE, canonicalUrl, 'medium', {
      nickname: profileSection[1],
      section: profileSection[2],
    });
  }
  return result(ROUTE_KINDS.UNKNOWN, canonicalUrl, 'low');
}
