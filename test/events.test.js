// The scene trigger and the scene action outputs: one event per rise, a
// baseline first, flat payloads within the limits of the core.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  TRIGGERS,
  ALERT_FROM,
  ACTION_OUTPUTS,
  stationSummary,
  alertSummary,
  detectEvents,
  actionOutputs,
} from '../src/events.js';
import { TAXA, mergeHistory, parseHourlyCsv, snapshotOf } from '../src/pollen.js';
import { LANGUAGES } from '../src/i18n.js';
import { BERN, FILES, NOW, SPRING_NOW, TODAY, HOUR, hours, historyOf } from './helpers/fixtures.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
// Measured, but nothing new for more than six hours.
const STALE = snapshotOf(mergeHistory({}, hours(NOW - 7 * HOUR, 24, { birch: 500 })), NOW);
const STATION = { ...BERN, deviceId: 'ext:test-integration:station:PBE' };

/**
 * @description A snapshot with these 24-hour means.
 * @param {object} values - `{ birch: 120 }`.
 * @param {number} [now] - Now.
 * @returns {object} The snapshot.
 */
const snapshotWith = (values, now = NOW) => snapshotOf(historyOf(hours(now, 24, values)), now);

/**
 * @description Run the detection on one snapshot.
 * @param {object} snapshot - The snapshot.
 * @param {object} seen - The memory.
 * @param {string} [today] - The local date.
 * @returns {object} `{ events, seen }`.
 */
const run = (snapshot, seen, today = TODAY) =>
  detectEvents({
    stations: [STATION],
    snapshotOf: () => snapshot,
    seen,
    today,
    language: 'en',
  });

test('the first reading of a station is a baseline, remembered per date and taxon', () => {
  const { events, seen } = run(snapshotWith({ birch: 500 }), {});
  assert.deepEqual(events, []);
  assert.equal(seen.PBE[TODAY].birch, 4);
  assert.equal(seen.PBE[TODAY].grasses, 0);
  assert.equal(ALERT_FROM, 2);
});

test('a rise to moderate or more fires once per level and day', () => {
  let { seen } = run(snapshotWith({}), {});
  let result = run(snapshotWith({ grasses: 30 }), seen);
  assert.equal(result.events.length, 1);
  const [event] = result.events;
  assert.equal(event.key, TRIGGERS.POLLEN_ALERT);
  assert.equal(event.data.pollen_type, 'grasses');
  assert.equal(event.data.level, 2);
  assert.equal(event.data.label, 'Moderate');
  assert.equal(event.data.concentration, 30);
  assert.equal(event.data.station, STATION.deviceId);
  assert.equal(event.data.station_name, 'Bern');
  assert.equal(
    event.data.summary,
    'The grass pollen is moderate in Bern: 30 pollen/m³ on average over the last 24 hours.',
  );
  seen = result.seen;
  // The same level again: nothing; a dip and back: nothing; higher: one more.
  assert.deepEqual(run(snapshotWith({ grasses: 30 }), seen).events, []);
  seen = run(snapshotWith({ grasses: 5 }), seen).seen;
  assert.deepEqual(run(snapshotWith({ grasses: 30 }), seen).events, []);
  result = run(snapshotWith({ grasses: 200 }), seen);
  assert.deepEqual(
    result.events.map((e) => e.data.level),
    [4],
  );
  // A new day: the memory starts again.
  result = run(snapshotWith({ grasses: 200 }), result.seen, '2026-10-29');
  assert.equal(result.events.length, 1);
});

test('low never fires; several taxa fire together', () => {
  const { seen } = run(snapshotWith({}), {});
  assert.deepEqual(run(snapshotWith({ birch: 10, oak: 49 }), seen).events, []);
  const { events } = run(snapshotWith({ birch: 100, oak: 200 }), seen);
  assert.deepEqual(
    events.map((event) => [event.data.pollen_type, event.data.level]),
    [
      ['birch', 3],
      ['oak', 3],
    ],
  );
});

test('a stale or empty station keeps its memory and fires nothing', () => {
  const { seen } = run(snapshotWith({}), {});
  const stale = run(STALE, seen);
  assert.deepEqual(stale.events, []);
  assert.deepEqual(stale.seen, seen);
  const empty = run(snapshotOf({}, NOW), {});
  assert.deepEqual(empty, { events: [], seen: {} });
});

test('the memory forgets the days older than three days', () => {
  const seen = { PBE: { '2026-10-20': { birch: 4 }, '2026-10-26': { birch: 2 } } };
  const next = run(snapshotWith({}), seen).seen;
  assert.deepEqual(Object.keys(next.PBE).sort(), ['2026-10-26', TODAY]);
});

