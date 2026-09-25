import { ContractError } from '../errors.js';
import { canonicalizeFetLifeUrl } from './url.js';

export const ENTITY_TYPES = Object.freeze({
  CONTENT: 'content',
  EVENT: 'event',
  GROUP: 'group',
  PERSON: 'person',
});

const TYPE_VALUES = new Set(Object.values(ENTITY_TYPES));
const ID_PATTERNS = Object.freeze({
  content: /\/(?:posts|pictures|videos|statuses|writings)\/(\d+)(?:\/|$)/,
  event: /\/events\/(\d+)\/?$/,
  group: /\/groups\/(\d+)(?:\/|$)/,
  person: /\/users\/(\d+)(?:\/|$)/,
});
const CANONICAL_TYPE_PATTERNS = Object.freeze({
  content: /\/(?:posts|pictures|videos|statuses|writings)\/[^/]+(?:\/|$)/,
  event: /\/events\/[^/]+(?:\/|$)/,
  group: /\/groups\/[^/]+(?:\/|$)/,
  person: /^\/[^/]+\/?$/,
});

function normalizeStableId(value) {
  const normalized = String(value ?? '').trim();
  return /^\d+$/.test(normalized) || /^[A-Za-z][A-Za-z0-9_-]{0,31}:[A-Za-z0-9_-]+$/.test(normalized)
    ? normalized
    : null;
}

function makeIdentity(type, strategy, value, confidence, durable, canonicalUrl = null) {
  return Object.freeze({
    canonicalUrl,
    confidence,
    durable,
    key: `${type}:${strategy}:${value}`,
    strategy,
    type,
    value,
  });
}

/** Resolves stable ID, canonical URL, approved fallback, then transient identity in that order. */
export class IdentityResolver {
  #idFactory;
  #supportedFallbacks;
  #transientByElement = new WeakMap();

  constructor({ idFactory = () => crypto.randomUUID(), supportedFallbacks = {} } = {}) {
    this.#idFactory = idFactory;
    this.#supportedFallbacks = new Map(
      Object.entries(supportedFallbacks).map(([type, namespaces]) => [type, new Set(namespaces)]),
    );
  }

  resolve({
    type,
    stableId,
    canonicalUrl,
    canonicalAuthority = false,
    baseUrl,
    fallback,
    element,
  } = {}) {
    if (!TYPE_VALUES.has(type)) throw new ContractError('Unknown entity type', { type });
    const normalizedUrl = canonicalizeFetLifeUrl(canonicalUrl, baseUrl);
    const urlId = normalizedUrl?.match(ID_PATTERNS[type])?.[1];
    const resolvedId = normalizeStableId(stableId) ?? normalizeStableId(urlId);
    if (resolvedId) return makeIdentity(type, 'id', resolvedId, 'high', true, normalizedUrl);

    if (
      normalizedUrl &&
      canonicalAuthority &&
      CANONICAL_TYPE_PATTERNS[type].test(new URL(normalizedUrl).pathname)
    ) {
      return makeIdentity(type, 'url', normalizedUrl, 'medium', true, normalizedUrl);
    }

    if (
      fallback?.namespace &&
      Array.isArray(fallback.parts) &&
      fallback.parts.length > 0 &&
      this.#supportedFallbacks.get(type)?.has(fallback.namespace)
    ) {
      const parts = fallback.parts.map((part) => String(part).trim());
      if (parts.every(Boolean)) {
        const value = `${fallback.namespace}:${parts.map(encodeURIComponent).join(':')}`;
        return makeIdentity(type, 'fallback', value, 'medium', true);
      }
    }

    if (element && this.#transientByElement.has(element))
      return this.#transientByElement.get(element);
    const transient = makeIdentity(type, 'transient', this.#idFactory(), 'low', false);
    if (element) this.#transientByElement.set(element, transient);
    return transient;
  }
}

export function detectUrlType(value) {
  const canonicalUrl = canonicalizeFetLifeUrl(value);
  if (!canonicalUrl) return null;
  for (const [type, pattern] of Object.entries(ID_PATTERNS)) {
    if (pattern.test(new URL(canonicalUrl).pathname)) return type;
  }
  return null;
}
