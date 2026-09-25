import { ContractError } from '../errors.js';

export const NOTIFICATION_PRIORITIES = Object.freeze({
  CRITICAL: 4,
  HIGH: 3,
  LOW: 1,
  NORMAL: 2,
});

const KINDS = new Set([
  'COMPATIBILITY',
  'DEGRADED_MODE',
  'FEATURE_DISCOVERY',
  'FEATURE_FAILURE',
  'POST_UPDATE',
  'SYSTEM',
  'UPDATE_AVAILABLE',
]);

export class NotificationCenter {
  #clock;
  #items = new Map();
  #listeners = new Set();

  constructor({ clock = Date.now } = {}) {
    this.#clock = clock;
  }

  upsert({ id, kind, priority = 'NORMAL', title, message, bullets = [], actions = [] }) {
    if (
      !/^[a-z][a-z0-9.-]+$/.test(id ?? '') ||
      !KINDS.has(kind) ||
      !(priority in NOTIFICATION_PRIORITIES) ||
      typeof title !== 'string' ||
      !title ||
      typeof message !== 'string' ||
      !Array.isArray(bullets) ||
      bullets.length > 4 ||
      !Array.isArray(actions) ||
      actions.length > 2
    ) {
      throw new ContractError('Notification contract is invalid');
    }
    const previous = this.#items.get(id);
    const item = Object.freeze({
      actions: Object.freeze(
        actions.map((action) => {
          if (!action?.label || typeof action.handler !== 'function') {
            throw new ContractError('Notification actions require a label and handler');
          }
          return Object.freeze({ label: String(action.label), handler: action.handler });
        }),
      ),
      bullets: Object.freeze(bullets.map(String)),
      createdAt: previous?.createdAt ?? this.#clock(),
      id,
      kind,
      message,
      priority,
      title,
      updatedAt: this.#clock(),
    });
    this.#items.set(id, item);
    this.#emit();
    return item;
  }

  dismiss(id) {
    const removed = this.#items.delete(id);
    if (removed) this.#emit();
    return removed;
  }

  active() {
    return this.list()[0] ?? null;
  }

  list() {
    return Object.freeze(
      [...this.#items.values()].sort(
        (a, b) =>
          NOTIFICATION_PRIORITIES[b.priority] - NOTIFICATION_PRIORITIES[a.priority] ||
          a.createdAt - b.createdAt,
      ),
    );
  }

  subscribe(listener) {
    if (typeof listener !== 'function')
      throw new ContractError('Notification listener is required');
    this.#listeners.add(listener);
    listener(this.active());
    return () => this.#listeners.delete(listener);
  }

  clear() {
    if (this.#items.size === 0) return;
    this.#items.clear();
    this.#emit();
  }

  #emit() {
    const active = this.active();
    for (const listener of this.#listeners) listener(active);
  }
}
