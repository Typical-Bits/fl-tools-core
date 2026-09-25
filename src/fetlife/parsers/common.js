import { SELECTORS, queryFirst, readText } from '../selectors.js';
import { detectRoute } from '../routes.js';
import { canonicalizeFetLifeUrl } from '../url.js';

export function getBaseUrl(element, context = {}) {
  return (
    context.baseUrl ?? context.route?.url ?? element.ownerDocument?.URL ?? 'https://fetlife.com/'
  );
}

export function readLink(element, selectors, context) {
  const link = queryFirst(element, selectors);
  return canonicalizeFetLifeUrl(link?.getAttribute('href'), getBaseUrl(element, context));
}

export function readRouteLink(element, kind, context) {
  const anchors = [
    ...(element.matches?.('a[href]') ? [element] : []),
    ...(element.querySelectorAll?.('a[href]') ?? []),
  ];
  for (const anchor of anchors) {
    const route = detectRoute(anchor.getAttribute('href'), getBaseUrl(element, context));
    if (route.kind === kind) return { anchor, route, url: route.url };
  }
  return null;
}

export function readDocumentCanonical(element, context) {
  const link = queryFirst(element.ownerDocument, SELECTORS.canonicalLink);
  return canonicalizeFetLifeUrl(link?.getAttribute('href'), getBaseUrl(element, context));
}

export function readKnownId(element, attribute) {
  const value = element.getAttribute?.(attribute);
  return /^\d+$/.test(value ?? '') ? value : null;
}

export function text(element, selectors) {
  return readText(element, selectors);
}

export function freezeParsed(value) {
  return Object.freeze({
    ...value,
    evidence: Object.freeze(value.evidence.filter(Boolean)),
    metadata: Object.freeze(value.metadata ?? {}),
  });
}
