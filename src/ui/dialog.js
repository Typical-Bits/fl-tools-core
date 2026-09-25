import { ContractError } from '../errors.js';

const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export class DialogManager {
  #active;
  #controls;
  #document;
  #idFactory;

  constructor({ document, controls, idFactory = () => crypto.randomUUID() }) {
    if (!document?.createElement || !controls)
      throw new ContractError('Dialog dependencies are required');
    this.#document = document;
    this.#controls = controls;
    this.#idFactory = idFactory;
  }

  open({ title, description = '', content, actions = [], dismissible = true }) {
    if (!title || !Array.isArray(actions) || actions.length === 0) {
      throw new ContractError('Dialog requires a title and actions');
    }
    if (this.#active) throw new ContractError('Only one Core dialog may be open at a time');
    const returnFocus = this.#document.activeElement;
    const backdrop = this.#document.createElement('div');
    backdrop.className = 'flt-root flt-dialog-backdrop';
    const dialog = this.#document.createElement('section');
    dialog.className = 'flt-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const titleId = `flt-dialog-title-${this.#idFactory()}`;
    const titleNode = this.#document.createElement('h2');
    titleNode.className = 'flt-dialog-title';
    titleNode.id = titleId;
    titleNode.textContent = title;
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.append(titleNode);
    if (description) {
      const descriptionId = `flt-dialog-description-${this.#idFactory()}`;
      const descriptionNode = this.#document.createElement('p');
      descriptionNode.className = 'flt-dialog-description';
      descriptionNode.id = descriptionId;
      descriptionNode.textContent = description;
      dialog.setAttribute('aria-describedby', descriptionId);
      dialog.append(descriptionNode);
    }
    if (content) dialog.append(content);
    const actionRow = this.#document.createElement('div');
    actionRow.className = 'flt-dialog-actions';
    let settle;
    const result = new Promise((resolve) => {
      settle = resolve;
    });
    const inerted = [...this.#document.body.children].map((node) => ({ inert: node.inert, node }));
    const close = (value) => {
      if (this.#active?.backdrop !== backdrop) return;
      backdrop.remove();
      for (const entry of inerted) entry.node.inert = entry.inert;
      this.#active = undefined;
      if (returnFocus?.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus();
      settle(value);
    };
    for (const action of actions) {
      const button = this.#controls.button({
        label: action.label,
        onClick: () => close(action.value),
        variant: action.variant,
      });
      if (action.autofocus) button.dataset.fltAutofocus = 'true';
      actionRow.append(button);
    }
    dialog.append(actionRow);
    backdrop.append(dialog);
    for (const entry of inerted) entry.node.inert = true;
    this.#document.body.append(backdrop);
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && dismissible) {
        event.preventDefault();
        close(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE)];
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && this.#document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && this.#document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    backdrop.addEventListener('keydown', onKeyDown);
    this.#active = { backdrop, close };
    (
      dialog.querySelector('[data-flt-autofocus="true"]') ??
      dialog.querySelector(FOCUSABLE) ??
      dialog
    ).focus();
    return Object.freeze({ close, element: backdrop, result });
  }

  confirm({
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
  }) {
    return this.open({
      actions: [
        { label: cancelLabel, value: false },
        {
          autofocus: !destructive,
          label: confirmLabel,
          value: true,
          variant: destructive ? 'danger' : 'primary',
        },
      ],
      description,
      dismissible: true,
      title,
    }).result.then(Boolean);
  }

  destroy() {
    this.#active?.close(null);
  }
}
