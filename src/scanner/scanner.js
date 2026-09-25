import { ContractError } from '../errors.js';
import { CANDIDATE_ROOT_QUERY, CURRENT_ACCOUNT_ATTRIBUTE } from '../fetlife/selectors.js';

const FLUSH_KEY = 'core.scanner.flush';

function fingerprint(candidate) {
  const element = candidate.element;
  const text = element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 1024) ?? '';
  return [
    candidate.kind,
    candidate.parsed.identity?.key ?? '',
    element.getAttribute?.('data-content-id') ?? '',
    element.getAttribute?.('data-user-id') ?? '',
    element.childElementCount ?? 0,
    text,
  ].join('|');
}

/** One-observer candidate scanner with scheduled batching and WeakMap deduplication. */
export class Scanner {
  #eventBus;
  #fetlife;
  #fingerprints = new WeakMap();
  #observer;
  #observerFactory;
  #pending = new Set();
  #root;
  #routeContext;
  #scheduler;
  #started = false;
  #subscribers = new Map();

  constructor({
    scheduler,
    fetlife,
    eventBus,
    observerFactory = (callback) => new globalThis.MutationObserver(callback),
  }) {
    if (!scheduler || !fetlife || !eventBus || typeof observerFactory !== 'function') {
      throw new ContractError('Scanner dependencies are required');
    }
    this.#scheduler = scheduler;
    this.#fetlife = fetlife;
    this.#eventBus = eventBus;
    this.#observerFactory = observerFactory;
  }

  start({ root, routeContext }) {
    if (this.#started) throw new ContractError('Scanner is already started');
    if (!root?.querySelectorAll || !routeContext?.route) {
      throw new ContractError('Scanner root and route context are required');
    }
    this.#root = root;
    this.#routeContext = routeContext;
    this.#observer = this.#observerFactory(this.#onMutations);
    this.#observer.observe(root, {
      attributeFilter: [CURRENT_ACCOUNT_ATTRIBUTE],
      attributes: true,
      childList: true,
      subtree: true,
    });
    this.#started = true;
    this.scan(root);
  }

  setRoute(routeContext) {
    if (!this.#started) throw new ContractError('Scanner is not started');
    this.#scheduler.cancel(FLUSH_KEY, 'navigation');
    this.#routeContext = routeContext;
    this.#pending.clear();
    this.#fingerprints = new WeakMap();
    this.scan(this.#root);
  }

  subscribe(kinds, callback, { signal } = {}) {
    if (!Array.isArray(kinds) || kinds.length === 0 || typeof callback !== 'function') {
      throw new ContractError('Scanner subscription requires kinds and callback');
    }
    if (signal?.aborted) return () => {};
    const entries = [];
    for (const kind of new Set(kinds)) {
      const subscribers = this.#subscribers.get(kind) ?? new Set();
      subscribers.add(callback);
      this.#subscribers.set(kind, subscribers);
      entries.push([kind, subscribers]);
    }
    const unsubscribe = () => {
      for (const [kind, subscribers] of entries) {
        subscribers.delete(callback);
        if (subscribers.size === 0) this.#subscribers.delete(kind);
      }
      signal?.removeEventListener('abort', unsubscribe);
    };
    signal?.addEventListener('abort', unsubscribe, { once: true });
    return unsubscribe;
  }

  scan(node) {
    if (!this.#started || !node) return;
    this.#collect(node);
    this.#queueFlush();
  }

  refresh(node = this.#root) {
    if (!this.#started || !node) return;
    this.#fingerprints = new WeakMap();
    this.scan(node);
  }

  stop() {
    if (!this.#started) return;
    this.#observer.disconnect();
    this.#scheduler.cancel(FLUSH_KEY, 'scanner-stop');
    this.#pending.clear();
    this.#subscribers.clear();
    this.#fingerprints = new WeakMap();
    this.#root = undefined;
    this.#routeContext = undefined;
    this.#started = false;
  }

  #onMutations = (mutations) => {
    this.#eventBus.emit('scanner:mutated', { count: mutations.length });
    for (const mutation of mutations) {
      this.#collect(mutation.target);
      for (const node of mutation.addedNodes) this.#collect(node);
    }
    this.#queueFlush();
  };

  #collect(node) {
    if (node.nodeType !== 1 && node.nodeType !== 9) return;
    if (node.nodeType === 1) {
      const closest = node.closest?.(CANDIDATE_ROOT_QUERY);
      if (closest && this.#root.contains(closest)) this.#pending.add(closest);
    }
    for (const element of node.querySelectorAll?.(CANDIDATE_ROOT_QUERY) ?? []) {
      this.#pending.add(element);
    }
  }

  #queueFlush() {
    if (this.#pending.size === 0) return;
    this.#scheduler
      .schedule({
        key: FLUSH_KEY,
        phase: 'READ',
        priority: 'VISIBLE',
        signal: this.#routeContext.signal,
        task: () => this.#flush(),
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') this.#eventBus.emit('scanner:error', { error });
      });
  }

  #flush() {
    const elements = [...this.#pending];
    this.#pending.clear();
    for (const element of elements) {
      if (element.isConnected === false) continue;
      try {
        const candidate = this.#fetlife.createCandidate(element, this.#routeContext.route);
        if (!candidate) continue;
        const nextFingerprint = fingerprint(candidate);
        if (this.#fingerprints.get(element) === nextFingerprint) continue;
        this.#fingerprints.set(element, nextFingerprint);
        this.#dispatch(candidate);
      } catch (error) {
        this.#eventBus.emit('scanner:parse-error', { error, element });
      }
    }
  }

  #dispatch(candidate) {
    for (const subscriber of [...(this.#subscribers.get(candidate.kind) ?? [])]) {
      try {
        subscriber(candidate);
      } catch (error) {
        this.#eventBus.emit('scanner:subscriber-error', {
          candidateKind: candidate.kind,
          error,
        });
      }
    }
    this.#eventBus.emit('scanner:candidate', candidate);
  }
}
