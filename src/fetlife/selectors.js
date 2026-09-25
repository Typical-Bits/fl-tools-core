function freezeList(values) {
  return Object.freeze(values);
}

/** Central selector catalog. Product features must not duplicate these strings. */
export const SELECTORS = Object.freeze({
  currentAccount: freezeList(['[data-nav--ama-toggle-user-id-value]']),
  canonicalLink: freezeList(['link[rel="canonical"][href]']),
  candidateRoots: freezeList([
    '[data-fltools-fixture-kind]',
    '[data-member-card]',
    '[role="feed"]',
    'article',
    '[data-test-id="profile-header"]',
    '[data-clickable-url-value^="/events/"]',
    'h2 > a[href^="/groups/"]',
    'main[data-user-id]',
    'main[data-group-id]',
    'main[data-event-id]',
  ]),
  contentLink: freezeList([
    'a[href*="/posts/"]',
    'a[href*="/pictures/"]',
    'a[href*="/videos/"]',
    'a[href*="/statuses/"]',
    'a[href*="/writings/"]',
  ]),
  displayName: freezeList(['[data-fltools-field="display-name"]', 'h1', 'h2']),
  eventLink: freezeList(['a[href^="/events/"]', 'a[href*="fetlife.com/events/"]']),
  groupLink: freezeList(['a[href^="/groups/"]', 'a[href*="fetlife.com/groups/"]']),
  profileLink: freezeList(['a[href*="/users/"]']),
  profileTag: freezeList([
    '.text-sm.font-bold.text-gray-300',
    '[data-test-id="profile-header"] h1 span.select-none.font-bold',
  ]),
  profileLocation: freezeList(['[data-test-id="profile-header"] h1 + p a[href^="/p/"]']),
  relationControl: freezeList([
    "turbo-frame[id^='relation_button'] button",
    "turbo-frame[id^='relation_button'] span.inline-flex",
  ]),
  followsYouMarker: freezeList(['path[d^="M12 1v2H0v2h12v2l4-3z"]']),
  title: freezeList(['[data-fltools-field="title"]', 'h1', 'h2', 'h3']),
});

export const CURRENT_ACCOUNT_ATTRIBUTE = 'data-nav--ama-toggle-user-id-value';

export const CANDIDATE_ROOT_QUERY = SELECTORS.candidateRoots.join(',');

export function queryFirst(root, selectors) {
  for (const selector of selectors) {
    if (root.matches?.(selector)) return root;
    const found = root.querySelector?.(selector);
    if (found) return found;
  }
  return null;
}

export function readText(root, selectors) {
  const element = queryFirst(root, selectors);
  const value = element?.textContent?.replace(/\s+/g, ' ').trim();
  return value || null;
}
