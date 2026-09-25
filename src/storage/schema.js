import { BROWSE_SETTINGS_KEY } from './constants.js';

export const BROWSE_DEFAULTS = Object.freeze({
  feed: Object.freeze({}),
  filters: Object.freeze({}),
  infiniteScroll: Object.freeze({}),
  media: Object.freeze({}),
  navigation: Object.freeze({}),
  pageEnhancements: Object.freeze({}),
  preset: null,
  presets: Object.freeze({}),
  seen: Object.freeze({}),
  softBlock: Object.freeze({}),
  ui: Object.freeze({}),
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isBrowseValue(value) {
  if (!isObject(value)) return false;
  const allowed = new Set(Object.keys(BROWSE_DEFAULTS));
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  return (
    [
      'feed',
      'filters',
      'infiniteScroll',
      'media',
      'navigation',
      'pageEnhancements',
      'presets',
      'seen',
      'softBlock',
      'ui',
    ].every((key) => value[key] === undefined || isObject(value[key])) &&
    (value.preset === undefined || value.preset === null || typeof value.preset === 'string')
  );
}

function isEnvelope(record, accountScoped) {
  return (
    isObject(record) &&
    typeof record.key === 'string' &&
    record.key.length > 0 &&
    typeof record.recordKey === 'string' &&
    record.recordKey.length > 0 &&
    Number.isInteger(record.revision) &&
    record.revision >= 1 &&
    record.schemaVersion === 1 &&
    Number.isFinite(record.updatedAt) &&
    (!accountScoped || (typeof record.accountId === 'string' && record.accountId.length > 0))
  );
}

export function validateRecord(storeName, record) {
  if (storeName === 'meta') {
    return (
      isObject(record) &&
      typeof record.key === 'string' &&
      record.key.length > 0 &&
      record.schemaVersion === 1 &&
      Number.isFinite(record.updatedAt)
    );
  }
  if (!isEnvelope(record, true) || !isObject(record.value)) return false;
  if (storeName === 'settings') {
    return record.recordKey !== BROWSE_SETTINGS_KEY || isBrowseValue(record.value);
  }
  if (storeName === 'people') {
    return (
      typeof record.value.personId === 'string' &&
      !Array.isArray(record.value.history) &&
      !Array.isArray(record.value.watchHistory)
    );
  }
  if (storeName === 'history') {
    return typeof record.value.personId === 'string' && Number.isFinite(record.value.visitedAt);
  }
  if (storeName === 'watches') return typeof record.value.personId === 'string';
  if (storeName === 'vault') {
    const forbidden = ['bytes', 'blob', 'data', 'content'];
    return (
      typeof record.value.contentId === 'string' &&
      isObject(record.value.entityIdentity) &&
      typeof record.value.contentType === 'string' &&
      typeof record.value.relativePath === 'string' &&
      (typeof record.value.sourceIdentity === 'string' || isObject(record.value.sourceIdentity)) &&
      Number.isFinite(record.value.savedAt) &&
      isObject(record.value.metadata) &&
      ['string', 'object'].includes(typeof record.value.deduplicationState) &&
      record.value.deduplicationState !== null &&
      ['string', 'object'].includes(typeof record.value.acquisitionState) &&
      record.value.acquisitionState !== null &&
      forbidden.every((key) => !(key in record.value))
    );
  }
  return storeName === 'social';
}

export function mergeBrowseSettings(overrides = {}) {
  if (!isBrowseValue(overrides)) return globalThis.structuredClone(BROWSE_DEFAULTS);
  const merged = globalThis.structuredClone(BROWSE_DEFAULTS);
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] = isObject(value) ? { ...merged[key], ...value } : value;
  }
  return merged;
}

export function isValidBrowseOverrides(value) {
  return isBrowseValue(value);
}
