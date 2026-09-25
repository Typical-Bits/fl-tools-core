import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { compareScriptVersions, parseUserscriptVersion } from '../src/platform/updates.js';
import { LauncherManager } from '../src/ui/launcher.js';
import { ProductShell } from '../src/ui/shell.js';
import { UpdateLifecycle } from '../src/ui/update-lifecycle.js';

function environment() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'https://fetlife.com/home',
  });
  return { document: dom.window.document, dom };
}

function flush() {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 0));
}

test('parseUserscriptVersion and compareScriptVersions follow userscript and semver order', () => {
  assert.equal(
    parseUserscriptVersion('// @version      0.0.7-live.20260923.4\n'),
    '0.0.7-live.20260923.4',
  );
  assert.equal(compareScriptVersions('0.0.8', '0.0.7') > 0, true);
  assert.equal(compareScriptVersions('0.0.7-live.20260923.4', '0.0.7-live.20260923.3') > 0, true);
  assert.equal(compareScriptVersions('0.0.7', '0.0.7'), 0);
});

test('version chip changelog stays in the menu and closing the menu hides it', () => {
  const { document } = environment();
  const shell = new ProductShell({
    document,
    footer: {
      changelog: { summary: ['Dock and menu update notices.'], version: '0.0.7' },
      releaseUrl: 'https://github.com/Typical-Bits/fl-tools-basic/releases',
    },
    navigation: [{ id: 'browse', label: 'Browse' }],
    productId: 'basic',
    productName: 'FL Tools Basic',
    version: '0.0.7',
  });
  shell.open();
  shell.element.querySelector('.flt-header-version').click();
  const notice = document.querySelector('.flt-update-notice');
  assert.equal(notice.dataset.fltPlacement, 'menu');
  assert.equal(notice.parentElement.classList.contains('flt-cluster'), true);
  assert.equal(notice.querySelector('.flt-update-kicker').textContent, 'Current Version');
  shell.close();
  assert.equal(notice.hidden, true);
  shell.destroy();
});

test('UpdateLifecycle announces upgrades on the dock and keeps them if the menu closes', () => {
  const { document } = environment();
  const launcher = new LauncherManager({ document });
  launcher.register({
    iconUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
    name: 'FL Tools Basic',
    onActivate() {},
    productId: 'basic',
  });
  const shell = new ProductShell({
    document,
    footer: { changelog: { summary: ['Floating update notices.'], version: '0.0.7' } },
    navigation: [{ id: 'browse', label: 'Browse' }],
    productId: 'basic',
    productName: 'FL Tools Basic',
    version: '0.0.7',
  });
  document.defaultView.localStorage.setItem('flt:basic:last-version', '0.0.6');
  const lifecycle = new UpdateLifecycle({
    changelog: () => ({ summary: ['Floating update notices.'], version: '0.0.7' }),
    document,
    launcher,
    productId: 'basic',
    productName: 'FL Tools Basic',
    releaseUrl: 'https://github.com/Typical-Bits/fl-tools-basic/releases',
    shell,
    version: '0.0.7',
  });
  lifecycle.start();
  const notice = document.querySelector('.flt-update-notice');
  assert.equal(notice.hidden, false);
  assert.equal(notice.dataset.fltPlacement, 'dock');
  assert.equal(notice.parentElement.classList.contains('flt-progress-stack'), true);
  assert.equal(notice.querySelector('.flt-update-title').textContent, 'FL Tools Basic Updated');
  assert.equal(notice.querySelector('.flt-update-kicker').textContent, 'Update Complete');
  assert.equal(document.defaultView.localStorage.getItem('flt:basic:last-version'), '0.0.7');
  shell.open();
  shell.close();
  assert.equal(notice.hidden, false);
  lifecycle.destroy();
  shell.destroy();
});

test('UpdateLifecycle marks the launcher and offers Install Update for a newer userscript', async () => {
  const { document, dom } = environment();
  let fetched;
  let intervalDelay;
  const nativeSetInterval = dom.window.setInterval.bind(dom.window);
  dom.window.setInterval = (callback, delay, ...rest) => {
    if (delay === 15 * 60 * 1000) intervalDelay = delay;
    return nativeSetInterval(callback, delay, ...rest);
  };
  dom.window.fetch = async (url) => {
    fetched = String(url);
    return { status: 200, text: async () => '// @version      0.0.8\n' };
  };
  const launcher = new LauncherManager({ document });
  const entry = launcher.register({
    iconUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
    name: 'FL Tools Basic',
    onActivate() {},
    productId: 'basic',
  });
  const shell = new ProductShell({
    document,
    navigation: [{ id: 'browse', label: 'Browse' }],
    productId: 'basic',
    productName: 'FL Tools Basic',
    version: '0.0.7',
  });
  const lifecycle = new UpdateLifecycle({
    document,
    installUrl: 'https://example.test/fl-tools-basic-live.user.js',
    launcher,
    productId: 'basic',
    productName: 'FL Tools Basic',
    releaseUrl: 'https://github.com/Typical-Bits/fl-tools-basic/releases',
    shell,
    updateUrl: 'https://example.test/fl-tools-basic-live.user.js',
    version: '0.0.7',
  });
  lifecycle.start();
  await flush();
  const notice = document.querySelector('.flt-update-notice');
  const action = notice.querySelector('.flt-update-action');
  assert.match(fetched, /flt_check=0\.0\.7/);
  assert.equal(intervalDelay, 15 * 60 * 1000);
  assert.equal(notice.dataset.fltPlacement, 'dock');
  assert.equal(notice.parentElement.classList.contains('flt-progress-stack'), true);
  assert.equal(notice.querySelector('.flt-update-kicker').textContent, 'Update Available');
  assert.equal(
    notice.querySelector('.flt-update-title').textContent,
    'New FL Tools Basic Version Available',
  );
  assert.equal(action.hidden, false);
  assert.equal(action.textContent, 'Install Update');
  assert.match(action.href, /v=0\.0\.7/);
  assert.equal(entry.button.classList.contains('update-available'), true);
  assert.equal(entry.button.getAttribute('aria-label'), 'FL Tools Basic · Update v0.0.8 Available');
  action.click();
  assert.match(
    document.defaultView.localStorage.getItem('flt:basic:update-reload') ?? '',
    /0\.0\.8/,
  );
  lifecycle.destroy();
  assert.equal(entry.button.classList.contains('update-available'), false);
  shell.destroy();
});
