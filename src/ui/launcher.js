import { ContractError } from '../errors.js';
import { applyChromeContract, CHROME_CONTRACT } from './chrome-contract.js';

const RESERVED = new Set(['core', 'devkit']);
const ICON_PROTOCOLS = new Set(['blob:', 'chrome-extension:', 'data:', 'https:', 'moz-extension:']);
const VIEWPORT_EDGE = 8;

export function launcherSize(handle) {
  const rect = handle?.getBoundingClientRect?.() ?? { width: 0, height: 0 };
  return {
    width: Math.max(
      rect.width || 0,
      handle?.offsetWidth || 0,
      CHROME_CONTRACT.artwork.launcherSize,
    ),
    height: Math.max(
      rect.height || 0,
      handle?.offsetHeight || 0,
      CHROME_CONTRACT.artwork.launcherSize,
    ),
  };
}

export function clampLauncherOrigin(view, origin, size) {
  const width = Math.max(1, size?.width || 0);
  const height = Math.max(1, size?.height || 0);
  const viewWidth = view?.innerWidth || 0;
  const viewHeight = view?.innerHeight || 0;
  return {
    x: Math.max(
      VIEWPORT_EDGE,
      Math.min(origin.x, Math.max(VIEWPORT_EDGE, viewWidth - width - VIEWPORT_EDGE)),
    ),
    y: Math.max(
      VIEWPORT_EDGE,
      Math.min(origin.y, Math.max(VIEWPORT_EDGE, viewHeight - height - VIEWPORT_EDGE)),
    ),
  };
}

export function dockIsLeft(document) {
  return document?.documentElement?.classList?.contains('flt-basic-launcher-left') === true;
}

function isSafeIconUrl(value, baseUrl) {
  try {
    return ICON_PROTOCOLS.has(new URL(value, baseUrl).protocol);
  } catch {
    return false;
  }
}

export function ensureUpdateCluster(document) {
  let cluster = document.querySelector('.flt-cluster');
  if (!cluster) {
    cluster = document.createElement('div');
    cluster.className = 'flt-root flt-cluster';
    document.body?.append(cluster);
  }
  let progressStack = cluster.querySelector('.flt-progress-stack');
  if (!progressStack) {
    progressStack = document.createElement('div');
    progressStack.className = 'flt-progress-stack';
    cluster.append(progressStack);
  }
  return { cluster, progressStack };
}

export class LauncherManager {
  #cluster;
  #document;
  #entries = new Map();
  #observer;
  #root;
  #position;
  #cleanup;
  #suppressClick = false;
  #reposition;
  #updateAvailable = new Map();

  constructor({ document }) {
    if (!document?.createElement) throw new ContractError('Launcher manager requires a document');
    this.#document = document;
  }

