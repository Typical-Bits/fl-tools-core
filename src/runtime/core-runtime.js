import { CrossTabCoordinator } from '../cross-tab/coordinator.js';
import { EventBus } from '../events/event-bus.js';
import { ContractError, LifecycleError } from '../errors.js';
import { RouteMonitor, PAGE_NAVIGATION_EVENTS } from '../fetlife/route-monitor.js';
import { FetLifeService } from '../fetlife/service.js';
import { ComponentRegistry } from '../registries/component-registry.js';
import { ActionRegistry } from '../registries/action-registry.js';
import { ProductRegistry } from '../registries/product-registry.js';
import { DiagnosticsService } from '../platform/diagnostics.js';
import { HealthMonitor } from '../platform/health.js';
import { RuntimeMetrics } from '../platform/runtime-metrics.js';
import { NotificationCenter } from '../platform/notifications.js';
import { UpdateManager } from '../platform/updates.js';
import { Scanner } from '../scanner/scanner.js';
import { Scheduler } from '../scheduler/scheduler.js';
import { AccountScope } from '../storage/account-scope.js';
import { StorageDatabase } from '../storage/database.js';
import { LegacyCleanup } from '../storage/legacy-cleanup.js';
import { StorageLease } from '../storage/lease.js';
import { CoreStorage } from '../storage/service.js';
import { CoreUI } from '../ui/core-ui.js';
import { EditionOwnership } from './edition-ownership.js';
import { ErrorBoundary } from './error-boundary.js';

const RUNTIME_STATES = Object.freeze({
  CREATED: 'CREATED',
  STARTING: 'STARTING',
  ACTIVE: 'ACTIVE',
  STOPPING: 'STOPPING',
  STOPPED: 'STOPPED',
  FAILED: 'FAILED',
});

/** Private shared Core service container. */
export class CoreRuntime {
  #accountId;
  #accountScope;
  #actions = new ActionRegistry();
  #crossTab;
  #document;
  #editionOwnership;
  #diagnostics;
  #conflicts = [];
  #errors = [];
  #eventBus;
  #fetlife;
  #health;
  #features = new ComponentRegistry('feature');
  #modules = new ComponentRegistry('module');
  #metrics;
  #products;
  #notifications;
  #pageAbort;
  #routeMonitor;
  #scanner;
  #scheduler;
  #storage;
  #storageDatabase;
  #storageState = 'UNAVAILABLE';
  #ui;
  #updates;
  #state = RUNTIME_STATES.CREATED;
  #version;

