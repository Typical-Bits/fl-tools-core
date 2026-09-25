import { satisfies, valid, validRange } from 'semver';
import { CompatibilityError, ContractError } from '../errors.js';

const PRODUCT_TYPES = new Set(['edition', 'module']);
const PRODUCT_CHANNELS = new Set(['stable', 'beta', 'development']);

function normalizeManifest(manifest) {
  if (!manifest || typeof manifest !== 'object')
    throw new ContractError('Product manifest is required');
  const requiredStrings = ['id', 'name', 'type', 'version', 'channel', 'coreCompatibility'];
  for (const field of requiredStrings) {
    if (typeof manifest[field] !== 'string' || manifest[field].length === 0) {
      throw new ContractError(`Product manifest ${field} is required`);
    }
  }
  if (!PRODUCT_TYPES.has(manifest.type)) throw new ContractError('Invalid product type');
  if (!PRODUCT_CHANNELS.has(manifest.channel)) throw new ContractError('Invalid product channel');
  if (!valid(manifest.version)) throw new ContractError('Invalid product version');
  if (!validRange(manifest.coreCompatibility))
    throw new ContractError('Invalid Core compatibility range');
  for (const field of ['permissions', 'features']) {
    if (!Array.isArray(manifest[field]))
      throw new ContractError(`Product manifest ${field} is required`);
  }
  return Object.freeze({
    ...manifest,
    features: Object.freeze([...manifest.features]),
    permissions: Object.freeze([...manifest.permissions]),
  });
}

/** Validates Core compatibility before retaining a product registration. */
export class ProductRegistry {
  #coreVersion;
  #products = new Map();

  constructor({ coreVersion }) {
    if (!valid(coreVersion)) throw new ContractError('Core version must be valid SemVer');
    this.#coreVersion = coreVersion;
  }

  register(manifest) {
    const stored = normalizeManifest(manifest);
    if (this.#products.has(stored.id))
      throw new ContractError('Duplicate product id', { id: stored.id });
    if (!satisfies(this.#coreVersion, stored.coreCompatibility)) {
      throw new CompatibilityError('Product is incompatible with the active Core', {
        coreVersion: this.#coreVersion,
        productId: stored.id,
        requiredRange: stored.coreCompatibility,
      });
    }
    this.#products.set(stored.id, stored);
    return stored;
  }

  get(id) {
    return this.#products.get(id);
  }

  list() {
    return Object.freeze([...this.#products.values()]);
  }

  unregister(id) {
    return this.#products.delete(id);
  }
}
