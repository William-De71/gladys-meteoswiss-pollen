// The dashboard widgets: every content passes the validator of the SDK (what
// the core would drop), in the four languages, in season, out of season,
// stale and empty.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  WIDGETS,
  TTL,
  clip,
  messageContent,
  levelColor,
  buildStationWidget,
  buildHistoryWidget,
  readWidgetSettings,
} from '../src/widgets.js';
import { TAXA, mergeHistory, parseHourlyCsv, snapshotOf, STALE_AFTER_MS } from '../src/pollen.js';
import { LANGUAGES } from '../src/i18n.js';
import { BERN, FILES, NOW, SPRING_NOW, TZ, HOUR, hours } from './helpers/fixtures.js';

const historyFrom = (text) => mergeHistory({}, parseHourlyCsv(text, 'PBE'));
const SPRING = { history: historyFrom(FILES.spring), now: SPRING_NOW };
const OCTOBER = { history: historyFrom(FILES.now), now: NOW };

/**
 * @description Both widgets of a history at an instant.
 * @param {object} input - `{ history, now }`.
 * @param {string} language - The language.
 * @returns {object[]} The contents.
 */
function contents({ history, now }, language) {
  const snapshot = snapshotOf(history, now);
  return [
    buildStationWidget({ station: BERN, snapshot, language, timeZone: TZ }),
    buildHistoryWidget({ station: BERN, history, snapshot, language, timeZone: TZ }),
  ];
}

/**
 * @description Check a content: valid for the core, within the card budget.
 * @param {object} content - The content.
 * @param {string} label - For the messages.
 */
function assertValid(content, label) {
  const report = validateWidgetContent(content);
  assert.deepEqual(report, [], `${label}: ${JSON.stringify(report)}`);
  assert.ok(content.components.length <= 8, label);
  const focal = content.components.filter((c) => ['chart', 'card-list', 'image'].includes(c.type));
  assert.ok(focal.length <= 1, label);
  assert.ok(content.components.filter((c) => c.type === 'status').length <= 1, label);
  assert.ok(content.components.filter((c) => c.type === 'text').length <= 2, label);
  assert.ok(content.ttl_seconds >= 10 && content.ttl_seconds <= 3600, label);
}

test('the keys of the widgets', () => {
  assert.deepEqual(WIDGETS, { STATION: 'station', HISTORY: 'history' });
  assert.equal(TTL.data, 600);
});

test('every content is valid, in every language, in and out of season, stale or empty', () => {
  const stale = { history: OCTOBER.history, now: NOW + STALE_AFTER_MS + HOUR };
  const empty = { history: {}, now: NOW };
  const short = { history: mergeHistory({}, hours(NOW, 3, { birch: 5 })), now: NOW };
  for (const language of LANGUAGES) {
    for (const [name, input] of Object.entries({ SPRING, OCTOBER, stale, empty, short })) {
      contents(input, language).forEach((content, index) =>
        assertValid(content, `${name}.${index}.${language}`),
      );
    }
  }
});

test('station widget: the seven taxa with their level, the overall level, the source', () => {
  const [station] = contents(SPRING, 'en');
  assert.deepEqual(station.components[0], { type: 'text', variant: 'heading', text: 'Bern (BE)' });
  const list = station.components.find((c) => c.type === 'card-list');
  assert.equal(list.items.length, TAXA.length);
  const birch = list.items.find((item) => item.title === 'Birch');
  assert.deepEqual(birch.badge, { text: 'Very high', color: 'danger' });
  assert.match(birch.subtitle, /^Last hour 1308\/m³ · 24 h \d+\/m³$/);
  const status = station.components.find((c) => c.type === 'status');
  const rows = Object.fromEntries(status.items.map((item) => [item.label, item]));
  assert.equal(rows.Level.value, 'Very high');
  assert.match(rows['Main pollen'].value, /^Birch: very high/);
  assert.equal(rows.Source.value, 'MeteoSwiss');
  assert.equal(rows.Measured.color, 'neutral');
});

test('station widget out of season: "None" in green, no main pollen row', () => {
  const [station] = contents(OCTOBER, 'fr');
  const list = station.components.find((c) => c.type === 'card-list');
  assert.ok(
    list.items.every((item) => item.badge.text === 'Nul' && item.badge.color === 'success'),
  );
  const labels = station.components.find((c) => c.type === 'status').items.map((i) => i.label);
  assert.deepEqual(labels, ['Niveau', 'Mesuré', 'Source']);
});

test('station widget of a stale station: a warning text and an orange time', () => {
  const [station] = contents({ history: OCTOBER.history, now: NOW + 7 * HOUR }, 'en');
  assert.match(station.components[1].text, /six hours/);
  const measured = station.components
    .find((c) => c.type === 'status')
    .items.find((item) => item.label === 'Measured');
  assert.equal(measured.color, 'warning');
});

test('history widget: a line chart of four taxa at most, time-stamped points', () => {
  const [, history] = contents(SPRING, 'de');
  const chart = history.components.find((c) => c.type === 'chart');
  assert.equal(chart.chart_type, 'line');
  assert.equal(chart.unit, '/m³');
  assert.ok(chart.series.length >= 1 && chart.series.length <= 4);
  assert.equal(chart.series[0].name, 'Birke');
  for (const serie of chart.series) {
    assert.ok(serie.points.length <= 48);
    assert.ok(serie.points.every((point) => !Number.isNaN(Date.parse(point.t))));
  }
});

test('history widget out of season: a sentence instead of a flat chart', () => {
  const [, history] = contents(OCTOBER, 'en');
  assert.ok(!history.components.some((c) => c.type === 'chart'));
  assert.equal(history.components[1].text, 'No pollen measured over the last 48 hours.');
});

test('helpers: clip, message, colors, settings', () => {
  assert.equal(clip('abcdef', 4), 'abc…');
  assert.equal(clip(undefined, 4), '');
  assertValid(messageContent('x'.repeat(400)), 'message');
  assert.equal(messageContent('x').ttl_seconds, TTL.message);
  assert.deepEqual([null, 0, 1, 2, 3, 4, -1].map(levelColor), [
    'neutral',
    'success',
    'success',
    'warning',
    'danger',
    'danger',
    'neutral',
  ]);
  assert.deepEqual(readWidgetSettings({ station: 'ext:x:station:PBE' }), {
    station: 'ext:x:station:PBE',
  });
  assert.deepEqual(readWidgetSettings({ station: '' }), { station: null });
  assert.deepEqual(readWidgetSettings(undefined), { station: null });
});
