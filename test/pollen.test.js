// The readers of the MeteoSwiss files and the levels, on the recorded files
// of Bern and on synthetic hours.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  KEEP_HOURS,
  MIN_HOURS,
  STALE_AFTER_MS,
  TAXA,
  THRESHOLDS,
  PollenDataError,
  parseTimestamp,
  parseValue,
  parseHourlyCsv,
  mergeHistory,
  levelOf,
  snapshotOf,
  mainTaxon,
  seriesOf,
} from '../src/pollen.js';
import { FILES, HOUR, NOW, SPRING_NOW, csvOf, hours, historyOf } from './helpers/fixtures.js';

const rowsToHistory = (rows) => mergeHistory({}, rows);

test('timestamps are UTC, day first, the end of the hour', () => {
  assert.equal(parseTimestamp('28.10.2026 20:00'), Date.parse('2026-10-28T20:00:00Z'));
  assert.equal(parseTimestamp('01.01.2026 00:00'), Date.parse('2026-01-01T00:00:00Z'));
  assert.equal(parseTimestamp('2026-10-28 20:00'), null);
  assert.equal(parseTimestamp(''), null);
  assert.equal(parseTimestamp(undefined), null);
});

test('values: integers or decimals, an empty field is missing', () => {
  assert.equal(parseValue('12'), 12);
  assert.equal(parseValue('4.5'), 4.5);
  assert.equal(parseValue(''), null);
  assert.equal(parseValue(' '), null);
  assert.equal(parseValue('-1'), null);
  assert.equal(parseValue('n/a'), null);
});

test('the recorded real-time file of Bern: 21 hours, all seven taxa, zeros', () => {
  const rows = parseHourlyCsv(FILES.now, 'PBE');
  assert.equal(rows.length, 21);
  assert.equal(rows[0].at, Date.parse('2026-10-28T00:00:00Z'));
  assert.equal(rows.at(-1).at, Date.parse('2026-10-28T20:00:00Z'));
  for (const row of rows) {
    assert.deepEqual(Object.keys(row.values).sort(), [...TAXA].sort());
    assert.ok(TAXA.every((taxon) => row.values[taxon] === 0));
  }
});

test('the recorded spring lines of Bern: columns found by name, not by position', () => {
  const rows = parseHourlyCsv(FILES.spring, 'PBE');
  assert.equal(rows.length, 72);
  // PBE;06.04.2026 00:00;1184;0;0;0;61;439;120 -> kabetuh0 khpoach0 kaalnuh0 kacoryh0 kafaguh0 kafraxh0 kaquerh0
  assert.deepEqual(rows[0].values, {
    hazel: 0,
    alder: 0,
    ash: 439,
    birch: 1184,
    beech: 61,
    oak: 120,
    grasses: 0,
  });
});

test('another column order, empty fields, other stations and broken lines', () => {
  const text = [
    'reference_timestamp;station_abbr;khpoach0;kabetuh0;unknown',
    '28.10.2026 19:00;PBE;5;',
    '28.10.2026 20:00;PZH;9;9',
    'not a date;PBE;1;1',
    '28.10.2026 18:00;PBE;3;7',
    '',
  ].join('\r\n');
  const rows = parseHourlyCsv(text, 'PBE');
  assert.equal(rows.length, 2, 'Zürich and the broken line are left out');
  assert.equal(rows[0].at, Date.parse('2026-10-28T18:00:00Z'), 'sorted, oldest first');
  assert.equal(rows[0].values.grasses, 3);
  assert.equal(rows[0].values.birch, 7);
  assert.equal(rows[0].values.hazel, null, 'a taxon without a column is missing');
  assert.equal(rows[1].values.birch, null, 'an empty field is missing');
});

test('an empty file or an unknown header is a PollenDataError', () => {
  assert.throws(() => parseHourlyCsv('', 'PBE'), PollenDataError);
  assert.throws(
    () => parseHourlyCsv('<html>maintenance</html>\n', 'PBE'),
    (err) => err instanceof PollenDataError && err.kind === 'invalid',
  );
  assert.throws(() => parseHourlyCsv('station_abbr;reference_timestamp;foo\n', 'PBE'));
});

