import { ContractError, LifecycleError } from '../errors.js';

const STATES = Object.freeze({
  CREATED: 'CREATED',
  STARTING: 'STARTING',
  ACTIVE: 'ACTIVE',
  STOPPING: 'STOPPING',
  STOPPED: 'STOPPED',
  FAILED: 'FAILED',
});

function dependencyOrder(components) {
  const byId = new Map(components.map((component) => [component.id, component]));
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];

  const visit = (component) => {
    if (visited.has(component.id)) return;
    if (visiting.has(component.id)) {
      throw new LifecycleError('Circular component dependency', { id: component.id });
    }
    visiting.add(component.id);
    for (const dependencyId of component.dependencies) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        throw new LifecycleError('Missing component dependency', {
          dependency: dependencyId,
          id: component.id,
        });
      }
      visit(dependency);
    }
    visiting.delete(component.id);
    visited.add(component.id);
    ordered.push(component);
  };

  for (const component of components) visit(component);
  return ordered;
}

/** Owns ordered initialization, rollback, abort, and reverse teardown. */
export class Lifecycle {
  #active = [];
  #contextFor;
  #errorBoundary;
  #runController;
  #state = STATES.CREATED;

  constructor({ contextFor, errorBoundary }) {
    if (typeof contextFor !== 'function') throw new ContractError('Lifecycle requires contextFor');
    if (!errorBoundary) throw new ContractError('Lifecycle requires an error boundary');
    this.#contextFor = contextFor;
    this.#errorBoundary = errorBoundary;
  }

  get state() {
    return this.#state;
  }

  async start(components) {
    if (![STATES.CREATED, STATES.STOPPED].includes(this.#state)) {
      throw new LifecycleError('Lifecycle cannot start from its current state', {
        state: this.#state,
      });
    }
    this.#state = STATES.STARTING;
    this.#runController = new AbortController();
    const ordered = dependencyOrder(components);

    try {
      for (const component of ordered) {
        const context = this.#contextFor(component, this.#runController.signal);
        if (component.init) await component.init(context);
        this.#active.push({ component, context });
      }
      this.#state = STATES.ACTIVE;
    } catch (error) {
      this.#state = STATES.FAILED;
      this.#runController.abort(error);
      await this.#teardownActive('rollback');
      throw new LifecycleError('Component initialization failed', {
        cause: error,
        state: this.#state,
      });
    }
  }

  async stop(reason = 'stop') {
    if (this.#state === STATES.STOPPED) return;
    if (![STATES.ACTIVE, STATES.FAILED, STATES.STARTING].includes(this.#state)) {
      throw new LifecycleError('Lifecycle cannot stop from its current state', {
        state: this.#state,
      });
    }
    this.#state = STATES.STOPPING;
    this.#runController?.abort(reason);
    await this.#teardownActive(reason);
    this.#state = STATES.STOPPED;
  }

  async #teardownActive(reason) {
    for (const { component, context } of this.#active.reverse()) {
      if (!component.destroy) continue;
      await this.#errorBoundary.capture(component.id, 'destroy', () =>
        component.destroy({ ...context, reason }),
      );
    }
    this.#active = [];
  }
}

export { STATES as LIFECYCLE_STATES };
