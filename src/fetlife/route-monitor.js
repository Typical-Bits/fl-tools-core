import { ContractError } from '../errors.js';

export const PAGE_NAVIGATION_EVENTS = Object.freeze([
  'turbo:load',
  'turbo:render',
  'turbo:frame-load',
  'pageshow',
]);

/** Tracks same-document navigation and aborts work from the previous route. */
export class RouteMonitor {
  #controller;
  #current;
  #fetlife;
  #onChange;
  #originalPushState;
  #originalReplaceState;
  #revision = 0;
  #started = false;
  #window;

  constructor({ window, fetlife, onChange = () => {} }) {
    if (!window?.history || !fetlife || typeof onChange !== 'function') {
      throw new ContractError('Route monitor dependencies are required');
    }
    this.#window = window;
    this.#fetlife = fetlife;
    this.#onChange = onChange;
  }

  get context() {
    return this.#current;
  }

  start() {
    if (this.#started) return this.#current;
    this.#started = true;
    this.#originalPushState = this.#window.history.pushState;
    this.#originalReplaceState = this.#window.history.replaceState;
    this.#window.history.pushState = this.#wrapHistory(this.#originalPushState);
    this.#window.history.replaceState = this.#wrapHistory(this.#originalReplaceState);
    this.#window.addEventListener('popstate', this.#refresh);
    this.#window.addEventListener('hashchange', this.#refresh);
    const document = this.#window.document;
    for (const type of PAGE_NAVIGATION_EVENTS) {
      this.#window.addEventListener(type, this.#refresh);
      document?.addEventListener(type, this.#refresh);
    }
    this.#refresh();
    return this.#current;
  }

  stop(reason = 'route-monitor-stop') {
    if (!this.#started) return;
    this.#window.removeEventListener('popstate', this.#refresh);
    this.#window.removeEventListener('hashchange', this.#refresh);
    const document = this.#window.document;
    for (const type of PAGE_NAVIGATION_EVENTS) {
      this.#window.removeEventListener(type, this.#refresh);
      document?.removeEventListener(type, this.#refresh);
    }
    if (this.#window.history.pushState === this.#wrappedPushState) {
      this.#window.history.pushState = this.#originalPushState;
    }
    if (this.#window.history.replaceState === this.#wrappedReplaceState) {
      this.#window.history.replaceState = this.#originalReplaceState;
    }
    this.#controller?.abort(reason);
    this.#started = false;
  }

  #wrappedPushState;
  #wrappedReplaceState;

  #wrapHistory(original) {
    const monitor = this;
    const wrapped = function (...args) {
      const result = Reflect.apply(original, this, args);
      monitor.#refresh();
      return result;
    };
    if (original === this.#originalPushState) this.#wrappedPushState = wrapped;
    else this.#wrappedReplaceState = wrapped;
    return wrapped;
  }

  #refresh = () => {
    const route = this.#fetlife.detectRoute(this.#window.location.href);
    if (this.#current?.route.url === route.url && this.#current?.route.kind === route.kind) return;
    const previous = this.#current;
    this.#controller?.abort('navigation');
    this.#controller = new AbortController();
    this.#current = Object.freeze({
      revision: ++this.#revision,
      route,
      signal: this.#controller.signal,
    });
    this.#onChange(this.#current, previous);
  };
}
