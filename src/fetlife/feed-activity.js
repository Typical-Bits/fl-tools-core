export const FEED_ACTIVITY_CATEGORIES = Object.freeze({
  CONVERSATION: 'conversation',
  POST: 'post',
  REACTION: 'reaction',
  SOCIAL: 'social',
  UNKNOWN: 'unknown',
});

const ACTIVITY_TYPE_ATTRIBUTES = Object.freeze(['data-feed-event', 'data-story-type', 'data-type']);

function normalizeType(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || null;
}

function categoryForType(type) {
  if (!type) return FEED_ACTIVITY_CATEGORIES.UNKNOWN;
  if (/(?:^|_)(?:super)?loved?(?:_|$)|trending/.test(type)) {
    return FEED_ACTIVITY_CATEGORIES.REACTION;
  }
  if (/comment|repl(?:y|ied)|answered|response/.test(type)) {
    return FEED_ACTIVITY_CATEGORIES.CONVERSATION;
  }
  if (
    /friend|follow|sign_?up|relationship|profile_update|fetish|group_membership|became_group_leader|rsvp/.test(
      type,
    )
  ) {
    return FEED_ACTIVITY_CATEGORIES.SOCIAL;
  }
  if (
    /picture|video|writing|(?:^|_)post(?:_|$)|status|community_list|ask_me_anything|event|discussion/.test(
      type,
    )
  ) {
    return FEED_ACTIVITY_CATEGORIES.POST;
  }
  return FEED_ACTIVITY_CATEGORIES.UNKNOWN;
}

function summaryText(element) {
  const source =
    element.querySelector?.('[data-fltools-field="feed-summary"], header, h1, h2, h3') ?? element;
  return String(source?.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

function categoryForSummary(summary) {
  if (!summary) return FEED_ACTIVITY_CATEGORIES.UNKNOWN;
  if (/\b(?:superloved|loved|trending)\b/i.test(summary)) {
    return FEED_ACTIVITY_CATEGORIES.REACTION;
  }
  if (/\b(?:commented on|replied to|answered)\b/i.test(summary)) {
    return FEED_ACTIVITY_CATEGORIES.CONVERSATION;
  }
  if (
    /\b(?:started following|is now following|followed|accepted (?:a )?friend|are now friends|signed up|joined fetlife|joined (?:a |the )?group|became (?:a )?(?:leader|owner)|relationship (?:update|change)|updated (?:their|a) profile|added (?:a )?fetish|rsvp(?:ed)?)\b/i.test(
      summary,
    )
  ) {
    return FEED_ACTIVITY_CATEGORIES.SOCIAL;
  }
  if (/\b(?:posted|uploaded|published|wrote|created)\b/i.test(summary)) {
    return FEED_ACTIVITY_CATEGORIES.POST;
  }
  return FEED_ACTIVITY_CATEGORIES.UNKNOWN;
}

export function classifyFeedActivity(element, { contentType } = {}) {
  let activityType = null;
  for (const attribute of ACTIVITY_TYPE_ATTRIBUTES) {
    activityType = normalizeType(element.getAttribute?.(attribute));
    if (activityType) break;
  }
  const activityCategory = categoryForType(activityType);
  const summaryCategory = categoryForSummary(summaryText(element));
  const contentActivityType =
    normalizeType(element.getAttribute?.('data-dwell-content-type')) ?? normalizeType(contentType);
  const category =
    activityCategory !== FEED_ACTIVITY_CATEGORIES.UNKNOWN
      ? activityCategory
      : summaryCategory !== FEED_ACTIVITY_CATEGORIES.UNKNOWN
        ? summaryCategory
        : categoryForType(contentActivityType);
  const type = activityType ?? contentActivityType;
  return Object.freeze({ category, type });
}
