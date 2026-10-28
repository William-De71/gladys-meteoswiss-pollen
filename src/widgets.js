// -----------------------------------------------------------------------------
// Dashboard widgets of the MeteoSwiss Pollen integration.
//
//   - `station`  the seven taxa of a station, each with its level (mean of the
//                last 24 hours) as a badge and the last hour; the overall
//                level, the main pollen, the time of the measurement and the
//                source as a status list;
//   - `history`  the hourly concentrations of the last 48 hours, the four
//                taxa with the highest peak, as a chart.
//
// The contents come from the history kept by the integration: a widget never
// costs a request to MeteoSwiss. Colors are semantic (success, warning,
// danger). Every text exists in the four languages (the content is cached per
// language). Content budget of a card: 8 components, 1 main one, 6 tiles,
// 2 texts, 1 status, 4 buttons. "Source: MeteoSwiss" is shown on both, as the
// terms of use of the data ask.
// -----------------------------------------------------------------------------

import { t, levelLabel, shortDateTime } from './i18n.js';
import { TAXA, seriesOf } from './pollen.js';
import { mainPollenText } from './device.js';

const WIDGETS = { STATION: 'station', HISTORY: 'history' };
// New values come every hour: ten minutes of cache, nudged after each reading.
const TTL = { data: 600, message: 300 };

/**
 * @description Truncate a text to a bound, with an ellipsis.
 * @param {string} value - The text.
 * @param {number} max - The bound.
 * @returns {string} The text.
 */
function clip(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * @description A widget content made of one message.
 * @param {string} message - The message.
 * @param {number} [ttl] - Its freshness.
 * @returns {object} The content.
 */
function messageContent(message, ttl = TTL.message) {
  return {
    ttl_seconds: ttl,
    components: [{ type: 'text', variant: 'body', text: clip(message, 300) }],
  };
}

/**
 * @description The color of a pollen level.
 * @param {number|null} level - 0 to 4 (else neutral).
 * @returns {string} A semantic color.
 */
function levelColor(level) {
  if (!Number.isInteger(level) || level < 0) {
    return 'neutral';
  }
  if (level <= 1) {
    return 'success';
  }
  return level === 2 ? 'warning' : 'danger';
}

/**
 * @description The measurement time, source and staleness items of a status list.
 * @param {object} input - `{ snapshot, language, timeZone }`.
 * @returns {object[]} The items.
 */
function provenanceItems({ snapshot, language, timeZone }) {
  const items = [];
  if (snapshot?.measuredAt) {
    items.push({
      label: t('widgetMeasured', language),
      value: shortDateTime(snapshot.measuredAt, language, timeZone),
      color: snapshot.stale ? 'warning' : 'neutral',
    });
  }
  items.push({ label: t('widgetSource', language), value: 'MeteoSwiss', color: 'neutral' });
  return items;
}

/**
 * @description The heading of a station widget.
 * @param {object} station - The station.
 * @returns {object} The component.
 */
const heading = (station) => ({
  type: 'text',
  variant: 'heading',
  text: clip(`${station.name} (${station.canton})`, 40),
});

/**
 * @description The station widget.
 * @param {object} input - Input.
 * @param {object} input.station - The station.
 * @param {object} input.snapshot - snapshotOf.
 * @param {string} input.language - The language.
 * @param {string} [input.timeZone] - IANA timezone of the times.
 * @returns {object} The content.
 */
function buildStationWidget({ station, snapshot, language, timeZone }) {
  const components = [heading(station)];
  if (snapshot?.stale && snapshot.measuredAt) {
    components.push({ type: 'text', variant: 'body', text: t('widgetStale', language) });
  }
  components.push({
    type: 'card-list',
    display: 'list',
    items: TAXA.map((taxon) => {
      const entry = snapshot?.taxa?.[taxon] ?? {};
      return {
        title: clip(t(`taxon_${taxon}`, language), 60),
        subtitle: clip(
          t('widgetTaxonLine', language, {
            hour: entry.lastHour ?? '-',
            mean: entry.mean ?? '-',
          }),
          60,
        ),
        ...(Number.isInteger(entry.level)
          ? { badge: { text: levelLabel(entry.level, language), color: levelColor(entry.level) } }
          : {}),
      };
    }),
  });
  const items = [];
  if (Number.isInteger(snapshot?.level)) {
    items.push({
      label: t('widgetLevel', language),
      value: levelLabel(snapshot.level, language),
      color: levelColor(snapshot.level),
    });
  }
  const main = mainPollenText(snapshot, language);
  if (main && main !== '-') {
    items.push({
      label: t('widgetMainPollen', language),
      value: clip(main, 40),
      color: levelColor(snapshot.level),
    });
  }
  items.push(...provenanceItems({ snapshot, language, timeZone }));
  components.push({ type: 'status', items });
  return { ttl_seconds: TTL.data, components };
}

/**
 * @description The history widget.
 * @param {object} input - Input.
 * @param {object} input.station - The station.
 * @param {object} input.history - `{ [at]: values }`.
 * @param {object} input.snapshot - snapshotOf.
 * @param {string} input.language - The language.
 * @param {string} [input.timeZone] - IANA timezone of the times.
 * @returns {object} The content.
 */
function buildHistoryWidget({ station, history, snapshot, language, timeZone }) {
  const components = [heading(station)];
  const series = seriesOf(history);
  if (series.length) {
    components.push({
      type: 'chart',
      chart_type: 'line',
      unit: t('widgetUnit', language),
      series: series.map(({ taxon, points }) => ({
        name: clip(t(`taxon_${taxon}`, language), 30),
        points: points.map(({ at, value }) => ({ t: new Date(at).toISOString(), v: value })),
      })),
    });
  } else {
    components.push({ type: 'text', variant: 'body', text: t('widgetNoPollen', language) });
  }
  components.push({ type: 'status', items: provenanceItems({ snapshot, language, timeZone }) });
  return { ttl_seconds: TTL.data, components };
}

/**
 * @description Read the settings of a widget.
 * @param {object} [settings] - The settings.
 * @returns {{ station: string|null }} The device external id chosen, or null.
 */
const readWidgetSettings = (settings = {}) => ({
  station: typeof settings?.station === 'string' && settings.station ? settings.station : null,
});

export {
  WIDGETS,
  TTL,
  clip,
  messageContent,
  levelColor,
  buildStationWidget,
  buildHistoryWidget,
  readWidgetSettings,
};