test('event payloads: flat scalars, 30 keys at most, the variables of the manifest', () => {
  const { seen } = run(snapshotWith({}), {});
  const { events } = run(
    snapshotWith(Object.fromEntries(TAXA.map((taxon) => [taxon, 1000]))),
    seen,
  );
  assert.equal(events.length, TAXA.length);
  const trigger = manifest.scene_triggers.find((entry) => entry.key === TRIGGERS.POLLEN_ALERT);
  const declared = trigger.variables.map((variable) => variable.key);
  for (const event of events) {
    const keys = Object.keys(event.data);
    assert.ok(keys.length <= 30);
    for (const [key, value] of Object.entries(event.data)) {
      assert.ok(
        value === null || ['string', 'number', 'boolean'].includes(typeof value),
        `${key}: ${typeof value}`,
      );
      if (typeof value === 'string') {
        assert.ok(value.length <= 1000, key);
      }
    }
    for (const key of declared) {
      assert.ok(keys.includes(key), `variable ${key} is in the payload`);
    }
    // The filters of the trigger: station (device), pollen type, level as text.
    const fields = new Map(trigger.fields.map((field) => [field.key, field]));
    assert.ok(fields.get('pollen_type').options.some((o) => o.value === event.data.pollen_type));
    assert.ok(fields.get('level').options.some((o) => o.value === String(event.data.level)));
    assert.equal(event.data.measured_at, new Date(NOW).toISOString());
  }
});

test('alert summaries in the four languages', () => {
  const entry = { level: 3, mean: 120 };
  assert.equal(
    alertSummary({ station: BERN, taxon: 'birch', entry }, 'fr'),
    'Les pollens de bouleau sont à un niveau fort à Bern : 120 pollens/m³ en moyenne sur les dernières 24 heures.',
  );
  assert.match(
    alertSummary({ station: BERN, taxon: 'birch', entry }, 'de'),
    /^Die Birkenpollen-Belastung ist stark/,
  );
  assert.match(
    alertSummary({ station: BERN, taxon: 'oak', entry }, 'es'),
    /^El polen de roble está en nivel alto/,
  );
});

test('station summaries: unknown, none, a level with the main pollen', () => {
  assert.equal(
    stationSummary({ station: BERN, snapshot: snapshotOf({}, NOW) }, 'en'),
    'Pollen in Bern: no recent measurement.',
  );
  assert.equal(
    stationSummary({ station: BERN, snapshot: snapshotWith({}) }, 'en'),
    'Pollen in Bern: none in the air over the last 24 hours.',
  );
  const spring = snapshotOf(mergeHistory({}, parseHourlyCsv(FILES.spring, 'PBE')), SPRING_NOW);
  assert.match(
    stationSummary({ station: BERN, snapshot: spring }, 'en'),
    /^Pollen in Bern: very high\. Main pollen: Birch: very high \(\d+\/m³\)\.$/,
  );
  for (const language of LANGUAGES) {
    assert.ok(stationSummary({ station: BERN, snapshot: spring }, language).includes('Bern'));
  }
});

test('scene action outputs: exactly the declared ones, scalars', () => {
  const action = manifest.scene_actions.find((entry) => entry.key === 'get_pollen');
  assert.deepEqual(
    action.outputs.map((output) => output.key),
    ACTION_OUTPUTS,
  );
  assert.equal(ACTION_OUTPUTS.length, 20);
  const spring = snapshotOf(mergeHistory({}, parseHourlyCsv(FILES.spring, 'PBE')), SPRING_NOW);
  const outputs = actionOutputs({ station: BERN, snapshot: spring }, 'en');
  assert.deepEqual(Object.keys(outputs), ACTION_OUTPUTS);
  assert.equal(outputs.station_name, 'Bern');
  assert.equal(outputs.level, 4);
  assert.equal(outputs.label, 'Very high');
  assert.equal(outputs.main_pollen, 'Birch');
  assert.equal(outputs.birch, 1308);
  assert.equal(outputs.birch_level, 4);
  assert.equal(outputs.measured_at, '2026-04-08T23:00:00.000Z');
  const types = Object.fromEntries(action.outputs.map((output) => [output.key, output.type]));
  for (const [key, value] of Object.entries(outputs)) {
    assert.ok(value === null || typeof value === types[key], `${key}: ${typeof value}`);
  }
  const none = actionOutputs({ station: BERN, snapshot: snapshotWith({}) }, 'fr');
  assert.equal(none.main_pollen, '');
  assert.equal(none.label, 'Nul');
  const unknown = actionOutputs({ station: BERN, snapshot: null }, 'en');
  assert.equal(unknown.level, null);
  assert.equal(unknown.measured_at, null);
  assert.equal(unknown.label, 'Unknown');
});