  register({ productId, name, iconUrl, onActivate }) {
    if (
      !/^[a-z][a-z0-9-]*$/.test(productId ?? '') ||
      RESERVED.has(productId) ||
      typeof name !== 'string' ||
      name.length === 0 ||
      typeof iconUrl !== 'string' ||
      !isSafeIconUrl(iconUrl, this.#document.baseURI) ||
      typeof onActivate !== 'function'
    ) {
      throw new ContractError('Launcher requires a user-facing product and approved icon asset');
    }
    if (this.#entries.has(productId))
      throw new ContractError('Launcher product is already registered');
    const root = this.#mount();
    const button = this.#document.createElement('button');
    button.className = 'flt-launcher-button';
    button.type = 'button';
    button.dataset.fltProduct = productId;
    button.dataset.fltLauncherSlot = String(this.#entries.size);
    button.dataset.userscriptLauncher = 'userscript-launcher-v1';
    applyChromeContract(button);
    button.setAttribute('aria-label', name);
    button.setAttribute('aria-expanded', 'false');
    const icon = this.#document.createElement('img');
    icon.className = 'flt-launcher-icon';
    icon.alt = '';
    icon.src = iconUrl;
    button.append(icon);
    icon.draggable = false;
    button.addEventListener('click', (event) => {
      if (this.#suppressClick && event.detail !== 0) {
        event.preventDefault();
        return;
      }
      onActivate({ productId });
    });
    root.append(button);
    this.#entries.set(productId, { button, name });
    this.#applyUpdateAvailable(productId);
    this.#reposition?.();
    return Object.freeze({ button, unregister: () => this.unregister(productId) });
  }

  setActive(productId) {
    if (productId !== null && !this.#entries.has(productId)) {
      throw new ContractError('Unknown launcher product', { productId });
    }
    for (const [id, entry] of this.#entries) {
      entry.button.setAttribute('aria-expanded', String(id === productId));
    }
  }

  has(productId) {
    return this.#entries.has(productId);
  }

  setUpdateAvailable(productId, version) {
    if (version) this.#updateAvailable.set(productId, version);
    else this.#updateAvailable.delete(productId);
    this.#applyUpdateAvailable(productId);
  }

  resetPosition() {
    this.#position = undefined;
    for (const property of ['left', 'right', 'top', 'bottom'])
      this.#cluster?.style.removeProperty(property);
    const view = this.#document.defaultView;
    try {
      view.localStorage.removeItem('flt-launcher-position');
    } catch {
      /* Optional persistence. */
    }
    view.dispatchEvent(new view.Event('flt:launcher-moved'));
  }

  unregister(productId) {
    const entry = this.#entries.get(productId);
    if (!entry) return false;
    entry.button.remove();
    this.#entries.delete(productId);
    this.#updateAvailable.delete(productId);
    if (this.#entries.size === 0) this.#teardownHost();
    return true;
  }

  destroy() {
    this.#cleanup?.();
    this.#entries.clear();
    this.#updateAvailable.clear();
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#teardownHost();
  }

  #teardownHost() {
    this.#cleanup?.();
    this.#cleanup = undefined;
    this.#root?.remove();
    this.#root = undefined;
    if (this.#cluster && !this.#cluster.querySelector('.flt-panel')) this.#cluster.remove();
    this.#cluster = undefined;
  }

  #mount() {
    if (this.#root?.isConnected) return this.#root;
    const { cluster, progressStack } = ensureUpdateCluster(this.#document);
    cluster.dataset.fltOwner = 'core';
    const root = this.#root ?? this.#document.createElement('nav');
    root.className = 'flt-root flt-launcher';
    root.dataset.fltOwner = 'core';
    root.setAttribute('aria-label', 'FL Tools products');
    if (root.parentElement !== progressStack) progressStack.append(root);
    if (!cluster.isConnected) this.#document.body.append(cluster);
    this.#cluster = cluster;
    this.#root = root;
    this.#cleanup?.();
    this.#enableDrag(root, cluster);
    const Observer = this.#document.defaultView?.MutationObserver;
    if (Observer && !this.#observer) {
      this.#observer = new Observer(() => {
        if (this.#entries.size === 0 || !this.#document.body) return;
        if (this.#cluster?.isConnected && this.#root?.isConnected) return;
        const mounted = ensureUpdateCluster(this.#document);
        this.#cluster = mounted.cluster;
        this.#cluster.dataset.fltOwner = 'core';
        if (!this.#cluster.isConnected) this.#document.body.append(this.#cluster);
        if (this.#root && this.#root.parentElement !== mounted.progressStack) {
          mounted.progressStack.append(this.#root);
        }
      });
      this.#observer.observe(this.#document, { childList: true, subtree: true });
    }
    return root;
  }

  #enableDrag(handle, cluster) {
    const view = this.#document.defaultView;
    const abort = new view.AbortController();
    const options = { signal: abort.signal };
    this.#cleanup = () => abort.abort();
    let drag;
    const persist = () => {
      try {
        view.localStorage.setItem('flt-launcher-position', JSON.stringify(this.#position));
      } catch {
        /* Optional persistence. */
      }
    };
    const place = (x, y) => {
      const size = launcherSize(handle);
      this.#position = clampLauncherOrigin(view, { x, y }, size);
      Object.assign(cluster.style, {
        left: `${this.#position.x}px`,
        top: `${this.#position.y}px`,
        right: 'auto',
        bottom: 'auto',
      });
      persist();
      view.dispatchEvent(new view.Event('flt:launcher-moved'));
    };
    this.#reposition = () => {
      if (this.#position) place(this.#position.x, this.#position.y);
    };
    try {
      const saved = JSON.parse(view.localStorage.getItem('flt-launcher-position'));
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) place(saved.x, saved.y);
    } catch {
      /* Storage may be disabled; dragging still works for this page. */
    }
    handle.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button !== 0) return;
        this.#suppressClick = false;
        const rect = handle.getBoundingClientRect();
        drag = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: rect.left,
          top: rect.top,
          moved: false,
        };
      },
      options,
    );
    view.addEventListener(
      'pointermove',
      (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 5) return;
        drag.moved = true;
        this.#suppressClick = true;
        handle.dataset.dragging = 'true';
        handle.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        place(drag.left + dx, drag.top + dy);
      },
      options,
    );
    const end = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.moved) persist();
      if (handle.hasPointerCapture?.(event.pointerId))
        handle.releasePointerCapture(event.pointerId);
      delete handle.dataset.dragging;
      drag = undefined;
    };
    view.addEventListener('pointerup', end, options);
    view.addEventListener('pointercancel', end, options);
    view.addEventListener(
      'resize',
      () => {
        if (this.#position) place(this.#position.x, this.#position.y);
      },
      options,
    );
    handle.addEventListener(
      'keydown',
      (event) => {
        if (
          !event.altKey ||
          !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
        )
          return;
        event.preventDefault();
        const rect = handle.getBoundingClientRect();
        place(
          rect.left + (event.key === 'ArrowRight' ? 16 : event.key === 'ArrowLeft' ? -16 : 0),
          rect.top + (event.key === 'ArrowDown' ? 16 : event.key === 'ArrowUp' ? -16 : 0),
        );
      },
      options,
    );
  }

  #applyUpdateAvailable(productId) {
    const entry = this.#entries.get(productId);
    if (!entry) return;
    const version = this.#updateAvailable.get(productId);
    entry.button.classList.toggle('update-available', Boolean(version));
    entry.button.setAttribute(
      'aria-label',
      version ? `${entry.name} · Update v${version} Available` : entry.name,
    );
  }
}
