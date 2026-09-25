import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { AccessibleAnnouncer } from '../src/ui/announcer.js';
import { ControlFactory } from '../src/ui/controls.js';
import { CoreUI } from '../src/ui/core-ui.js';
import { DialogManager } from '../src/ui/dialog.js';
import { LauncherManager } from '../src/ui/launcher.js';
import { ProductShell } from '../src/ui/shell.js';
import { ThemeEngine, UI_Z_INDEX } from '../src/ui/theme.js';

test('launcher drag persists, clamps to viewport, and does not activate a product', () => {
  const { document, dom } = environment();
  const launcher = new LauncherManager({ document });
  let activated = 0;
  const { button } = launcher.register({
    productId: 'pro',
    name: 'Pro',
    iconUrl: 'data:image/png;base64,AA==',
    onActivate: () => activated++,
  });
  const cluster = document.querySelector('.flt-cluster');
  const handle = document.querySelector('.flt-launcher');
  handle.getBoundingClientRect = () => ({ left: 20, top: 20, width: 104, height: 104 });
  const pointer = (target, type, x, y) => {
    const event = new dom.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
    });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    target.dispatchEvent(event);
  };
  pointer(button, 'pointerdown', 30, 30);
  pointer(dom.window, 'pointermove', 130, 150);
  pointer(dom.window, 'pointerup', 130, 150);
  button.dispatchEvent(new dom.window.MouseEvent('click', { detail: 1 }));
  assert.equal(activated, 0);
  assert.equal(cluster.style.left, 'auto');
  assert.equal(cluster.style.right, '8px');
  assert.equal(cluster.style.top, '140px');
  assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('flt-launcher-position')), {
    x: dom.window.innerWidth - 112,
    y: 140,
  });
  pointer(button, 'pointerdown', 130, 150);
  pointer(dom.window, 'pointerup', 130, 150);
  button.dispatchEvent(new dom.window.MouseEvent('click', { detail: 1 }));
  assert.equal(activated, 1);
  launcher.destroy();
  const next = new LauncherManager({ document });
  next.register({
    productId: 'pro',
    name: 'Pro',
    iconUrl: 'data:image/png;base64,AA==',
    onActivate() {},
  });
  assert.equal(document.querySelector('.flt-cluster').style.left, 'auto');
  assert.equal(document.querySelector('.flt-cluster').style.right, '8px');
  next.resetPosition();
  assert.equal(document.querySelector('.flt-cluster').style.left, '');
  const nextCluster = document.querySelector('.flt-cluster');
  const nextGrid = document.querySelector('.flt-launcher');
  nextGrid.getBoundingClientRect = () => ({ left: 20, top: 20, width: 104, height: 104 });
  pointer(nextGrid, 'pointerdown', 20, 20);
  pointer(dom.window, 'pointermove', 5000, 5000);
  pointer(dom.window, 'pointerup', 5000, 5000);
  assert.equal(nextCluster.style.left, 'auto');
  assert.equal(nextCluster.style.right, '8px');
  assert.equal(nextCluster.style.top, `${dom.window.innerHeight - 112}px`);
  next.destroy();
  dom.window.close();
});

function stubBox(node, { height, left = 0, top = 0, width }) {
  Object.defineProperty(node, 'offsetWidth', { configurable: true, get: () => width });
  Object.defineProperty(node, 'offsetHeight', { configurable: true, get: () => height });
  Object.defineProperty(node, 'clientHeight', { configurable: true, get: () => height });
  node.getBoundingClientRect = () => ({
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  });
}

async function flushLayout(view) {
  const tick = () =>
    new Promise((resolve) => {
      if (typeof view.requestAnimationFrame === 'function') {
        view.requestAnimationFrame(() => resolve());
        return;
      }
      view.setTimeout(resolve, 0);
    });
  await tick();
  await tick();
}