test('the history keeps the last 48 hours before the newest, new rows win', () => {
  const first = rowsToHistory(hours(NOW, 60, { birch: 1 }));
  assert.equal(Object.keys(first).length, KEEP_HOURS);
  const oldest = Math.min(...Object.keys(first).map(Number));
  assert.equal(oldest, NOW - (KEEP_HOURS - 1) * HOUR);
  const next = mergeHistory(first, [{ at: NOW, values: { ...first[NOW], birch: 9 } }]);
  assert.equal(next[NOW].birch, 9);
  assert.equal(first[NOW].birch, 1, 'the input is not modified');
  assert.deepEqual(mergeHistory(), {});
});

test('levels: the MeteoSwiss pollen load classes, boundaries included', () => {
  // [low upper bound, moderate upper bound, high upper bound] of the table.
  const table = {
    hazel: [10, 69, 249],
    alder: [10, 69, 249],
    ash: [10, 99, 349],
    birch: [10, 69, 299],
    beech: [49, 129, 399],
    oak: [49, 129, 399],
    grasses: [19, 49, 149],
  };
  assert.deepEqual(Object.keys(THRESHOLDS).sort(), [...TAXA].sort());
  for (const [taxon, [low, moderate, high]] of Object.entries(table)) {
    assert.equal(levelOf(taxon, 0), 0, taxon);
    assert.equal(levelOf(taxon, 0.4), 0, `${taxon} rounds to 0`);
    assert.equal(levelOf(taxon, 1), 1, taxon);
    assert.equal(levelOf(taxon, low), 1, `${taxon} ${low}`);
    assert.equal(levelOf(taxon, low + 1), 2, `${taxon} ${low + 1}`);
    assert.equal(levelOf(taxon, moderate), 2, `${taxon} ${moderate}`);
    assert.equal(levelOf(taxon, moderate + 1), 3, `${taxon} ${moderate + 1}`);
    assert.equal(levelOf(taxon, high), 3, `${taxon} ${high}`);
    assert.equal(levelOf(taxon, high + 1), 4, `${taxon} ${high + 1}`);
  }
  assert.equal(levelOf('birch', null), null);
  assert.equal(levelOf('birch', Number.NaN), null);
});

test('snapshot of the recorded October file: 21 hours give a 24-hour mean, all zeros', () => {
  const history = rowsToHistory(parseHourlyCsv(FILES.now, 'PBE'));
  const snapshot = snapshotOf(history, NOW);
  assert.equal(snapshot.measuredAt, Date.parse('2026-10-28T20:00:00Z'));
  assert.equal(snapshot.stale, false);
  assert.ok(21 >= MIN_HOURS, 'MIN_HOURS is reached');
  assert.equal(snapshot.level, 0);
  for (const taxon of TAXA) {
    assert.deepEqual(snapshot.taxa[taxon], { lastHour: 0, mean: 0, level: 0 });
  }
});

test('snapshot of the birch peak of April 2026 in Bern', () => {
  const history = rowsToHistory(parseHourlyCsv(FILES.spring, 'PBE'));
  const snapshot = snapshotOf(history, SPRING_NOW);
  assert.equal(snapshot.measuredAt, Date.parse('2026-04-08T23:00:00Z'));
  assert.equal(snapshot.taxa.birch.lastHour, 1308);
  assert.equal(snapshot.taxa.birch.level, 4);
  assert.ok(snapshot.taxa.birch.mean >= 300);
  assert.equal(snapshot.level, 4);
  assert.equal(mainTaxon(snapshot), 'birch');
  assert.equal(snapshot.taxa.hazel.level, 0);
});

