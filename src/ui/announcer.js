import { ContractError } from '../errors.js';

export class AccessibleAnnouncer {
  #clock;
  #document;
  #last = new Map();
  #regions = new Map();

  constructor({ document, clock = Date.now }) {
    if (!document?.createElement) throw new ContractError('Announcer requires a document');
    this.#document = document;
    this.#clock = clock;
  }

  mount() {
    if (this.#regions.size > 0) {
      for (const region of this.#regions.values()) {
        if (!region.isConnected && this.#document.body) this.#document.body.append(region);
      }
      return;
    }
    for (const priority of ['polite', 'assertive']) {
      const region = this.#document.createElement('div');
      region.className = 'flt-root flt-live-region';
      region.dataset.fltLive = priority;
      region.setAttribute('aria-live', priority);
      region.setAttribute('aria-atomic', 'true');
      this.#document.body.append(region);
      this.#regions.set(priority, region);
    }
  }

  announce(message, { priority = 'polite', dedupeMs = 1500 } = {}) {
    if (
      typeof message !== 'string' ||
      message.trim().length === 0 ||
      !this.#regions.has(priority)
    ) {
      throw new ContractError('Announcement requires mounted region, text, and valid priority');
    }
    const text = message.trim();
    const now = this.#clock();
    if (now - (this.#last.get(`${priority}:${text}`) ?? -Infinity) < dedupeMs) return false;
    this.#last.set(`${priority}:${text}`, now);
    const region = this.#regions.get(priority);
    region.textContent = '';
    region.textContent = text;
    return true;
  }

  destroy() {
    for (const region of this.#regions.values()) region.remove();
    this.#regions.clear();
    this.#last.clear();
  }
}
