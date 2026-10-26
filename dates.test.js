import test from 'node:test';
import assert from 'node:assert/strict';
import { dateInZone, addDays, validDate } from './public/dates.js';
import { recordCalendar } from './public/record-calendar.js';

test('one instant maps to the correct local date across the date line', () => {
  const instant = new Date('2026-09-22T10:30:00Z');
  assert.equal(dateInZone('Pacific/Kiritimati', instant), '2026-09-23');
  assert.equal(dateInZone('Pacific/Honolulu', instant), '2026-09-22');
  assert.throws(() => dateInZone('invalid/zone', instant));
});
test('date arithmetic survives DST, leap days and year boundaries', () => {
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2024-02-29'), true);
});
test('calendar allows past unrecorded dates and disables future dates', () => {
  const html = recordCalendar({ month: '2026-09', records: [{date:'2026-09-21'}], selectedDate:'2026-09-22', currentDate:'2026-09-22' });
  assert.match(html, /has-record[^>]*2026-09-21/);
  assert.match(html, /record-date:2026-09-23[^>]*disabled/);
  assert.doesNotMatch(html, /record-date:2026-09-20[^>]*disabled/);
});
