import { ContractError } from '../errors.js';
import { attachHelp, CONTROL_HELP } from './help.js';

function appendText(document, element, text) {
  element.textContent = String(text);
  return element;
}

export class ControlFactory {
  #document;
  #idFactory;

  constructor({ document, idFactory = () => crypto.randomUUID() }) {
    if (!document?.createElement || typeof idFactory !== 'function') {
      throw new ContractError('Control factory requires a document and id factory');
    }
    this.#document = document;
    this.#idFactory = idFactory;
  }

  button({
    label,
    description = CONTROL_HELP[label],
    onClick,
    variant = 'default',
    disabled = false,
    type = 'button',
  }) {
    if (!label) throw new ContractError('Button label is required');
    const button = appendText(this.#document, this.#document.createElement('button'), label);
    button.className = 'flt-button';
    button.type = type;
    button.disabled = Boolean(disabled);
    button.dataset.fltVariant = variant;
    attachHelp(button, description);
    if (onClick) button.addEventListener('click', onClick);
    return button;
  }

  toggle({
    label,
    description = CONTROL_HELP[label] ?? '',
    checked = false,
    disabled = false,
    onChange,
  }) {
    if (!label) throw new ContractError('Toggle label is required');
    const row = this.#document.createElement('div');
    row.className = 'flt-toggle-row';
    const text = appendText(this.#document, this.#document.createElement('span'), label);
    const labelId = `flt-label-${this.#idFactory()}`;
    text.className = 'flt-label';
    text.id = labelId;
    if (description) {
      text.classList.add('flt-has-tooltip');
      text.dataset.fltTip = String(description);
      text.setAttribute('aria-description', String(description));
      text.tabIndex = 0;
    }
    const control = this.#document.createElement('button');
    control.className = 'flt-toggle';
    control.type = 'button';
    control.setAttribute('role', 'switch');
    control.setAttribute('aria-labelledby', labelId);
    control.setAttribute('aria-checked', String(Boolean(checked)));
    control.disabled = Boolean(disabled);
    attachHelp(control, description);
    const indicator = this.#document.createElement('span');
    indicator.className = 'flt-toggle-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    control.append(indicator);
    const setChecked = (next, { notify = false } = {}) => {
      const value = Boolean(next);
      control.setAttribute('aria-checked', String(value));
      if (notify) onChange?.(value);
      return value;
    };
    control.addEventListener('click', () => {
      if (!control.disabled)
        setChecked(control.getAttribute('aria-checked') !== 'true', { notify: true });
    });
    row.append(text, control);
    return Object.freeze({
      element: row,
      get checked() {
        return control.getAttribute('aria-checked') === 'true';
      },
      setChecked,
      switch: control,
    });
  }

  textField({
    label,
    description = CONTROL_HELP[label],
    value = '',
    placeholder = '',
    type = 'text',
    onInput,
  }) {
    if (!label || !['text', 'search', 'number', 'url'].includes(type)) {
      throw new ContractError('Text field requires a label and supported type');
    }
    const field = this.#document.createElement('label');
    field.className = 'flt-field';
    const text = appendText(this.#document, this.#document.createElement('span'), label);
    text.className = 'flt-label';
    const input = this.#document.createElement('input');
    input.className = 'flt-input';
    input.type = type;
    input.value = String(value);
    input.placeholder = String(placeholder);
    attachHelp(input, description);
    attachHelp(text, description);
    if (onInput) input.addEventListener('input', () => onInput(input.value));
    field.append(text, input);
    return Object.freeze({ element: field, input });
  }

  search(options) {
    return this.textField({ ...options, type: 'search' });
  }

  themeSwatches({ label, description = CONTROL_HELP[label] ?? '', options = [], value, onChange }) {
    if (!label || !Array.isArray(options) || options.length === 0) {
      throw new ContractError('Theme swatches require a label and options');
    }
    const field = this.#document.createElement('div');
    field.className = 'flt-field flt-theme-field';
    const text = appendText(this.#document, this.#document.createElement('span'), label);
    text.className = 'flt-label';
    const group = this.#document.createElement('div');
    group.className = 'flt-theme-swatches';
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', label);
    attachHelp(text, description);
    attachHelp(group, description);
    const buttons = [];
    const paint = (next) => {
      for (const button of buttons) {
        const on = button.dataset.fltTheme === next;
        button.classList.toggle('is-on', on);
        button.setAttribute('aria-checked', String(on));
      }
    };
    for (const option of options) {
      if (!option?.value || !option?.label || typeof option.swatch !== 'string') {
        throw new ContractError('Theme swatch options require value, label, and swatch');
      }
      const button = this.#document.createElement('button');
      button.type = 'button';
      button.className = 'flt-theme-swatch';
      button.dataset.fltTheme = option.value;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-label', option.label);
      button.title = option.label;
      button.setAttribute('style', `background:${option.swatch}`);
      button.addEventListener('click', () => {
        paint(option.value);
        onChange?.(option.value);
      });
      buttons.push(button);
      group.append(button);
    }
    paint(value);
    field.append(text, group);
    return Object.freeze({
      element: field,
      get value() {
        return buttons.find((button) => button.classList.contains('is-on'))?.dataset.fltTheme;
      },
    });
  }

  chipField({
    label,
    description = CONTROL_HELP[label] ??
      'Add a value with Enter or comma. Remove active chips with ×; select a saved chip to reuse it.',
    values = [],
    savedValues = [],
    placeholder = 'Add a value',
    onChange,
    onForget,
  }) {
    if (!label || !Array.isArray(values) || !Array.isArray(savedValues)) {
      throw new ContractError('Chip field requires a label and value arrays');
    }
    const normalize = (items) => [
      ...new Set(items.map((item) => String(item).trim()).filter(Boolean)),
    ];
    const active = normalize(values);
    const saved = normalize(savedValues).filter(
      (item) => !active.some((value) => value.toLocaleLowerCase() === item.toLocaleLowerCase()),
    );
    const field = this.#document.createElement('div');
    field.className = 'flt-chip-field';
    const text = appendText(this.#document, this.#document.createElement('span'), label);
    text.className = 'flt-label';
    const input = this.#document.createElement('input');
    input.className = 'flt-input flt-chip-input';
    input.type = 'text';
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', label);
    attachHelp(input, description);
    attachHelp(text, description);
    const add = () => {
      const additions = input.value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (!additions.length) return;
      input.value = '';
      onChange?.(normalize([...active, ...additions]));
    };
    input.addEventListener('keydown', (event) => {
      if (!['Enter', ','].includes(event.key)) return;
      event.preventDefault();
      add();
    });
    input.addEventListener('blur', add);
    const list = this.#document.createElement('div');
    list.className = 'flt-chip-row';
    const chipValues = [...active, ...saved];
    const renderChip = (value, { inactive = false } = {}) => {
      const chip = this.#document.createElement('span');
      chip.className = `flt-chip${inactive ? ' flt-chip-saved' : ''}`;
      const chipText = appendText(this.#document, this.#document.createElement('span'), value);
      chip.append(chipText);
      if (inactive) {
        chip.tabIndex = 0;
        chip.title = `Reuse ${value}`;
        const reuse = () => onChange?.(normalize([...active, value]));
        chip.addEventListener('click', reuse);
        chip.addEventListener('keydown', (event) => {
          if (!['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          reuse();
        });
      }
      const remove = this.#document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `${inactive ? 'Forget' : 'Remove'} ${value}`);
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        if (inactive) onForget?.(value);
        else onChange?.(active.filter((item) => item !== value));
      });
      chip.append(remove);
      return chip;
    };
    for (const value of active) list.append(renderChip(value));
    for (const value of saved) list.append(renderChip(value, { inactive: true }));
    if (chipValues.length > 6) {
      const search = this.#document.createElement('input');
      search.className = 'flt-input flt-chip-search';
      search.type = 'search';
      search.placeholder = `Search ${label.toLocaleLowerCase()}`;
      search.setAttribute('aria-label', `Search ${label}`);
      search.addEventListener('input', () => {
        const query = search.value.trim().toLocaleLowerCase();
        for (const chip of list.querySelectorAll('.flt-chip')) {
          chip.hidden = Boolean(query) && !chip.textContent.toLocaleLowerCase().includes(query);
        }
      });
      field.append(text, input, search, list);
    } else field.append(text, input, list);
    return Object.freeze({ element: field, input });
  }

  list({ items, emptyMessage, renderItem }) {
    if (!Array.isArray(items) || typeof renderItem !== 'function' || !emptyMessage) {
      throw new ContractError('List requires items, renderer, and empty message');
    }
    if (items.length === 0) {
      const empty = appendText(this.#document, this.#document.createElement('div'), emptyMessage);
      empty.className = 'flt-empty';
      empty.setAttribute('role', 'status');
      return empty;
    }
    const list = this.#document.createElement('ul');
    list.className = 'flt-list';
    for (const item of items) {
      const row = this.#document.createElement('li');
      row.className = 'flt-list-item';
      const content = renderItem(item);
      if (content instanceof this.#document.defaultView.Node) row.append(content);
      else row.textContent = String(content ?? '');
      list.append(row);
    }
    return list;
  }
}
