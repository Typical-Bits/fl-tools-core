import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { ProductShell } from '../src/ui/shell.js';
import { GENDER_REFERENCE, ABBREVIATION_REFERENCE } from '../src/fetlife/terminology.js';

test('supplied terminology keeps distinct gender codes and ambiguous glossary meanings', () => {
  assert.equal(GENDER_REFERENCE.length, 32);
  assert.equal(GENDER_REFERENCE.find((e) => e.code === 'B').label, 'Butch');
  assert.equal(GENDER_REFERENCE.find((e) => e.code === 'BG').label, 'Bigender');
  assert.equal(GENDER_REFERENCE.find((e) => e.code === 'TS').group, 'Other shorthand');
  assert.equal(
    GENDER_REFERENCE.some((e) => e.code === 'GFae'),
    false,
  );
  assert.equal(ABBREVIATION_REFERENCE.filter((e) => e.code === 'GGG').length, 1);
  assert.match(
    ABBREVIATION_REFERENCE.find((e) => e.code === 'NB').meanings.join(' '),
    /Non-Black.*Non-Binary/,
  );
  assert.match(
    ABBREVIATION_REFERENCE.find((e) => e.code === 'ASL').meanings.join(' '),
    /American Sign Language/,
  );
});

test('menu help searches definitions without changing native links or interpreting markup', () => {
  const dom = new JSDOM('<body></body>');
  const { document, Event } = dom.window;
  const shell = new ProductShell({
    document,
    productId: 'basic',
    productName: 'Basic',
    version: '0.0.1',
    navigation: [{ id: 'browse', label: 'Browse' }],
    shortcutFooter: document.createElement('dl'),
  });
  const search = shell.element.querySelector('[aria-label="Search abbreviations"]');
  assert.ok(search, 'Shared menu must include searchable terminology');
  search.value = 'American Sign Language';
  search.dispatchEvent(new Event('input'));
  const rows = [...shell.element.querySelectorAll('.flt-glossary-entry')].filter((n) => !n.hidden);
  assert.equal(rows.length, 1);
  assert.match(rows[0].textContent, /ASL/);
  assert.ok(
    rows[0].querySelector('a[href="https://en.wikipedia.org/wiki/American_Sign_Language"]'),
  );
  search.value = '<img src=x onerror=alert(1)>';
  search.dispatchEvent(new Event('input'));
  assert.equal(shell.element.querySelector('.flt-glossary-results img'), null);
  assert.match(shell.element.querySelector('.flt-glossary-status').textContent, /No matching/);
  search.value = '';
  search.dispatchEvent(new Event('input'));
  assert.equal(
    [...shell.element.querySelectorAll('.flt-glossary-entry')].filter((n) => !n.hidden).length,
    ABBREVIATION_REFERENCE.length,
  );
  assert.equal(shell.element.querySelector('input[type="checkbox"]'), null);
  shell.destroy();
  dom.window.close();
});