  constructor({
    version,
    accountId = null,
    channelFactory,
    document,
    idFactory,
    indexedDB = globalThis.indexedDB,
    localStorage,
    maxScheduled = 1000,
    observerFactory,
    sessionStorage,
    window,
  }) {
    this.#version = version;
    this.#accountId = accountId;
    this.#products = new ProductRegistry({ coreVersion: version });
    this.#health = new HealthMonitor();
    this.#metrics = new RuntimeMetrics({
      estimateStorage: window?.navigator?.storage?.estimate?.bind(window.navigator.storage),
    });
    this.#notifications = new NotificationCenter();
    this.#diagnostics = new DiagnosticsService({
      contextSnapshot: () => this.#diagnosticContext(),
      healthSnapshot: () => this.#health.snapshot(),
      version,
    });
    this.#updates = new UpdateManager({ notifications: this.#notifications });
    this.#eventBus = new EventBus({
      onListenerError: (error, context) => this.#recordError(error, 'event-listener', context),
    });
    this.#editionOwnership = new EditionOwnership({
      onChange: (snapshot) => this.#eventBus.emit('edition:ownership-changed', snapshot),
    });
    this.#scheduler = new Scheduler({
      maxQueued: maxScheduled,
      metric: (metric) => {
        this.#metrics.recordScheduler(metric);
        if (metric.type === 'task') {
          this.#health.record({ durationMs: metric.durationMs, kind: 'TASK' });
        }
      },
    });
    this.#fetlife = new FetLifeService({ idFactory });
    this.errorBoundary = new ErrorBoundary({
      report: ({ error, operation, owner }) => this.#recordError(error, operation, { owner }),
    });
    if (document?.createElement) {
      this.#ui = new CoreUI({
        diagnostics: this.#diagnostics,
        document,
        health: this.#health,
        idFactory,
        notifications: this.#notifications,
        updates: this.#updates,
        version,
      });
    }
    this.#health.subscribe((snapshot) => {
      if (!snapshot.degraded) return;
      this.#notifications.upsert({
        actions: this.#ui
          ? [{ handler: () => this.#ui.openDiagnostics(), label: 'Diagnostics' }]
          : [],
        bullets: snapshot.reasons.slice(0, 4),
        id: 'core.degraded-mode',
        kind: 'DEGRADED_MODE',
        message: 'Some riskier FL Tools behavior is paused. FetLife remains available.',
        priority: 'HIGH',
        title: 'FL Tools is in Degraded Mode',
      });
    });
    this.#diagnostics.registerSelfTest({
      category: 'CORE_RUNTIME',
      id: 'core.runtime',
      run: () => ({
        message: `Core runtime is ${this.#state}.`,
        result: this.#state === RUNTIME_STATES.ACTIVE ? 'PASS' : 'WARN',
      }),
    });
    this.#diagnostics.registerSelfTest({
      category: 'PERFORMANCE',
      id: 'core.performance',
      run: async () => {
        const metrics = await this.#metrics.refreshStorage();
        return {
          details: metrics,
          message: metrics.violations.length
            ? `${metrics.violations.length} runtime performance budget ${metrics.violations.length === 1 ? 'signal' : 'signals'} observed.`
            : 'Runtime performance budgets are within observed limits.',
          result: metrics.violations.length ? 'WARN' : 'PASS',
        };
      },
    });
    this.#diagnostics.registerSelfTest({
      category: 'STORAGE',
      id: 'core.storage',
      run: () => ({
        message: `Storage state is ${this.#storageState}.`,
        result: !this.#storage
          ? 'NOT_APPLICABLE'
          : this.#storageState === 'READY'
            ? 'PASS'
            : 'WARN',
      }),
    });
    this.#diagnostics.registerSelfTest({
      category: 'CORE_RUNTIME',
      id: 'core.products',
      run: () => {
        const products = this.#products.list();
        return {
          details: { productIds: products.map(({ id }) => id) },
          message: `${products.length} product${products.length === 1 ? '' : 's'} registered.`,
          result: products.length > 0 ? 'PASS' : 'WARN',
        };
      },
    });
    this.#diagnostics.registerSelfTest({
      category: 'PARSER',
      id: 'core.route',
      run: () => {
        const route = this.#routeMonitor?.context?.route;
        return {
          details: {
            confidence: route?.confidence ?? 'unavailable',
            kind: route?.kind ?? 'unavailable',
          },
          message: route ? `Current route is ${route.kind}.` : 'Route context is unavailable.',
          result: route ? 'PASS' : 'NOT_APPLICABLE',
        };
      },
    });
    this.#diagnostics.registerSelfTest({
      category: 'CORE_RUNTIME',
      id: 'core.scanner',
      run: () => ({
        message: this.#scanner ? 'Page scanner is available.' : 'Page scanner is unavailable.',
        result: this.#scanner ? 'PASS' : 'NOT_APPLICABLE',
      }),
    });
    this.#crossTab = new CrossTabCoordinator({
      channelFactory,
      eventBus: this.#eventBus,
      getAccountId: () => this.#accountId,
      idFactory,
    });
    this.#accountScope = new AccountScope({
      accountId,
      onChange: ({ accountId: nextAccountId, previousAccountId }) => {
        this.#accountId = nextAccountId;
        this.#eventBus.emit('account:changed', {
          accountId: nextAccountId,
          previousAccountId,
        });
        this.#eventBus.emit('account:cache-invalidated', { previousAccountId });
      },
    });
    if (indexedDB?.open) {
      this.#storageDatabase = new StorageDatabase({ indexedDB });
      this.#storage = new CoreStorage({
        accountScope: this.#accountScope,
        crossTab: this.#crossTab,
        database: this.#storageDatabase,
        events: this.#eventBus,
        idFactory,
      });
      this.legacyCleanup = new LegacyCleanup({
        database: this.#storageDatabase,
        idFactory,
        localStorage,
        sessionStorage,
      });
      this.storageLease = new StorageLease({ database: this.#storageDatabase, idFactory });
      this.#storageState = 'CLOSED';
    }
    if (window) {
      this.#routeMonitor = new RouteMonitor({
        fetlife: this.#fetlife,
        onChange: (current, previous) => {
          if (this.#document) this.#accountScope.refresh(this.#document);
          this.#eventBus.emit('route:changed', { current, previous });
          if (this.#scanner && previous) this.#scanner.setRoute(current);
        },
        window,
      });
    }
    if (document && (observerFactory || globalThis.MutationObserver)) {
      this.#scanner = new Scanner({
        eventBus: this.#eventBus,
        fetlife: this.#fetlife,
        observerFactory,
        scheduler: this.#scheduler,
      });
      this.#document = document;
      this.#eventBus.on('scanner:mutated', () => this.#accountScope.refresh(this.#document));
    }
  }

  get services() {
    return Object.freeze({
      account: this.#accountScope,
      actions: this.#actions,
      crossTab: this.#crossTab,
      diagnostics: this.#diagnostics,
      editionOwnership: this.#editionOwnership,
      events: this.#eventBus,
      fetlife: this.#fetlife,
      routes: this.#routeMonitor,
      scanner: this.#scanner,
      scheduler: this.#scheduler,
      health: this.#health,
      notifications: this.#notifications,
      storage: this.#storage,
      storageLease: this.storageLease,
      ui: this.#ui,
      updates: this.#updates,
    });
  }

  #diagnosticContext() {
    const routeContext = this.#routeMonitor?.context;
    const navigator = this.#document?.defaultView?.navigator;
    const count = (selector) => this.#document?.querySelectorAll(selector).length ?? 0;
    return {
      pluginStatus: this.#productStatus(),
      conflicts: [...this.#conflicts],
      page: {
        // Counts and capabilities only: never page text, identities, search terms, or markup.
        viewport: {
          width: this.#document?.defaultView?.innerWidth,
          height: this.#document?.defaultView?.innerHeight,
        },
        selectorCounts: Object.entries(this.#fetlife.selectors)
          .filter(([, selectors]) => Array.isArray(selectors))
          .map(([family, selectors]) => ({ family, count: count(selectors.join(',')) })),
        presentation: {
          hidden: count('.flt-state-hidden'),
          dimmed: count('.flt-state-dimmed'),
          highlighted: count('.flt-state-highlighted'),
          blurred: count('.flt-media-blurred'),
        },
        images: {
          total: count('img'),
          failed: [...(this.#document?.images ?? [])].filter(
            (image) => image.complete && image.naturalWidth === 0,
          ).length,
        },
        nativeNextAvailable: count('a[rel="next"]') > 0,
      },
      interface: [...(this.#document?.querySelectorAll('.flt-panel') ?? [])].map((panel) => ({
        productId: panel.dataset.fltProduct,
        installedVersion: panel.dataset.fltVersion,
        visible: !panel.hidden,
        browseStatus: panel.dataset.fltBrowseStatus ?? null,
        openMenus: [...panel.querySelectorAll('.flt-tool-header[aria-expanded="true"]')].map(
          (node) => node.id,
        ),
        switchCount: panel.querySelectorAll('[role="switch"]').length,
        switchesOn: panel.querySelectorAll('[role="switch"][aria-checked="true"]').length,
        disabledControls: panel.querySelectorAll(':disabled').length,
        controlsWithHelp: panel.querySelectorAll('[data-flt-tip]').length,
      })),
      components: {
        actions: this.#actions.list(),
        features: this.#features.list().map(({ id, owner }) => ({ id, owner })),
        modules: this.#modules.list().map(({ id, owner }) => ({ id, owner })),
      },
      environment: {
        documentState: this.#document?.readyState ?? 'unavailable',
        language: navigator?.language ?? 'unavailable',
        platform: navigator?.platform ?? 'unavailable',
        userAgent: navigator?.userAgent ?? 'unavailable',
        visibilityState: this.#document?.visibilityState ?? 'unavailable',
      },
      products: this.#products.list().map(({ channel, features, id, name, type, version }) => ({
        channel,
        declaredFeatures: features,
        id,
        name,
        type,
        version,
      })),
      runtime: {
        boundaryErrorCount: this.#errors.length,
        editionOwner: this.#editionOwnership.snapshot().owner,
        identityState: this.#accountId ? 'SCOPED' : 'UNAVAILABLE',
        scannerState: this.#scanner ? 'AVAILABLE' : 'UNAVAILABLE',
        schedulerQueued: this.#scheduler.size,
        state: this.#state,
        storageState: this.#storageState,
        performance: this.#metrics.snapshot(),
      },
      route: {
        confidence: routeContext?.route?.confidence ?? 'unavailable',
        kind: routeContext?.route?.kind ?? 'unavailable',
        revision: routeContext?.revision ?? 0,
      },
    };
  }

  async start() {
    if (this.#state !== RUNTIME_STATES.CREATED) {
      throw new LifecycleError('Core runtime can only be started once', { state: this.#state });
    }
    this.#state = RUNTIME_STATES.STARTING;
    this.#diagnostics.captureConsole(this.#document?.defaultView);
    try {
      this.#crossTab.start();
      this.#ui?.start();
      if (this.#storage) {
        try {
          await this.#storage.open();
          this.#storageState = 'READY';
        } catch (error) {
          this.#storageState = error?.code ?? 'STORAGE_RECOVERY_REQUIRED';
          this.#recordError(error, 'storage-open');
        }
      }
      await this.#metrics.refreshStorage();
      if (!this.#accountId && this.#document) this.#accountScope.refresh(this.#document);
      const routeContext = this.#routeMonitor?.start();
      if (this.#scanner && routeContext) {
        this.#scanner.start({ root: this.#document, routeContext });
      }
      this.#bindPageSurvival();
      this.#state = RUNTIME_STATES.ACTIVE;
      this.#eventBus.emit('runtime:active', { version: this.#version });
    } catch (error) {
      this.#state = RUNTIME_STATES.FAILED;
      this.#diagnostics.stopCapture();
      this.#recordError(error, 'runtime-start');
      throw error;
    }
  }

  registerProduct({ manifest, features = [], modules = [], updateProvider }) {
    if (this.#state !== RUNTIME_STATES.ACTIVE) {
      throw new LifecycleError('Products can register only while Core is active', {
        state: this.#state,
      });
    }
    let product;
    try {
      product = this.#products.register(manifest);
    } catch (error) {
      this.#conflicts.push({
        productId: manifest?.id ?? 'unknown',
        code: error.code ?? 'REGISTRATION_FAILED',
        reason: error.message,
      });
      if (this.#conflicts.length > 25) this.#conflicts.shift();
      this.#ui?.announcer.announce('FL Tools product conflict. Open diagnostics for details.', {
        priority: 'assertive',
      });
      this.#recordError(error, 'product-registration', { productId: manifest?.id ?? null });
      throw error;
    }
    const registeredFeatures = [];
    const registeredModules = [];
    let unregisterUpdate;
    try {
      for (const feature of features) {
        this.#assertOwnedComponent(product, feature, 'feature');
        this.#features.register(feature);
        registeredFeatures.push(feature.id);
      }
      for (const module of modules) {
        this.#assertOwnedComponent(product, module, 'module');
        this.#modules.register(module);
        registeredModules.push(module.id);
      }
      if (updateProvider) {
        unregisterUpdate = this.#updates.registerProduct({
          channel: product.channel,
          name: product.name,
          productId: product.id,
          provider: updateProvider,
          version: product.version,
        });
      }
    } catch (error) {
      unregisterUpdate?.();
      for (const id of registeredFeatures) this.#features.unregister(id);
      for (const id of registeredModules) this.#modules.unregister(id);
      this.#products.unregister(product.id);
      this.#conflicts.push({
        productId: product.id,
        code: error.code ?? 'REGISTRATION_FAILED',
        reason: error.message,
      });
      if (this.#conflicts.length > 25) this.#conflicts.shift();
      this.#recordError(error, 'product-registration', { productId: product.id });
      throw error;
    }
    this.#eventBus.emit('product:registered', { productId: product.id });
    const registration = {
      coreVersion: this.#version,
      productId: product.id,
      status: 'REGISTERED',
    };
    Object.defineProperty(registration, 'capabilities', {
      enumerable: false,
      value: this.#productCapabilities(product),
    });
    if (updateProvider) {
      registration.checkForUpdates = (options) => this.#updates.check(product.id, options);
      registration.recordInstalled = ({ version, channel = product.channel, summary }) =>
        this.#updates.recordInstalled({
          channel,
          name: product.name,
          productId: product.id,
          summary,
          version,
        });
    }
    return Object.freeze(registration);
  }

  setAccountId(accountId) {
    this.#accountScope.set(accountId);
  }

  #productStatus() {
    const products = this.#products.list();
    const owner = this.#editionOwnership.snapshot().owner;
    const ids = new Set(['basic', 'pro', 'compass', ...products.map((product) => product.id)]);
    return [
      { id: 'core', version: this.#version, status: this.#state },
      ...[...ids].map((id) => {
        const product = products.find((product) => product.id === id);
        return {
          id,
          version: product?.version ?? null,
          status: !product
            ? 'NOT_DETECTED'
            : product.type === 'edition'
              ? owner === id
                ? 'ACTIVE'
                : 'STANDBY'
              : 'REGISTERED',
          compatible: product ? true : null,
        };
      }),
    ];
  }

  getStatus() {
    return Object.freeze({
      editionOwner: this.#editionOwnership.snapshot().owner,
      errors: this.#errors.length,
      plugins: this.#productStatus(),
      conflicts: [...this.#conflicts],
      products: this.#products.list().map(({ id, version }) => ({ id, version })),
      state: this.#state,
      storage: this.#storageState,
      health: this.#health.snapshot().state,
      version: this.#version,
    });
  }

  async stop(reason = 'stop') {
    if ([RUNTIME_STATES.STOPPING, RUNTIME_STATES.STOPPED].includes(this.#state)) return;
    this.#state = RUNTIME_STATES.STOPPING;
    this.#diagnostics.stopCapture();
    this.#eventBus.emit('runtime:stopping', { reason });
    this.#scanner?.stop();
    this.#pageAbort?.abort();
    this.#pageAbort = undefined;
    this.#routeMonitor?.stop(reason);
    try {
      await this.#editionOwnership.stop();
    } catch (error) {
      this.#recordError(error, 'edition-ownership-stop');
    }
    this.#ui?.stop();
    this.#actions.clear();
    this.#crossTab.stop();
    this.#storage?.close();
    if (this.#storage) this.#storageState = 'CLOSED';
    this.#scheduler.destroy(reason);
    this.#eventBus.destroy();
    this.#state = RUNTIME_STATES.STOPPED;
  }

  #bindPageSurvival() {
    const document = this.#document;
    const view = document?.defaultView;
    if (!document || !view?.addEventListener) return;
    let queued = false;
    const settle = () => {
      if (this.#state !== RUNTIME_STATES.ACTIVE || queued) return;
      queued = true;
      const run = () => {
        queued = false;
        if (this.#state !== RUNTIME_STATES.ACTIVE) return;
        this.#ui?.restoreChrome();
        this.#accountScope.refresh(document);
        this.#scanner?.refresh(document);
        this.#eventBus.emit('page:settled', { url: document.URL });
      };
      if (typeof view.queueMicrotask === 'function') view.queueMicrotask(run);
      else view.Promise.resolve().then(run);
    };
    this.#pageAbort = new view.AbortController();
    const options = { signal: this.#pageAbort.signal };
    for (const type of PAGE_NAVIGATION_EVENTS) {
      view.addEventListener(type, settle, options);
      document.addEventListener(type, settle, options);
    }
  }

  #assertOwnedComponent(product, component, kind) {
    if (component?.owner !== product.id) {
      throw new ContractError(`Registered ${kind} owner must match product id`, {
        owner: component?.owner,
        productId: product.id,
      });
    }
    if (kind === 'feature' && !product.features.includes(component.id)) {
      throw new ContractError('Feature is not declared by the product manifest', {
        featureId: component.id,
        productId: product.id,
      });
    }
    const undeclared = (component.permissions ?? []).filter(
      (permission) => !product.permissions.includes(permission),
    );
    if (undeclared.length > 0) {
      throw new ContractError(`${kind} requests undeclared permissions`, {
        id: component.id,
        permissions: undeclared,
      });
    }
  }

  #productCapabilities(product) {
    const allowed = new Set(product.permissions);
    const capabilities = {};
    capabilities.products = Object.freeze({ snapshot: () => this.getStatus() });
    if (allowed.has('account')) {
      capabilities.account = Object.freeze({
        assertCurrent: (token) => this.#accountScope.assertCurrent(token),
        capture: () => this.#accountScope.capture(),
      });
    }
    if (allowed.has('events')) capabilities.events = this.#eventBus;
    if (allowed.has('actions')) {
      capabilities.actions = Object.freeze({
        invoke: (id, payload) => this.#actions.invoke(id, payload),
        list: () => this.#actions.list(),
        register: ({ handler, id, label }) =>
          this.#actions.register({ handler, id, label, owner: product.id }),
      });
    }
    if (allowed.has('crossTab')) capabilities.crossTab = this.#crossTab;
    if (allowed.has('routes')) capabilities.routes = this.#routeMonitor;
    if (allowed.has('scanner')) capabilities.scanner = this.#scanner;
    if (allowed.has('storage')) capabilities.storage = this.#storage;
    if (allowed.has('ui')) capabilities.ui = this.#ui;
    if (allowed.has('diagnostics')) capabilities.diagnostics = this.#diagnostics;
    if (allowed.has('editionOwnership') && product.type === 'edition') {
      capabilities.editionOwnership = Object.freeze({
        claim: (hooks) => this.#editionOwnership.claim(product.id, hooks),
        snapshot: () => this.#editionOwnership.snapshot(),
      });
    }
    return Object.freeze(capabilities);
  }

  #recordError(error, operation, context = {}) {
    this.#errors.push(
      Object.freeze({
        error: error instanceof Error ? error : new Error(String(error)),
        operation,
        context,
        timestamp: Date.now(),
      }),
    );
    if (this.#errors.length > 100) this.#errors.shift();
    const category = operation.includes('storage')
      ? 'STORAGE'
      : operation.includes('parser')
        ? 'PARSER'
        : operation.includes('product')
          ? 'COMPATIBILITY'
          : operation.includes('runtime')
            ? 'CORE_RUNTIME'
            : 'FEATURE';
    const severity = operation === 'runtime-start' ? 'FATAL' : 'ERROR';
    const code =
      error?.code && /^[A-Z][A-Z0-9_]{2,79}$/.test(error.code)
        ? error.code
        : `${category}_${operation.replaceAll('-', '_').toUpperCase()}_FAILED`;
    this.#diagnostics.record({
      category,
      code,
      details: context,
      error,
      message: error instanceof Error ? error.message : String(error),
      productId: context.productId ?? null,
      severity,
    });
    this.#metrics.recordError(code);
    const kind =
      category === 'STORAGE'
        ? 'STORAGE'
        : category === 'PARSER'
          ? 'PARSER'
          : category === 'COMPATIBILITY'
            ? 'COMPATIBILITY'
            : 'FEATURE';
    this.#health.record({ code, kind, outcome: 'FAIL' });
    if (severity === 'FATAL') this.#health.enterDegraded(code);
  }
}

export { RUNTIME_STATES };
