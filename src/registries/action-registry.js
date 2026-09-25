import { ContractError } from '../errors.js';

const ACTION_ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;

/** Owner-scoped command routing for product UI entry points and contextual actions. */
export class ActionRegistry {
  #actions = new Map();

  register({ handler, id, label, owner }) {
    if (
      !ACTION_ID.test(id ?? '') ||
      !/^[a-z][a-z0-9-]*$/.test(owner ?? '') ||
      !id.startsWith(`${owner}.`) ||
      typeof label !== 'string' ||
      !label.trim() ||
      typeof handler !== 'function'
    ) {
      throw new ContractError('Action requires an owner-scoped id, label, and handler');
    }
    if (this.#actions.has(id)) throw new ContractError('Duplicate action id', { id });
    const action = Object.freeze({ handler, id, label: label.trim(), owner });
    this.#actions.set(id, action);
    return () => this.#actions.delete(id);
  }

  async invoke(id, payload) {
    const action = this.#actions.get(id);
    if (!action) throw new ContractError('Unknown action id', { id });
    return action.handler(payload);
  }

  list({ owner } = {}) {
    return Object.freeze(
      [...this.#actions.values()]
        .filter((action) => !owner || action.owner === owner)
        .map(({ id, label, owner: actionOwner }) =>
          Object.freeze({ id, label, owner: actionOwner }),
        ),
    );
  }

  removeOwner(owner) {
    let removed = 0;
    for (const [id, action] of this.#actions) {
      if (action.owner !== owner) continue;
      this.#actions.delete(id);
      removed += 1;
    }
    return removed;
  }

  clear() {
    this.#actions.clear();
  }
}