test('a mean needs MIN_HOURS measured hours in the last 24', () => {
  const short = rowsToHistory(hours(NOW, MIN_HOURS - 1, { grasses: 30 }));
  assert.equal(snapshotOf(short, NOW).taxa.grasses.mean, null);
  assert.equal(snapshotOf(short, NOW).taxa.grasses.level, null);
  assert.equal(snapshotOf(short, NOW).level, null);
  assert.equal(snapshotOf(short, NOW).taxa.grasses.lastHour, 30, 'the last hour is still known');
  const enough = rowsToHistory(hours(NOW, MIN_HOURS, { grasses: 30 }));
  assert.equal(snapshotOf(enough, NOW).taxa.grasses.level, 2);
  // Missing fields do not count as zeros.
  const gaps = rowsToHistory(hours(NOW, 24, (index) => ({ grasses: index % 6 === 0 ? null : 60 })));
  assert.equal(snapshotOf(gaps, NOW).taxa.grasses.mean, 60);
});

test('the 24-hour mean ignores the older hours', () => {
  const history = rowsToHistory([
    ...hours(NOW - 24 * HOUR, 24, { oak: 1000 }),
    ...hours(NOW, 24, { oak: 10 }),
  ]);
  assert.equal(snapshotOf(history, NOW).taxa.oak.mean, 10);
  assert.equal(snapshotOf(history, NOW).taxa.oak.level, 1);
});

test('a station without new measurement for six hours is stale; an empty history too', () => {
  const history = rowsToHistory(hours(NOW, 24, { birch: 0 }));
  assert.equal(snapshotOf(history, NOW + STALE_AFTER_MS).stale, false);
  assert.equal(snapshotOf(history, NOW + STALE_AFTER_MS + 1).stale, true);
  const empty = snapshotOf({}, NOW);
  assert.equal(empty.measuredAt, null);
  assert.equal(empty.stale, true);
  assert.equal(empty.level, null);
  // Rows with only missing fields are not measurements.
  const blank = historyOf(hours(NOW, 3, Object.fromEntries(TAXA.map((t) => [t, null]))));
  assert.equal(snapshotOf(blank, NOW).measuredAt, null);
});

test('main taxon: highest level, then highest mean; none below low', () => {
  const snapshot = (taxa) => ({
    taxa: Object.fromEntries(
      TAXA.map((taxon) => [taxon, { lastHour: 0, mean: 0, level: 0, ...taxa[taxon] }]),
    ),
  });
  assert.equal(mainTaxon(snapshot({})), null);
  assert.equal(mainTaxon(null), null);
  assert.equal(
    mainTaxon(snapshot({ ash: { level: 2, mean: 50 }, grasses: { level: 2, mean: 40 } })),
    'ash',
  );
  assert.equal(
    mainTaxon(snapshot({ ash: { level: 2, mean: 50 }, beech: { level: 3, mean: 200 } })),
    'beech',
  );
  assert.equal(mainTaxon(snapshot({ oak: { level: 1, mean: 3 } })), 'oak');
});

test('chart series: taxa with pollen, highest peak first, four at most', () => {
  const spring = rowsToHistory(parseHourlyCsv(FILES.spring, 'PBE'));
  const series = seriesOf(spring);
  assert.ok(series.length <= 4);
  assert.equal(series[0].taxon, 'birch');
  assert.ok(series.every((serie) => serie.points.length > 0));
  assert.ok(!series.some((serie) => ['hazel', 'alder', 'grasses'].includes(serie.taxon)));
  const points = series[0].points;
  assert.ok(
    points.every((point, i) => i === 0 || point.at > points[i - 1].at),
    'in time order',
  );
  assert.deepEqual(seriesOf(rowsToHistory(parseHourlyCsv(FILES.now, 'PBE'))), []);
  const many = rowsToHistory(
    hours(NOW, 3, { hazel: 1, alder: 2, ash: 3, birch: 4, beech: 5, oak: 6, grasses: 7 }),
  );
  assert.deepEqual(
    seriesOf(many).map((serie) => serie.taxon),
    ['grasses', 'oak', 'beech', 'birch'],
  );
  assert.equal(seriesOf(many, 2).length, 2);
  assert.deepEqual(seriesOf(), []);
});

test('a synthetic file reads back what it was built from', () => {
  const rows = hours(NOW, 2, { birch: 5, grasses: null });
  const parsed = parseHourlyCsv(csvOf('PZH', rows), 'PZH');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].values.birch, 5);
  assert.equal(parsed[1].values.grasses, null);
  assert.equal(parsed[1].values.oak, 0);
});
