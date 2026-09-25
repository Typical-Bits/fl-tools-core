import { classifyElement, candidateSafety } from './classify.js';
import { IdentityResolver } from './identity.js';
import { parseCandidate } from './parsers/index.js';
import { detectRoute } from './routes.js';
import { SELECTORS } from './selectors.js';

/** The only Core-facing entry point for FetLife routes, selectors, identity, and parsing. */
export class FetLifeService {
  #identity;

  constructor({ idFactory, supportedFallbacks } = {}) {
    this.#identity = new IdentityResolver({ idFactory, supportedFallbacks });
  }

  get selectors() {
    return SELECTORS;
  }

  detectRoute(value, baseUrl) {
    return detectRoute(value, baseUrl);
  }

  classify(element, route) {
    return classifyElement(element, route);
  }

  parse(kind, element, { route, baseUrl } = {}) {
    return parseCandidate(kind, element, {
      baseUrl,
      identity: this.#identity,
      route,
    });
  }

  createCandidate(element, route) {
    const classification = this.classify(element, route);
    if (!classification) return null;
    const parsed = this.parse(classification.kind, element, { route });
    return Object.freeze({
      confidence: classification.confidence,
      context: Object.freeze({ route }),
      element,
      evidence: classification.evidence,
      kind: classification.kind,
      parsed,
      safeFor: candidateSafety(classification, parsed),
    });
  }
}