test('open menus stay inside the window while normalizing launcher origin to the right edge', async () => {
  const { document, dom } = environment();
  Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 900 });
  Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 500 });
  const origin = { x: 788, y: 420 };
  dom.window.localStorage.setItem('flt-launcher-position', JSON.stringify(origin));
  const launcher = new LauncherManager({ document });
  launcher.register({
    iconUrl: 'data:image/png;base64,AA==',
    name: 'Pro',
    onActivate() {},
    productId: 'pro',
  });
  const cluster = document.querySelector('.flt-cluster');
  const handle = document.querySelector('.flt-launcher');
  stubBox(handle, { height: 48, left: origin.x, top: origin.y, width: 104 });
  const shell = new ProductShell({
    document,
    navigation: [{ id: 'browse', label: 'Browse' }],
    productId: 'pro',
    productName: 'FL Tools Pro',
    version: '0.0.0',
  });
  stubBox(shell.element, { height: 360, left: origin.x, top: origin.y, width: 312 });
  shell.open();
  await flushLayout(dom.window);
  const top = Number.parseFloat(cluster.style.top);
  const maxHeight = Number.parseFloat(shell.element.style.maxHeight);
  assert.ok(top >= 8, `cluster top ${cluster.style.top} must stay in view`);
  assert.ok(top + 48 <= 500 - 8);
  assert.ok(Number.isFinite(maxHeight) && maxHeight <= 500 - 40);
  assert.equal(cluster.style.left, 'auto');
  assert.equal(cluster.style.right, `${900 - (origin.x + 104)}px`);
  assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('flt-launcher-position')), {
    x: 844,
    y: origin.y,
  });
  shell.destroy();
  launcher.destroy();
  dom.window.close();
});

test('open menus remain attached to the right edge after launcher drag', async () => {
  const { document, dom } = environment();
  Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 900 });
  Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 500 });
  const origin = { x: 8, y: 420 };
  dom.window.localStorage.setItem('flt-launcher-position', JSON.stringify(origin));
  const launcher = new LauncherManager({ document });
  launcher.register({
    iconUrl: 'data:image/png;base64,AA==',
    name: 'Basic',
    onActivate() {},
    productId: 'basic',
  });
  const cluster = document.querySelector('.flt-cluster');
  const handle = document.querySelector('.flt-launcher');
  stubBox(handle, { height: 48, left: origin.x, top: origin.y, width: 104 });
  const shell = new ProductShell({
    document,
    navigation: [{ id: 'browse', label: 'Browse' }],
    productId: 'basic',
    productName: 'FL Tools Basic',
    version: '0.0.0',
  });
  stubBox(shell.element, { height: 360, left: origin.x, top: origin.y, width: 312 });
  shell.open();
  await flushLayout(dom.window);
  const right = Number.parseFloat(cluster.style.right);
  const menuLeft = dom.window.innerWidth - right - shell.element.offsetWidth;
  assert.ok(menuLeft >= 8, `menu left ${menuLeft}px must stay in view`);
  assert.equal(right, 8);
  assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('flt-launcher-position')), {
    x: 844,
    y: origin.y,
  });
  shell.destroy();
  launcher.destroy();
  dom.window.close();
});

test('legacy left-dock state cannot move launchers away from the right edge', async () => {
  const { document, dom } = environment();
  Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 900 });
  Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 500 });
  document.documentElement.classList.add('flt-basic-launcher-left');
  const origin = { x: 788, y: 420 };
  dom.window.localStorage.setItem('flt-launcher-position', JSON.stringify(origin));
  const launcher = new LauncherManager({ document });
  launcher.register({
    iconUrl: 'data:image/png;base64,AA==',
    name: 'Basic',
    onActivate() {},
    productId: 'basic',
  });
  const cluster = document.querySelector('.flt-cluster');
  const handle = document.querySelector('.flt-launcher');
  stubBox(handle, { height: 48, left: origin.x, top: origin.y, width: 104 });
  const shell = new ProductShell({
    document,
    navigation: [{ id: 'browse', label: 'Browse' }],
    productId: 'basic',
    productName: 'FL Tools Basic',
    version: '0.0.0',
  });
  stubBox(shell.element, { height: 360, left: origin.x, top: origin.y, width: 312 });
  shell.open();
  await flushLayout(dom.window);
  assert.equal(cluster.style.left, 'auto');
  assert.equal(cluster.style.right, '8px');
  assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('flt-launcher-position')), {
    x: 844,
    y: origin.y,
  });
  shell.destroy();
  launcher.destroy();
  dom.window.close();
});

