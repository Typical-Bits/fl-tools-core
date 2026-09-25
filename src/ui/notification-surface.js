import { ContractError } from '../errors.js';

export class NotificationSurface {
  #announcer;
  #controls;
  #document;
  #enabled = true;
  #notifications;
  #root;
  #unsubscribe;

  constructor({ announcer, controls, document, notifications }) {
    if (!document?.createElement || !controls || !announcer || !notifications?.subscribe) {
      throw new ContractError('Notification surface dependencies are required');
    }
    this.#announcer = announcer;
    this.#controls = controls;
    this.#document = document;
    this.#notifications = notifications;
  }

  mount() {
    if (this.#unsubscribe) return;
    this.#unsubscribe = this.#notifications.subscribe((item) => this.#render(item));
  }

  destroy() {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#root?.remove();
    this.#root = undefined;
  }

  setEnabled(enabled) {
    this.#enabled = enabled === true;
    if (!this.#enabled) {
      this.#root?.remove();
      this.#root = undefined;
      return;
    }
    this.#render(this.#notifications.active());
  }

  #render(item) {
    if (!this.#enabled) return;
    if (!item) {
      this.#root?.remove();
      this.#root = undefined;
      return;
    }
    const root = this.#root ?? this.#document.createElement('aside');
    root.className = 'flt-root flt-notice';
    root.dataset.fltOwner = 'core';
    root.dataset.fltPriority = item.priority.toLowerCase();
    root.setAttribute('role', ['CRITICAL', 'HIGH'].includes(item.priority) ? 'alert' : 'status');
    root.replaceChildren();
    const heading = this.#document.createElement('h2');
    heading.className = 'flt-notice-title';
    heading.textContent = item.title;
    const message = this.#document.createElement('p');
    message.className = 'flt-notice-message';
    message.textContent = item.message;
    root.append(heading, message);
    if (item.bullets.length) {
      const list = this.#document.createElement('ul');
      list.className = 'flt-notice-list';
      for (const bullet of item.bullets) {
        const row = this.#document.createElement('li');
        row.textContent = bullet;
        list.append(row);
      }
      root.append(list);
    }
    const actions = this.#document.createElement('div');
    actions.className = 'flt-notice-actions';
    for (const action of item.actions) {
      actions.append(
        this.#controls.button({
          label: action.label,
          onClick: () => Promise.resolve(action.handler()).catch(() => undefined),
          variant: action.label === 'Update' ? 'primary' : 'default',
        }),
      );
    }
    const dismiss = this.#controls.button({
      label: 'Dismiss',
      onClick: () => this.#notifications.dismiss(item.id),
    });
    actions.append(dismiss);
    root.append(actions);
    if (!root.isConnected) this.#document.body.append(root);
    this.#root = root;
    this.#announcer.announce(`${item.title}. ${item.message}`, {
      priority: ['CRITICAL', 'HIGH'].includes(item.priority) ? 'assertive' : 'polite',
    });
  }
}
