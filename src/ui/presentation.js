import { ContractError } from '../errors.js';

export const CARD_STATES = Object.freeze({
  DIMMED: 'DIMMED',
  HIDDEN: 'HIDDEN',
  HIGHLIGHTED: 'HIGHLIGHTED',
  NORMAL: 'NORMAL',
});

export const MEDIA_STATES = Object.freeze({
  BLURRED: 'BLURRED',
  HIDDEN: 'HIDDEN',
  VISIBLE: 'VISIBLE',
});

export const PRESENTATION_PRIORITIES = Object.freeze({
  quiet: 1,
  softBlock: 2,
  filter: 3,
  seen: 4,
  favorite: 5,
  highlighter: 6,
  normal: 7,
});

const CARD_SEVERITY = Object.freeze({ HIDDEN: 4, DIMMED: 3, HIGHLIGHTED: 2, NORMAL: 1 });
const REASON_COPY = Object.freeze({
  favorite: 'Highlighted because this person is a Favorite.',
  filter: 'Changed because this card does not match the current Browse filters.',
  highlighter: 'Highlighted because a Highlighter rule matched.',
  quiet: 'Changed because this person is Quieted.',
  seen: 'Changed because this item was already opened.',
  softBlock: 'Changed because of a local Soft Block. FetLife itself is not blocked.',
});

function chipExplanation(decision) {
  if (typeof decision.detail === 'string' && decision.detail.trim()) return decision.detail.trim();
  const reason = REASON_COPY[decision.reason];
  const state = decision.state === CARD_STATES.HIGHLIGHTED ? 'Highlighted' : 'Dimmed';
  return reason ? `${state}: ${reason}` : `${state} by ${decision.reason}.`;
}
const MEDIA_SEVERITY = Object.freeze({ HIDDEN: 3, BLURRED: 2, VISIBLE: 1 });

function resolve(requests, priorities, severity, validStates) {
  if (!Array.isArray(requests)) throw new ContractError('Presentation requests must be an array');
  const valid = requests.filter((request) => {
    if (
      typeof request?.reason !== 'string' ||
      request.reason.length === 0 ||
      !priorities[request.reason] ||
      !validStates.includes(request.state)
    ) {
      throw new ContractError('Presentation request is invalid', { request });
    }
    if (
      request.treatment !== undefined &&
      (typeof request.treatment !== 'string' || !/^[a-z0-9-]{1,40}$/.test(request.treatment))
    ) {
      throw new ContractError('Presentation treatment is invalid', { request });
    }
    return true;
  });
  valid.sort(
    (left, right) =>
      priorities[left.reason] - priorities[right.reason] ||
      severity[right.state] - severity[left.state],
  );
  return valid[0] ?? null;
}

export class PresentationPolicy {
  #cards = new Map();
  #document;
  #media = new Map();

  constructor({ document }) {
    if (!document?.createElement)
      throw new ContractError('Presentation policy requires a document');
    this.#document = document;
  }

  resolveCard(requests) {
    return (
      resolve(requests, PRESENTATION_PRIORITIES, CARD_SEVERITY, Object.values(CARD_STATES)) ?? {
        reason: 'normal',
        state: CARD_STATES.NORMAL,
      }
    );
  }

  resolveMedia(requests) {
    if (!Array.isArray(requests)) throw new ContractError('Presentation requests must be an array');
    const priorities = Object.fromEntries(
      requests.map((request) => {
        if (typeof request?.reason !== 'string' || request.reason.length === 0) {
          throw new ContractError('Presentation request is invalid', { request });
        }
        return [request.reason, 1];
      }),
    );
    return (
      resolve(requests, priorities, MEDIA_SEVERITY, Object.values(MEDIA_STATES)) ?? {
        reason: 'normal',
        state: MEDIA_STATES.VISIBLE,
      }
    );
  }

