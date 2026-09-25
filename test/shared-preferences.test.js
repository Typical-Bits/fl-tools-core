import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { CoreUI } from '../src/ui/core-ui.js';

test('shared appearance controls sync shells, persist, and survive legacy adoption', () => {
  const dom = new JSDOM('<body></body>', { url: 'https://fetlife.com/home' });
  const document = dom.window.document;
  let id = 0;
  const ui = new CoreUI({ document, version: '0.0.2', idFactory: () => `prefs-${++id}` });
  ui.start();
  ui.preferences.adopt({ menuWidth: 'compact', notifications: false });
  const shells = ['basic', 'compass'].map((productId) =>
    ui.createShell({
      productId,
      productName: productId,
      navigation: [{ id: 'main', label: 'Main', content: document.createElement('div') }],
    }),
  );
  const appearance = shells[0].element.querySelector('[data-flt-view="appearance"]');
  assert.doesNotMatch(appearance.textContent, /Shared across FL Tools/);
  assert.match(
    [...appearance.querySelectorAll('.flt-label')].find(
      (label) => label.textContent === 'Menu width',
    ).dataset.fltTip,
    /shared menu width|Other FL Tools menus/i,
  );
  const motion = appearance.querySelector('[role="switch"]');
  motion.click();
  assert.equal(document.documentElement.classList.contains('flt-reduce-motion'), true);
  assert.equal(
    shells[1].element
      .querySelector('[data-flt-view="appearance"] [role="switch"]')
      .getAttribute('aria-checked'),
    'true',
  );
  const theme = appearance.querySelector('select');
  theme.value = 'gradient';
  theme.dispatchEvent(new dom.window.Event('change'));
  for (const shell of shells) {
    assert.equal(shell.element.dataset.fltThemeSkin, 'gradient');
    assert.equal(shell.element.dataset.fltMenuWidth, 'compact');
  }
  ui.preferences.adopt({ notifications: true, menuWidth: 'full' });
  assert.equal(ui.preferences.value.notifications, false);
  const saved = JSON.parse(dom.window.localStorage.getItem('fl-tools.ui-preferences'));
  assert.equal(saved.reduceMotion, true);
  dom.window.dispatchEvent(
    new dom.window.StorageEvent('storage', {
      key: 'fl-tools.ui-preferences',
      newValue: JSON.stringify({ menuWidth: 'narrow', notifications: true }),
    }),
  );
  assert.equal(shells[1].element.dataset.fltMenuWidth, 'narrow');
  assert.equal(motion.getAttribute('aria-checked'), 'false');
  ui.stop();
  dom.window.close();
});

test('unavailable persistence retains session choices instead of replacing them with legacy defaults', () => {
  const dom = new JSDOM('<body></body>');
  const ui = new CoreUI({
    document: dom.window.document,
    version: '0.0.2',
    idFactory: () => 'test',
  });
  ui.start();
  ui.preferences.adopt({ notifications: false });
  ui.preferences.adopt({ notifications: true });
  assert.equal(ui.preferences.value.notifications, false);
  ui.stop();
  dom.window.close();
});
