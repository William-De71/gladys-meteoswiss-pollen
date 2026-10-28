import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  READ_INTERVAL_MS,
  MINUTE_MS,
  JITTER_SECONDS,
  localDate,
  addDays,
  jitterOf,
} from '../src/time.js';

test('reads every 20 minutes', () => {
  assert.equal(READ_INTERVAL_MS, 20 * MINUTE_MS);
});

test('the local date follows the timezone', () => {
  const instant = Date.parse('2026-10-28T23:30:00Z');
  assert.equal(localDate(instant, 'Europe/Zurich'), '2026-10-29');
  assert.equal(localDate(instant, 'UTC'), '2026-10-28');
  // Summer time: UTC+2.
  assert.equal(localDate(Date.parse('2026-07-01T22:30:00Z'), 'Europe/Zurich'), '2026-07-02');
});

test('dates shift across months and years', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2026-10-28', -3), '2026-10-25');
});

test('the jitter is stable and bounded', () => {
  assert.equal(jitterOf('PBE|PZH'), jitterOf('PBE|PZH'));
  for (const seed of ['', 'PBE', 'PBE|PZH|PLU', 'PSN']) {
    const value = jitterOf(seed);
    assert.ok(value >= 0 && value < JITTER_SECONDS * 1000 && value % 1000 === 0, seed);
  }
  assert.equal(jitterOf(undefined), 0);
});
