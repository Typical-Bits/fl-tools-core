import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import {
  applyChromeContract,
  CHROME_CONTRACT,
  CHROME_CONTRACT_VERSION,
} from '../src/ui/chrome-contract.js';
import { ProductShell } from '../src/ui/shell.js';

test('chrome contract locks the shared product-shell baseline', () => {
  assert.equal(CHROME_CONTRACT.baseline, 'compact-product-shell');
  assert.equal(CHROME_CONTRACT.artwork.menuBadgeContainer, 'borderless');
  assert.equal(CHROME_CONTRACT.header.divider, 'soft-edge-fade');
  assert.equal(CHROME_CONTRACT.menu.navigation, 'single-open-accordion');
  assert.deepEqual(CHROME_CONTRACT.menu.widths, { compact: 260, full: 312, narrow: 220 });
  assert.equal(CHROME_CONTRACT.notices.insideMenu, false);
  assert.equal(CHROME_CONTRACT.notices.placement, 'floating');
  assert.equal(CHROME_CONTRACT.toggles.style, 'matte');
  assert.equal(CHROME_CONTRACT.updates.intervalMs, 15 * 60 * 1000);
  assert.equal(Object.isFrozen(CHROME_CONTRACT), true);
});

test('product shells advertise the shared chrome contract and keep notices outside the menu', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'https://fetlife.com/home',
  });
  const shell = new ProductShell({
    document: dom.window.document,
    navigation: [{ id: 'settings', label: 'Settings' }],
    productId: 'basic',
    productName: 'FL Tools Basic',
    version: '3.0.11',
  });

  assert.equal(shell.element.dataset.fltChromeContract, String(CHROME_CONTRACT_VERSION));
  shell.open();
  shell.showChangelog();
  const notice = dom.window.document.querySelector('.flt-update-notice');
  assert.equal(notice.parentElement.classList.contains('flt-cluster'), true);
  assert.equal(shell.element.contains(notice), false);
  shell.destroy();
});

test('applyChromeContract is safe for optional surfaces', () => {
  assert.equal(applyChromeContract(null), null);
});
