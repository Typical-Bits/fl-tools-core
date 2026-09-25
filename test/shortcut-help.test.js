import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { ProductShell } from '../src/ui/shell.js';

test('shortcut help opens beside Close, refreshes in place, and dismisses before the menu', () => {
  const dom = new JSDOM('<!doctype html><body><button id="launcher">Open</button></body>');
  const { document, KeyboardEvent } = dom.window;
  const content = document.createElement('dl');
  content.textContent = 'Next card K';
  const shell = new ProductShell({
    document,
    productId: 'basic',
    productName: 'Basic',
    version: '0.0.1',
    navigation: [{ id: 'browse', label: 'Browse' }],
    shortcutFooter: content,
  });
  shell.open({ trigger: document.querySelector('#launcher') });
  const help = shell.element.querySelector('[aria-label="Keyboard shortcuts"]');
  assert.equal(help?.tagName, 'BUTTON');
  assert.equal(help.nextElementSibling.getAttribute('aria-label'), 'Close Basic');
  const card = document.getElementById(help.getAttribute('aria-controls'));
  assert.equal(card.hidden, true);
  help.click();
  assert.equal(card.hidden, false);
  assert.equal(help.getAttribute('aria-expanded'), 'true');
  assert.doesNotMatch(card.textContent, /FL Tools keys work outside text fields/);
  assert.match(card.querySelector('h3').dataset.fltTip, /FL Tools keys work outside text fields/);
  assert.match(card.textContent, /FetLife native shortcuts/);
  assert.match(card.textContent, /Go to inbox/);
  const productShortcuts = card.querySelector('.flt-shortcut-disclosure');
  assert.equal(productShortcuts.tagName, 'DETAILS');
  assert.equal(productShortcuts.open, false);
  const refreshed = document.createElement('dl');
  refreshed.textContent = 'Previous card J';
  shell.setShortcutFooter(refreshed);
  assert.match(card.textContent, /Previous card J/);
  assert.equal(card.hidden, false);
  card.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
  assert.equal(card.hidden, true);
  assert.equal(shell.element.hidden, false);
  assert.equal(document.activeElement, help);
  help.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(shell.element.hidden, true);
  assert.equal(document.activeElement.id, 'launcher');
  shell.destroy();
  dom.window.close();
});
