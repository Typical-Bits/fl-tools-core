import { attachHelp, CONTROL_HELP } from './help.js';

const KEY = 'fl-tools.ui-preferences';
const defaults = {
  reduceMotion: false,
  notifications: true,
  menuWidth: 'full',
  themeSkin: 'default',
};
function normalize(value = {}) {
  return {
    reduceMotion: value?.reduceMotion === true,
    notifications: value?.notifications !== false,
    menuWidth: ['full', 'compact', 'narrow'].includes(value?.menuWidth) ? value.menuWidth : 'full',
    themeSkin: ['gradient', 'pride'].includes(value?.themeSkin) ? 'pride' : 'default',
  };
}
export class SharedPreferences {
  #document;
  #controls;
  #apply;
  #value;
  #views = new Set();
  #stored = false;
  #storageListener;
  constructor({ document, controls, apply }) {
    this.#document = document;
    this.#controls = controls;
    this.#apply = apply;
    this.#value = { ...defaults };
    try {
      const raw = document.defaultView.localStorage.getItem(KEY);
      if (raw) {
        this.#value = normalize(JSON.parse(raw));
        this.#stored = true;
      }
    } catch {
      /* Use session defaults when storage is unavailable. */
    }
    this.#storageListener = (event) => {
      if (event.key !== KEY && event.key !== null) return;
      try {
        this.#value = normalize(event.newValue ? JSON.parse(event.newValue) : defaults);
        this.#stored = Boolean(event.newValue);
        this.apply();
      } catch {
        /* Ignore malformed external preferences. */
      }
    };
    document.defaultView?.addEventListener('storage', this.#storageListener);
  }
  get value() {
    return { ...this.#value };
  }
  adopt(value) {
    if (!this.#stored) {
      this.#value = normalize({ ...this.#value, ...value });
      this.#save();
      this.apply();
    }
  }
  #save() {
    this.#stored = true;
    try {
      this.#document.defaultView.localStorage.setItem(KEY, JSON.stringify(this.#value));
      this.#stored = true;
      return true;
    } catch {
      return false;
    }
  }
  apply() {
    this.#document.documentElement.classList.toggle('flt-reduce-motion', this.#value.reduceMotion);
    this.#apply(this.value);
    for (const view of this.#views) view.refresh();
  }
  mount() {
    const root = this.#document.createElement('div');
    root.className = 'flt-appearance-settings';
    const status = this.#document.createElement('p');
    status.setAttribute('role', 'status');
    const fields = [];
    const change = (key, value) => {
      this.#value = normalize({ ...this.#value, [key]: value });
      const saved = this.#save();
      this.apply();
      status.textContent = saved
        ? 'Saved for all FL Tools menus.'
        : 'Applied for this page; browser storage is unavailable.';
    };
    for (const [key, label] of [
      ['reduceMotion', 'Reduce Motion'],
      ['notifications', 'Notifications'],
    ]) {
      const control = this.#controls.toggle({
        label,
        checked: this.#value[key],
        onChange: (value) => change(key, value),
      });
      root.append(control.element);
      fields.push(() =>
        control.element
          .querySelector('[role="switch"]')
          .setAttribute('aria-checked', String(this.#value[key])),
      );
    }
    for (const [key, label, options] of [
      [
        'themeSkin',
        'Menu theme',
        [
          ['default', 'Default'],
          ['pride', 'Pride'],
        ],
      ],
      [
        'menuWidth',
        'Menu width',
        [
          ['full', 'Full'],
          ['compact', 'Compact'],
          ['narrow', 'Narrow'],
        ],
      ],
    ]) {
      const field = this.#document.createElement('label');
      field.className = 'flt-field';
      const text = this.#document.createElement('span');
      text.className = 'flt-label';
      text.textContent = label;
      const select = this.#document.createElement('select');
      select.className = 'flt-input';
      attachHelp(text, CONTROL_HELP[label]);
      attachHelp(select, CONTROL_HELP[label]);
      for (const [value, label] of options) {
        const option = this.#document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.append(option);
      }
      select.value = this.#value[key];
      select.addEventListener('change', () => change(key, select.value));
      fields.push(() => {
        select.value = this.#value[key];
      });
      field.append(text, select);
      root.append(field);
    }
    root.append(status);
    const view = { refresh: () => fields.forEach((refresh) => refresh()) };
    this.#views.add(view);
    return { element: root, destroy: () => this.#views.delete(view) };
  }
  stop() {
    this.#document.defaultView?.removeEventListener('storage', this.#storageListener);
    this.#views.clear();
    this.#document.documentElement.classList.remove('flt-reduce-motion');
  }
}