  applyCard(element, requests) {
    if (!element?.classList) throw new ContractError('Card presentation requires an element');
    if (!this.#cards.has(element)) {
      this.#cards.set(element, {
        ariaHidden: element.getAttribute('aria-hidden'),
        hidden: element.hidden,
      });
    }
    const decision = this.resolveCard(requests);
    this.#clearCardClasses(element);
    element.dataset.fltPresentation = decision.state.toLowerCase();
    element.dataset.fltPresentationReason = decision.reason;
    if (decision.treatment) element.dataset.fltPresentationTreatment = decision.treatment;
    else delete element.dataset.fltPresentationTreatment;
    if (decision.state === CARD_STATES.HIDDEN) {
      element.classList.add('flt-state-hidden');
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
    } else {
      const original = this.#cards.get(element);
      element.hidden = original.hidden;
      if (original.ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', original.ariaHidden);
      if (decision.state === CARD_STATES.DIMMED) element.classList.add('flt-state-dimmed');
      if (decision.state === CARD_STATES.HIGHLIGHTED)
        element.classList.add('flt-state-highlighted');
      if ([CARD_STATES.DIMMED, CARD_STATES.HIGHLIGHTED].includes(decision.state)) {
        const indicator = this.#document.createElement('button');
        indicator.type = 'button';
        indicator.className = 'flt-root flt-presentation-indicator flt-card-chip';
        indicator.dataset.fltPresentationIndicator = 'true';
        indicator.dataset.fltTip = chipExplanation(decision);
        indicator.setAttribute('aria-expanded', 'false');
        indicator.setAttribute('aria-label', indicator.dataset.fltTip);
        indicator.textContent = decision.state === CARD_STATES.DIMMED ? 'Dimmed' : 'Highlighted';
        indicator.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          indicator.setAttribute(
            'aria-expanded',
            indicator.getAttribute('aria-expanded') === 'true' ? 'false' : 'true',
          );
        });
        element.prepend(indicator);
      }
    }
    return Object.freeze({ ...decision });
  }

  clearCard(element) {
    const original = this.#cards.get(element);
    if (!original) return false;
    this.#clearCardClasses(element);
    element.hidden = original.hidden;
    if (original.ariaHidden === null) element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', original.ariaHidden);
    delete element.dataset.fltPresentation;
    delete element.dataset.fltPresentationReason;
    delete element.dataset.fltPresentationTreatment;
    this.#cards.delete(element);
    return true;
  }

  applyMedia(element, requests, { blurPixels = 4 } = {}) {
    if (!element?.classList || !Number.isFinite(blurPixels) || blurPixels < 1 || blurPixels > 10) {
      throw new ContractError('Media presentation requires an element and blur from 1 to 10');
    }
    if (!this.#media.has(element)) this.#media.set(element, true);
    const decision = this.resolveMedia(requests);
    element.classList.remove('flt-media-blurred', 'flt-media-hidden');
    element.style.removeProperty('--flt-media-blur');
    if (decision.state === MEDIA_STATES.BLURRED) {
      element.classList.add('flt-media-blurred');
      element.style.setProperty('--flt-media-blur', `${blurPixels}px`);
    }
    if (decision.state === MEDIA_STATES.HIDDEN) element.classList.add('flt-media-hidden');
    element.dataset.fltMedia = decision.state.toLowerCase();
    return Object.freeze({ ...decision });
  }

  clearMedia(element) {
    if (!this.#media.has(element)) return false;
    element.classList.remove('flt-media-blurred', 'flt-media-hidden');
    element.style.removeProperty('--flt-media-blur');
    delete element.dataset.fltMedia;
    this.#media.delete(element);
    return true;
  }

  pruneDisconnected() {
    let cards = 0;
    let media = 0;
    for (const element of [...this.#cards.keys()]) {
      if (!element.isConnected) {
        this.clearCard(element);
        cards += 1;
      }
    }
    for (const element of [...this.#media.keys()]) {
      if (!element.isConnected) {
        this.clearMedia(element);
        media += 1;
      }
    }
    return Object.freeze({ cards, media });
  }

  destroy() {
    for (const element of [...this.#cards.keys()]) this.clearCard(element);
    for (const element of [...this.#media.keys()]) this.clearMedia(element);
  }

  #clearCardClasses(element) {
    element.classList.remove('flt-state-dimmed', 'flt-state-hidden', 'flt-state-highlighted');
    element
      .querySelectorAll(':scope > [data-flt-presentation-indicator="true"]')
      .forEach((node) => node.remove());
  }
}
