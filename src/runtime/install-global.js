import { ContractError } from '../errors.js';
import { CoreRuntime } from './core-runtime.js';

const CORE_BRAND = Symbol.for('typicalbits.fl-tools.core');

/**
 * Installs the sole narrow window.FLTools discovery surface before async startup.
 * A second installer always reuses the first surface and never hot-swaps Core.
 */
export function installCore(globalObject, options) {
  if (!globalObject || typeof globalObject !== 'object') {
    throw new ContractError('A browser-like global object is required');
  }
  if (globalObject.FLTools !== undefined) {
    if (globalObject.FLTools?.[CORE_BRAND] !== true) {
      throw new ContractError(
        'window.FLTools is occupied by an unknown runtime. Update all installed FL Tools editions and reload every FetLife tab.',
      );
    }
    return Object.freeze({ reused: true, surface: globalObject.FLTools });
  }

  const runtime = new CoreRuntime({
    ...options,
    document: options.document ?? globalObject.document,
    indexedDB: options.indexedDB ?? globalObject.indexedDB,
    localStorage: options.localStorage ?? globalObject.localStorage,
    observerFactory:
      options.observerFactory ??
      (globalObject.MutationObserver
        ? (callback) => new globalObject.MutationObserver(callback)
        : undefined),
    sessionStorage: options.sessionStorage ?? globalObject.sessionStorage,
    window: options.window ?? (globalObject.history ? globalObject : undefined),
  });
  const ready = runtime.start();
  const surface = Object.freeze({
    [CORE_BRAND]: true,
    getStatus: () => runtime.getStatus(),
    registerProduct: async (registration) => {
      await ready;
      return runtime.registerProduct(registration);
    },
    version: options.version,
    whenReady: ready.then(() => runtime.getStatus()),
  });

  Object.defineProperty(globalObject, 'FLTools', {
    configurable: false,
    enumerable: false,
    value: surface,
    writable: false,
  });
  return Object.freeze({ ready, reused: false, runtime, surface });
}

export { CORE_BRAND };