function environment() {
  const dom = new JSDOM(
    '<!doctype html><html><head></head><body><button id="native">Native</button></body></html>',
    {
      url: 'https://fetlife.com/home',
    },
  );
  let sequence = 0;
  return {
    document: dom.window.document,
    dom,
    idFactory: () => `ui-${++sequence}`,
  };
}

test('ThemeEngine mounts one scoped stylesheet, owns z-index, and safely resets tokens', () => {
  const { document } = environment();
  const theme = new ThemeEngine({ document });
  const style = theme.mount();
  assert.equal(theme.mount(), style);
  assert.match(style.textContent, /\.flt-panel/);
  assert.match(style.textContent, /--flt-launcher-size: 48px/);
  assert.match(style.textContent, /grid-template-columns: repeat\(2, var\(--flt-launcher-size\)\)/);
  assert.match(style.textContent, /\.flt-launcher \{[\s\S]*?direction: rtl;/);
  assert.match(style.textContent, /\.flt-launcher-button \{[\s\S]*?direction: ltr;/);
  assert.match(
    style.textContent,
    /\.flt-header-icon \{[\s\S]*?border: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none/,
  );
  assert.match(style.textContent, /\.flt-launcher-button\.update-available::after/);
  assert.match(style.textContent, /\.flt-cluster \{[\s\S]*?bottom: 12px/);
  assert.match(style.textContent, /\.flt-cluster \{[\s\S]*?flex-direction: column-reverse/);
  assert.match(style.textContent, /\.flt-cluster\.open-up \{ flex-direction: column; \}/);
  assert.match(style.textContent, /\.flt-update-head \{[\s\S]*?padding-right: 36px/);
  assert.match(
    style.textContent,
    /\.flt-update-dismiss \{[\s\S]*?background: var\(--flt-surface\)/,
  );
  assert.doesNotMatch(style.textContent, /\.flt-update-dismiss \{[^}]*border-color: transparent/);
  assert.match(style.textContent, /\.flt-update-notice \{[\s\S]*?position: relative/);
  assert.match(
    style.textContent,
    /\.flt-update-kicker \{[\s\S]*?color: var\(--flt-accent-secondary, var\(--flt-accent\)\)/,
  );
  assert.match(style.textContent, /--flt-menu-width-full: 312px/);
  assert.match(style.textContent, /width: min\(var\(--flt-menu-width-full\)/);
  assert.match(style.textContent, /\.flt-menu-head/);
  assert.match(
    style.textContent,
    /\.flt-tool-header[\s\S]*?height: auto; min-height: 0;[\s\S]*?\.flt-tool-body:not\(\.flt-tool-hidden\)[\s\S]*?max-height: none; overflow: visible/,
  );
  assert.match(
    style.textContent,
    /\.flt-toggle-row[\s\S]*?align-items: flex-start[\s\S]*?height: auto; min-height: var\(--flt-control-height\)/,
  );
  assert.match(style.textContent, /--flt-control-height: 30px/);
  assert.match(style.textContent, /\.flt-button \{[\s\S]*?min-height: var\(--flt-control-height\)/);
  assert.match(
    style.textContent,
    /\.flt-panel \.flt-input \{[\s\S]*?width: 100%;[\s\S]*?max-width: 100%/,
  );
  assert.match(
    style.textContent,
    /\.flt-inline-setting-row \{[\s\S]*?repeat\(auto-fit, minmax\(104px, 1fr\)\)/,
  );
  assert.match(style.textContent, /\.flt-compact-action-row \{ display: flex; flex-wrap: wrap/);
  assert.match(style.textContent, /\.flt-basic-saved-term \{ display: flex; flex-wrap: wrap/);
  assert.match(style.textContent, /\.flt-shortcut-list \{ display: grid/);
  assert.match(style.textContent, /\.flt-panel \.flt-input\[type="file"\]/);
  assert.match(style.textContent, /prefers-reduced-motion/);
  assert.match(
    style.textContent,
    /color-mix\(in srgb, var\(--flt-surface\) 72%, var\(--flt-accent\) 28%\)/,
  );
  assert.match(
    style.textContent,
    /\.flt-toggle-indicator[\s\S]*?width: var\(--flt-toggle-knob-size\); height: var\(--flt-toggle-knob-size\);[\s\S]*?border-radius: 4px/,
  );
  assert.match(
    style.textContent,
    /\.flt-tool-header\.last-opened \{ box-shadow: inset 3px 0 0 var\(--flt-accent\)/,
  );
  assert.match(style.textContent, /\.flt-tool-panel \{[^}]*border-radius: 9px/);
  assert.match(
    style.textContent,
    /\.flt-progress-stack \{[\s\S]*?width: min\(var\(--flt-menu-width-full\)/,
  );
  assert.match(style.textContent, /\.flt-tool-header\.last-opened::before/);
  assert.match(style.textContent, /html\.flt-menu-width-narrow \.flt-panel/);
  assert.match(
    style.textContent,
    /\.flt-theme-swatch \{[\s\S]*?width: 22px; height: 22px[\s\S]*?border-radius: 5px/,
  );
  assert.match(
    style.textContent,
    /html\[data-flt-pro-theme="pride"\] \.flt-toggle\[aria-checked="true"\][\s\S]*?background-image: none !important/,
  );
  assert.doesNotMatch(
    style.textContent,
    /html\[data-flt-pro-theme="pride"\] \.flt-toggle\[aria-checked="true"\][\s\S]{0,220}linear-gradient\(90deg, #c97b83/,
  );
  assert.doesNotMatch(style.textContent, /(?:^|\n)\s*(?:button|input|body)\s*\{/);
  assert.ok(UI_Z_INDEX.dialog > UI_Z_INDEX.notice);
  theme.setTokens({ accent: '#abcdef', shadow: '0 2px 8px rgb(0 0 0 / 40%)' });
  assert.equal(document.documentElement.style.getPropertyValue('--flt-accent'), '#abcdef');
  assert.throws(() => theme.setTokens({ accent: 'url(https://example.com)' }), /invalid/);
  theme.resetTokens();
  assert.equal(document.documentElement.style.getPropertyValue('--flt-accent'), '');
  theme.destroy();
  assert.equal(document.getElementById('flt-core-theme'), null);
});

test('controls use a semantic switch, never a checkbox, and provide useful list states', () => {
  const { document, idFactory } = environment();
  const controls = new ControlFactory({ document, idFactory });
  const changes = [];
  const toggle = controls.toggle({
    label: 'Enable feature',
    onChange: (value) => changes.push(value),
  });
  document.body.append(toggle.element);
  assert.equal(toggle.element.querySelector('input[type="checkbox"]'), null);
  assert.equal(toggle.switch.getAttribute('role'), 'switch');
  toggle.switch.click();
  assert.equal(toggle.checked, true);
  assert.deepEqual(changes, [true]);
  toggle.setChecked(false);
  assert.equal(toggle.checked, false);
  const search = controls.search({ label: 'Search People', placeholder: 'Name or note' });
  assert.equal(search.input.type, 'search');
  const empty = controls.list({
    emptyMessage: 'No saved people yet.',
    items: [],
    renderItem: String,
  });
  assert.equal(empty.getAttribute('role'), 'status');
  assert.equal(empty.textContent, 'No saved people yet.');
  const list = controls.list({ emptyMessage: 'Empty', items: ['A'], renderItem: (item) => item });
  assert.equal(list.querySelectorAll('li').length, 1);
  const themes = controls.themeSwatches({
    label: 'Themes',
    options: [
      {
        label: 'Forest',
        swatch: 'linear-gradient(135deg,#101e19 46%,#527d69 46%)',
        value: 'forest',
      },
      {
        label: 'Pride',
        swatch:
          'linear-gradient(135deg,#c97b83 0%,#d29a70 16.6%,#d0c07d 33.3%,#70a886 50%,#7091b6 66.6%,#a27ba9 100%)',
        value: 'pride',
      },
    ],
    value: 'forest',
    onChange: (value) => changes.push(value),
  });
  document.body.append(themes.element);
  assert.equal(themes.element.querySelector('input[type="checkbox"]'), null);
  assert.equal(
    themes.element.querySelector('[role="radiogroup"]').getAttribute('aria-label'),
    'Themes',
  );
  assert.equal(themes.value, 'forest');
  themes.element.querySelector('[data-flt-theme="pride"]').click();
  assert.equal(themes.value, 'pride');
  assert.equal(changes.at(-1), 'pride');
  assert.match(
    themes.element.querySelector('[data-flt-theme="pride"]').getAttribute('style'),
    /linear-gradient\(135deg,#c97b83/,
  );
});

test('dialogs trap focus, support Escape, restore focus, and distinguish destructive confirmation', async () => {
  const { document, dom, idFactory } = environment();
  const native = document.getElementById('native');
  native.focus();
  const controls = new ControlFactory({ document, idFactory });
  const dialogs = new DialogManager({ controls, document, idFactory });
  const first = dialogs.open({
    actions: [
      { autofocus: true, label: 'Keep', value: 'keep' },
      { label: 'Remove', value: 'remove', variant: 'danger' },
    ],
    description: 'This action affects saved state.',
    title: 'Review action',
  });
  assert.equal(first.element.querySelector('[role="dialog"]').getAttribute('aria-modal'), 'true');
  assert.equal(document.activeElement.textContent, 'Keep');
  const buttons = [...first.element.querySelectorAll('button')];
  buttons.at(-1).focus();
  buttons
    .at(-1)
    .dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
  assert.equal(document.activeElement, buttons[0]);
  first.element.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }),
  );
  assert.equal(await first.result, null);
  assert.equal(document.activeElement, native);

  const confirmation = dialogs.confirm({
    confirmLabel: 'Delete index',
    description: 'Physical files will remain on disk.',
    destructive: true,
    title: 'Delete Vault index?',
  });
  const destructive = [...document.querySelectorAll('.flt-dialog-actions button')].find(
    (button) => button.textContent === 'Delete index',
  );
  assert.equal(destructive.dataset.fltVariant, 'danger');
  destructive.click();
  assert.equal(await confirmation, true);
});

test('ProductShell uses accordion behavior, Escape, and focus return', () => {
  const { document, dom } = environment();
  const trigger = document.getElementById('native');
  const browse = document.createElement('p');
  browse.textContent = 'Browse content';
  const shell = new ProductShell({
    document,
    footer: {
      changelog: { summary: ['New shell header.'], version: '0.0.0' },
      releaseUrl: 'https://example.com/releases',
    },
    headerItems: ['Pro', 'Default', 'Ready'],
    iconUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
    navigation: [
      { content: browse, id: 'browse', label: 'Browse' },
      { id: 'people', label: 'People' },
      { id: 'personalize', label: 'Personalize' },
      { id: 'settings', label: 'Settings' },
    ],
    productId: 'pro',
    productName: 'FL Tools Pro',
    version: '0.0.0',
  });
  assert.equal(shell.element.querySelectorAll('.flt-header-item').length, 1);
  assert.equal(
    shell.element.querySelector('.flt-header-item').textContent,
    'Pro · Default · Ready',
  );
  assert.equal(shell.element.dataset.fltShell, 'product-dock');
  assert.equal(shell.element.dataset.fltLayout, 'product-accordion');
  assert.equal(shell.element.querySelector('.flt-header-title').textContent, 'FL Tools Pro');
  assert.equal(shell.element.querySelector('.flt-header-version').textContent, 'v0.0.0');
  assert.ok(shell.element.querySelector('.flt-header-icon'));
  assert.equal(shell.element.querySelector('.flt-header-close').textContent, '×');
  assert.equal(shell.element.querySelector('.flt-footer'), null);
  assert.equal(shell.element.querySelector('.flt-menu-search-input'), null);
  shell.element.querySelector('.flt-header-version').click();
  const updateNotice = document.querySelector('.flt-update-notice[data-flt-product="pro"]');
  assert.equal(updateNotice.hidden, false);
  assert.equal(updateNotice.dataset.fltPlacement, 'menu');
  assert.equal(shell.element.contains(updateNotice), false);
  assert.equal(updateNotice.parentElement.classList.contains('flt-cluster'), true);
  assert.equal(updateNotice.parentElement.contains(shell.element), true);
  assert.equal(updateNotice.querySelector('.flt-update-action').hidden, true);
  assert.equal(
    updateNotice.querySelector('.flt-update-title').textContent,
    'FL Tools Pro Changelog',
  );
  assert.equal(updateNotice.querySelector('.flt-update-list').textContent, 'New shell header.');
  updateNotice.querySelector('.flt-update-dismiss').click();
  assert.equal(updateNotice.hidden, true);
  const nativeSetTimeout = dom.window.setTimeout.bind(dom.window);
  let autoDismiss;
  let autoDismissDelay;
  dom.window.setTimeout = (callback, delay, ...arguments_) => {
    if (delay === 30_000) {
      autoDismiss = callback;
      autoDismissDelay = delay;
      return 30_000;
    }
    return nativeSetTimeout(callback, delay, ...arguments_);
  };
  shell.showChangelog({ version: '0.0.0' });
  assert.equal(autoDismissDelay, 30_000);
  autoDismiss();
  assert.equal(updateNotice.hidden, true);
  let liveNotes = { summary: ['New shell header.'], version: '0.0.0' };
  const liveShell = new ProductShell({
    document,
    footer: {
      getChangelog: () => liveNotes,
      releaseUrl: 'https://example.com/releases',
    },
    navigation: [{ id: 'browse', label: 'Browse' }],
    productId: 'basic',
    productName: 'FL Tools Basic',
    version: '0.0.0',
  });
  liveNotes = { summary: ['Stacked in the product cluster.'], version: '0.0.0' };
  liveShell.showChangelog({ version: '0.0.0' });
  assert.equal(
    document.querySelector('.flt-update-notice[data-flt-product="basic"] .flt-update-list')
      .textContent,
    'Stacked in the product cluster.',
  );
  liveShell.destroy();
  const headers = [...shell.element.querySelectorAll('.flt-tool-header')];
  assert.deepEqual(
    headers.map((header) => header.textContent),
    ['Browse▸', 'People▸', 'Personalize▸', 'Settings▸'],
  );
  assert.equal(shell.element.querySelectorAll('.flt-tool-body:not(.flt-tool-hidden)').length, 0);
  trigger.focus();
  shell.open({ trigger });
  headers[0].click();
  assert.equal(headers[0].getAttribute('aria-expanded'), 'true');
  assert.equal(headers[0].classList.contains('last-opened'), true);
  assert.equal(shell.getView('browse').classList.contains('flt-tool-hidden'), false);
  headers.at(-1).click();
  assert.equal(headers[0].getAttribute('aria-expanded'), 'false');
  assert.equal(headers.at(-1).getAttribute('aria-expanded'), 'true');
  assert.equal(headers[0].classList.contains('last-opened'), false);
  assert.equal(headers.at(-1).classList.contains('last-opened'), true);
  headers.at(-1).click();
  assert.equal(headers.at(-1).getAttribute('aria-expanded'), 'false');
  assert.equal(headers.at(-1).classList.contains('last-opened'), true);
  shell.setChrome({ contrast: true, menuWidth: 'narrow', themeSkin: 'pride' });
  assert.equal(shell.element.dataset.fltContrast, 'true');
  assert.equal(shell.element.dataset.fltMenuWidth, 'narrow');
  assert.equal(shell.element.dataset.fltThemeSkin, 'pride');
  assert.equal(document.documentElement.classList.contains('flt-menu-width-narrow'), true);
  shell.setChrome({ contrast: false, menuWidth: 'full', themeSkin: '' });
  assert.equal(shell.element.dataset.fltContrast, 'false');
  assert.equal(shell.element.hasAttribute('data-flt-menu-width'), false);
  assert.equal(shell.element.hasAttribute('data-flt-theme-skin'), false);
  assert.equal(document.documentElement.classList.contains('flt-menu-width-narrow'), false);
  headers.at(-1).click();
  assert.equal(headers.at(-1).getAttribute('aria-expanded'), 'true');
  headers[0].dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, key: 'End' }));
  assert.equal(document.activeElement.querySelector('.flt-tool-title')?.textContent, 'Settings');
  shell.element.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }),
  );
  assert.equal(shell.element.hidden, true);
  assert.equal(document.activeElement, trigger);
  assert.throws(() => shell.setHeaderItems(['1', '2', '3', '4']), /one to three/);
  shell.destroy();
});

test('LauncherManager is dynamic, rejects infrastructure badges, and requires a safe supplied icon', () => {
  const { document } = environment();
  const launcher = new LauncherManager({ document });
  let activated;
  assert.throws(
    () =>
      launcher.register({
        iconUrl: 'data:image/svg+xml,x',
        name: 'Core',
        onActivate() {},
        productId: 'core',
      }),
    /user-facing product/,
  );
  assert.throws(
    () =>
      launcher.register({
        iconUrl: 'javascript:alert(1)',
        name: 'Basic',
        onActivate() {},
        productId: 'basic',
      }),
    /approved icon/,
  );
  const entry = launcher.register({
    iconUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
    name: 'FL Tools Basic',
    onActivate: ({ productId }) => {
      activated = productId;
    },
    productId: 'basic',
  });
  assert.equal(document.querySelectorAll('.flt-launcher-button').length, 1);
  assert.equal(entry.button.dataset.userscriptLauncher, 'userscript-launcher-v1');
  assert.equal(entry.button.dataset.fltLauncherSlot, '0');
  assert.equal(entry.button.title, '');
  assert.equal(entry.button.hasAttribute('title'), false);
  assert.equal(entry.button.getAttribute('aria-label'), 'FL Tools Basic');
  const vault = launcher.register({
    iconUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
    name: 'FL Tools Vault',
    onActivate() {},
    productId: 'vault',
  });
  const grid = document.querySelector('.flt-launcher');
  assert.equal(grid.children[0], entry.button);
  assert.equal(grid.children[1], vault.button);
  vault.unregister();
  entry.button.click();
  assert.equal(activated, 'basic');
  launcher.setActive('basic');
  assert.equal(entry.button.getAttribute('aria-expanded'), 'true');
  entry.unregister();
  assert.equal(document.querySelector('.flt-launcher'), null);
});

test('CoreUI keeps one product menu open and launcher badges survive page replacement', async () => {
  const { document, idFactory } = environment();
  const ui = new CoreUI({ document, idFactory, version: '0.0.0' });
  ui.start();
  const iconUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';
  const basic = ui.createShell({
    navigation: [{ id: 'browse', label: 'Browse' }],
    productId: 'basic',
    productName: 'FL Tools Basic',
  });
  const vault = ui.createShell({
    navigation: [{ id: 'save', label: 'Save' }],
    productId: 'vault',
    productName: 'FL Tools Vault',
  });
  for (const productId of ['basic', 'vault']) {
    ui.launcher.register({ iconUrl, name: productId, onActivate() {}, productId });
  }

  basic.open();
  assert.equal(basic.element.hidden, false);
  vault.open();
  assert.equal(basic.element.hidden, true);
  assert.equal(vault.element.hidden, false);
  assert.equal(
    document
      .querySelector('[data-flt-product="vault"].flt-launcher-button')
      .getAttribute('aria-expanded'),
    'true',
  );

  vault.element.remove();
  assert.equal(vault.element.isConnected, false);
  vault.open();
  assert.equal(vault.element.isConnected, true);
  assert.equal(vault.element.hidden, false);

  document.querySelector('.flt-launcher').remove();
  document.body.append(document.createElement('div'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(document.querySelectorAll('.flt-launcher-button').length, 2);
  ui.stop();
});

test('launcher clicks toggle their menu and outside pointer clicks dismiss it', () => {
  const { document, idFactory, dom } = environment();
  const ui = new CoreUI({ document, idFactory, version: '0.0.0' });
  ui.start();
  const shell = ui.createShell({
    navigation: [{ id: 'browse', label: 'Browse' }],
    productId: 'basic',
    productName: 'FL Tools Basic',
  });
  let entry;
  entry = ui.launcher.register({
    iconUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
    name: 'Basic',
    onActivate: () => shell.toggle({ trigger: entry.button }),
    productId: 'basic',
  });
  const outside = document.createElement('button');
  document.body.append(outside);

  entry.button.click();
  assert.equal(shell.element.hidden, false);
  assert.equal(entry.button.getAttribute('aria-expanded'), 'true');
  entry.button.click();
  assert.equal(shell.element.hidden, true);
  assert.equal(entry.button.getAttribute('aria-expanded'), 'false');

  entry.button.click();
  shell.element.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true }));
  assert.equal(shell.element.hidden, false);
  outside.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true }));
  assert.equal(shell.element.hidden, true);
  assert.equal(entry.button.getAttribute('aria-expanded'), 'false');

  ui.stop();
  dom.window.close();
});

test('CoreUI remounts theme, announcer, and open panels after Turbo head and body replacement', async () => {
  const { document, idFactory, dom } = environment();
  const ui = new CoreUI({ document, idFactory, version: '0.0.0' });
  ui.start();
  const iconUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';
  const shell = ui.createShell({
    navigation: [{ id: 'browse', label: 'Browse' }],
    productId: 'basic',
    productName: 'FL Tools Basic',
  });
  ui.launcher.register({ iconUrl, name: 'Basic', onActivate() {}, productId: 'basic' });
  shell.open();
  assert.ok(document.getElementById('flt-core-theme'));
  assert.equal(document.querySelectorAll('.flt-live-region').length, 2);

  document.getElementById('flt-core-theme').remove();
  document.querySelector('.flt-panel[data-flt-product="basic"]').remove();
  for (const region of [...document.querySelectorAll('.flt-live-region')]) region.remove();
  document.dispatchEvent(new dom.window.Event('turbo:load'));

  assert.ok(document.getElementById('flt-core-theme')?.isConnected);
  assert.equal(document.querySelector('.flt-panel[data-flt-product="basic"]')?.hidden, false);
  assert.equal(document.querySelectorAll('.flt-live-region').length, 2);

  document.getElementById('flt-core-theme').remove();
  document.head.append(document.createElement('meta'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(document.getElementById('flt-core-theme')?.isConnected);
  ui.stop();
  dom.window.close();
});

test('accessible announcements are restrained and CoreUI tears down all owned UI', () => {
  const { document, idFactory } = environment();
  let now = 100;
  const announcer = new AccessibleAnnouncer({ clock: () => now, document });
  announcer.mount();
  assert.equal(announcer.announce('Save completed.'), true);
  assert.equal(announcer.announce('Save completed.'), false);
  now = 2000;
  assert.equal(announcer.announce('Save completed.'), true);
  announcer.destroy();

  const ui = new CoreUI({ document, idFactory, version: '0.0.0' });
  ui.start();
  ui.createShell({
    navigation: [{ id: 'browse', label: 'Browse' }],
    productId: 'basic',
    productName: 'FL Tools Basic',
  });
  ui.launcher.register({
    iconUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
    name: 'FL Tools Basic',
    onActivate() {},
    productId: 'basic',
  });
  ui.stop();
  assert.equal(document.querySelector('[data-flt-owner="core"]'), null);
  assert.equal(document.querySelector('.flt-panel'), null);
  assert.equal(document.querySelector('.flt-live-region'), null);
});

test('CoreUI explains legacy incompatibility and does nothing before destructive confirmation', async () => {
  const { document, idFactory } = environment();
  const ui = new CoreUI({ document, idFactory, version: '0.0.0' });
  ui.start();
  const calls = [];
  const cleanup = {
    async confirmAndDelete(token) {
      calls.push(token);
      return { deletedCount: 2, verified: true };
    },
  };
  const detection = {
    confirmationToken: 'one-time-token',
    found: true,
    local: ['fl_seen_today'],
    session: ['fl_private_session'],
  };
  const cancelled = ui.confirmLegacyCleanup(cleanup, detection);
  document.querySelector('.flt-dialog-actions button').click();
  assert.deepEqual(await cancelled, { status: 'CANCELLED' });
  assert.deepEqual(calls, []);

  const completed = ui.confirmLegacyCleanup(cleanup, detection);
  [...document.querySelectorAll('.flt-dialog-actions button')]
    .find((button) => button.textContent === 'Delete legacy FL Tools data')
    .click();
  assert.deepEqual(await completed, { deletedCount: 2, status: 'COMPLETE', verified: true });
  assert.deepEqual(calls, ['one-time-token']);
  assert.equal(
    document.querySelector('[data-flt-live="polite"]').textContent,
    'Legacy FL Tools data was deleted and verified.',
  );
  ui.stop();
});
