import { ContractError } from '../errors.js';

const VALID_KINDS = new Set(['feature', 'module']);

function assertComponent(component, kind) {
  if (!component || typeof component !== 'object')
    throw new ContractError(`${kind} must be an object`);
  if (typeof component.id !== 'string' || !component.id.includes('.')) {
    throw new ContractError(`${kind} id must be a namespaced string`, { id: component.id });
  }
  if (typeof component.owner !== 'string' || component.owner.length === 0) {
    throw new ContractError(`${kind} owner is required`, { id: component.id });
  }
  if (component.init !== undefined && typeof component.init !== 'function') {
    throw new ContractError(`${kind} init must be a function`, { id: component.id });
  }
  if (component.destroy !== undefined && typeof component.destroy !== 'function') {
    throw new ContractError(`${kind} destroy must be a function`, { id: component.id });
  }
  for (const field of ['permissions', 'dependencies']) {
    if (component[field] !== undefined && !Array.isArray(component[field])) {
      throw new ContractError(`${kind} ${field} must be an array`, { id: component.id });
    }
  }
}

/** Registry for declarative feature or module contracts. */
export class ComponentRegistry {
  #components = new Map();
  #kind;
  #locked = false;

  constructor(kind) {
    if (!VALID_KINDS.has(kind))
      throw new ContractError('Unknown component registry kind', { kind });
    this.#kind = kind;
  }

  register(component) {
    if (this.#locked) throw new ContractError(`${this.#kind} registry is locked`);
    assertComponent(component, this.#kind);
    if (this.#components.has(component.id)) {
      throw new ContractError(`Duplicate ${this.#kind} id`, { id: component.id });
    }
    const stored = Object.freeze({
      ...component,
      dependencies: Object.freeze([...(component.dependencies ?? [])]),
      permissions: Object.freeze([...(component.permissions ?? [])]),
    });
    this.#components.set(stored.id, stored);
    return stored;
  }

  get(id) {
    return this.#components.get(id);
  }

  has(id) {
    return this.#components.has(id);
  }

  unregister(id) {
    if (this.#locked) throw new ContractError(`${this.#kind} registry is locked`);
    return this.#components.delete(id);
  }

  list({ owner } = {}) {
    return Object.freeze(
      [...this.#components.values()].filter((component) => !owner || component.owner === owner),
    );
  }

  validateDependencies() {
    for (const component of this.#components.values()) {
      for (const dependency of component.dependencies) {
        if (!this.#components.has(dependency)) {
          throw new ContractError(`Missing ${this.#kind} dependency`, {
            dependency,
            id: component.id,
          });
        }
      }
    }
  }

  lock() {
    this.validateDependencies();
    this.#locked = true;
  }
}
