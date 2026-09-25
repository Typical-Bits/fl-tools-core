import assert from 'node:assert/strict';
import test from 'node:test';
import { displayCalendarDate, parseCalendarDate } from '../src/ui/calendar-date.js';

test('US calendar inputs validate real dates and preserve ISO persistence', () => {
  assert.equal(displayCalendarDate('2026-09-19'), '09/19/2026');
  assert.equal(parseCalendarDate('09/19/2026'), '2026-09-19');
  assert.equal(parseCalendarDate('02/29/2024'), '2024-02-29');
  assert.equal(parseCalendarDate(''), '');
  assert.equal(displayCalendarDate(''), '');
  for (const value of ['02/29/2025', '04/31/2026', '13/01/2026', '2026-09-19', '9/19/2026']) {
    assert.throws(() => parseCalendarDate(value), /MM\/DD\/YYYY/);
  }
});
