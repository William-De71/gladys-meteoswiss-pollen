// -----------------------------------------------------------------------------
// Scene trigger and scene action outputs.
//
// Trigger (one event per transition, never a periodic snapshot):
//   - `pollen_alert`  the level of a taxon at a station (mean of the last 24
//                     hours) reaches "Moderate" (2) or more, or rises again the
//                     same day. The `level` filter of the scene picks the
//                     levels that matter ("High" and "Very high" for most
//                     people).
//
// What was announced is remembered per station, local date and taxon (`seen`,
// kept in /data): a restart or the next reading never fires the same event
// twice, and a level that dips and comes back the same day does not fire
// again. The first reading of a station is a baseline: no event replays it.
// -----------------------------------------------------------------------------

import { t, levelLabel } from './i18n.js';
import { TAXA, mainTaxon } from './pollen.js';
import { mainPollenText } from './device.js';
import { addDays } from './time.js';

const TRIGGERS = { POLLEN_ALERT: 'pollen_alert' };
const ALERT_FROM = 2;
// `seen` keeps a few days back, then forgets.
const SEEN_DAYS = 3;
// The outputs of the `get_pollen` scene action (manifest order, 20 at most).
const ACTION_OUTPUTS = [
  'station_name',
  'measured_at',
  'level',
  'label',
  'main_pollen',
  'summary',
  ...TAXA,
  ...TAXA.map((taxon) => `${taxon}_level`),
];

/**
 * @description The sentence of a station now.
 * @param {object} input - `{ station, snapshot }`.
 * @param {string} language - The language.
 * @returns {string} The summary.
 */
function stationSummary({ station, snapshot }, language) {
  const values = { station: station.name };
  if (!snapshot?.measuredAt || !Number.isInteger(snapshot.level)) {
    return t('summaryUnknown', language, values);
  }
  if (snapshot.level === 0) {
    return t('summaryNone', language, values);
  }
  const taxon = mainTaxon(snapshot);
  return t('summaryStation', language, {
    ...values,
    label: levelLabel(snapshot.level, language).toLowerCase(),
    main: taxon ? mainPollenText(snapshot, language) : '-',
  });
}

/**
 * @description The sentence of an alert.
 * @param {object} input - `{ station, taxon, entry }`.
 * @param {string} language - The language.
 * @returns {string} The summary.
 */
function alertSummary({ station, taxon, entry }, language) {
  return t('summaryAlert', language, {
    taxon: t(`taxonLower_${taxon}`, language),
    level: levelLabel(entry.level, language).toLowerCase(),
    station: station.name,
    count: entry.mean ?? '?',
  });
}

/**
 * @description The scene events of a reading, and the new `seen`.
 * @param {object} input - Input.
 * @param {object[]} input.stations - The stations, with `deviceId`.
 * @param {Function} input.snapshotOf - `(stationId) => snapshot`.
 * @param {object} input.seen - What was already announced (not modified).
 * @param {string} input.today - `YYYY-MM-DD`, local.
 * @param {string} input.language - Language of the summaries.
 * @returns {{ events: Array<{ key: string, data: object }>, seen: object }} The events and the new memory.
 */
function detectEvents({ stations, snapshotOf, seen = {}, today, language }) {
  const events = [];
  const next = {};
  const oldest = addDays(today, -SEEN_DAYS);
  for (const station of stations) {
    const snapshot = snapshotOf(station.id);
    const before = seen[station.id];
    if (!snapshot?.measuredAt || snapshot.stale) {
      // Nothing new to compare: keep the memory as it was.
      if (before) {
        next[station.id] = before;
      }
      continue;
    }
    // A station never met: its first reading is the reference.
    const baseline = !before;
    const memory = Object.fromEntries(
      Object.entries(before ?? {}).filter(([date]) => date >= oldest),
    );
    const known = { ...(memory[today] ?? {}) };
    for (const taxon of TAXA) {
      const entry = snapshot.taxa[taxon];
      const level = entry?.level ?? 0;
      if (level >= ALERT_FROM && level > (known[taxon] ?? 0) && !baseline) {
        events.push({
          key: TRIGGERS.POLLEN_ALERT,
          data: {
            station: station.deviceId,
            station_name: station.name,
            pollen_type: taxon,
            type_label: t(`taxon_${taxon}`, language),
            level,
            label: levelLabel(level, language),
            concentration: entry.mean ?? null,
            last_hour: entry.lastHour ?? null,
            measured_at: new Date(snapshot.measuredAt).toISOString(),
            summary: alertSummary({ station, taxon, entry }, language),
          },
        });
      }
      known[taxon] = Math.max(known[taxon] ?? 0, level);
    }
    memory[today] = known;
    next[station.id] = memory;
  }
  return { events, seen: next };
}

/**
 * @description The outputs of the `get_pollen` scene action: everything known
 * about a station now.
 * @param {object} input - `{ station, snapshot }`.
 * @param {string} language - The language.
 * @returns {object} Only the declared outputs, scalars.
 */
function actionOutputs({ station, snapshot }, language) {
  const taxon = mainTaxon(snapshot);
  const data = {
    station_name: station.name,
    measured_at: snapshot?.measuredAt ? new Date(snapshot.measuredAt).toISOString() : null,
    level: snapshot?.level ?? null,
    label: levelLabel(snapshot?.level ?? null, language),
    main_pollen: taxon ? t(`taxon_${taxon}`, language) : '',
    summary: stationSummary({ station, snapshot }, language),
  };
  for (const name of TAXA) {
    data[name] = snapshot?.taxa?.[name]?.lastHour ?? null;
    data[`${name}_level`] = snapshot?.taxa?.[name]?.level ?? null;
  }
  return Object.fromEntries(ACTION_OUTPUTS.map((key) => [key, data[key] ?? null]));
}

export {
  TRIGGERS,
  ALERT_FROM,
  ACTION_OUTPUTS,
  stationSummary,
  alertSummary,
  detectEvents,
  actionOutputs,
};
