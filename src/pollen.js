// -----------------------------------------------------------------------------
// Pollen data: the CSV files of MeteoSwiss, the hourly history kept per
// station, and what is read from it.
//
// Files (Open Government Data, "Source: MeteoSwiss"), semicolon separated,
// Windows-1252, one row per hour:
//
//   station_abbr;reference_timestamp;kabetuh0;khpoach0;kaalnuh0;…
//   PBE;28.10.2026 20:00;0;0;0;0;0;0;0
//
// `reference_timestamp` is UTC and marks the END of the hour (20:00 is
// 19:00-20:00). A missing value is an empty field (instrument failure). The
// column order is not fixed: columns are found by their parameter name,
// `k?<taxon>h0` (hourly mean concentration, pollen per m³).
//
// Levels: MeteoSwiss's pollen load classes ("Threshold values for pollen load
// classes of allergenic pollen types", 2024-01-10) apply to the mean DAILY
// concentration. The integration applies them to the mean of the last 24
// hours, so a level moves with the measurements instead of once a day.
//   0 none, 1 low, 2 moderate, 3 high, 4 very high.
// -----------------------------------------------------------------------------

const HOUR_MS = 3600 * 1000;
// The hours kept per station: enough for the 24-hour mean and a 48-hour chart.
const KEEP_HOURS = 48;
// A 24-hour mean needs this many measured hours (an instrument may miss a few).
const MIN_HOURS = 18;
// After this, a station that publishes nothing new is stale.
const STALE_AFTER_MS = 6 * HOUR_MS;

// In the order of the season: hazel and alder open the year, grasses close it.
const TAXA = ['hazel', 'alder', 'ash', 'birch', 'beech', 'oak', 'grasses'];
// The genus in the MeteoSwiss parameter names (kacoryh0, khpoach0…).
const CODES = {
  cory: 'hazel',
  alnu: 'alder',
  frax: 'ash',
  betu: 'birch',
  fagu: 'beech',
  quer: 'oak',
  poac: 'grasses',
};
// Lower bounds of the moderate, high and very high classes, pollen per m³.
const THRESHOLDS = {
  hazel: [11, 70, 250],
  alder: [11, 70, 250],
  ash: [11, 100, 350],
  birch: [11, 70, 300],
  beech: [50, 130, 400],
  oak: [50, 130, 400],
  grasses: [20, 50, 150],
};

class PollenDataError extends Error {
  /**
   * @param {string} message - The detail.
   */
  constructor(message) {
    super(message);
    this.name = 'PollenDataError';
    this.kind = 'invalid';
  }
}

/**
 * @description The instant of a MeteoSwiss timestamp.
 * @param {string} value - `28.10.2026 20:00` (UTC).
 * @returns {number|null} The instant in ms, null when unreadable.
 */
function parseTimestamp(value) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) {
    return null;
  }
  const [, day, month, year, hour, minute] = match.map(Number);
  const instant = Date.UTC(year, month - 1, day, hour, minute);
  return Number.isFinite(instant) ? instant : null;
}

/**
 * @description A concentration as written in the file.
 * @param {string} value - The field.
 * @returns {number|null} The value, null when empty or unreadable.
 */
function parseValue(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  return Number(text);
}

/**
 * @description Read an hourly file of a station.
 * @param {string} text - The CSV.
 * @param {string} station - The abbreviation expected (`PBE`).
 * @returns {Array<{ at: number, values: object }>} The rows, oldest first;
 * `values` has one entry per taxon (null when missing).
 * @throws {PollenDataError} When the file cannot be read.
 */
function parseHourlyCsv(text, station) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length === 0) {
    throw new PollenDataError('empty file');
  }
  const header = lines[0].split(';').map((cell) => cell.trim());
  const timeIndex = header.indexOf('reference_timestamp');
  const stationIndex = header.indexOf('station_abbr');
  const columns = [];
  header.forEach((name, index) => {
    const match = /^k[a-z]([a-z]{4})h0$/.exec(name);
    if (match && CODES[match[1]]) {
      columns.push({ index, taxon: CODES[match[1]] });
    }
  });
  if (timeIndex < 0 || columns.length === 0) {
    throw new PollenDataError(`unexpected header: ${lines[0].slice(0, 120)}`);
  }
  const rows = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(';');
    if (stationIndex >= 0 && cells[stationIndex]?.trim().toUpperCase() !== station) {
      continue;
    }
    const at = parseTimestamp(cells[timeIndex]);
    if (at === null) {
      continue;
    }
    const values = Object.fromEntries(TAXA.map((taxon) => [taxon, null]));
    for (const { index, taxon } of columns) {
      values[taxon] = parseValue(cells[index]);
    }
    rows.push({ at, values });
  }
  return rows.sort((a, b) => a.at - b.at);
}

/**
 * @description Merge rows into the history of a station, keeping the last
 * KEEP_HOURS hours before the newest one.
 * @param {object} history - `{ [at]: values }` (not modified).
 * @param {Array<{ at: number, values: object }>} rows - New rows.
 * @returns {object} The new history.
 */
function mergeHistory(history = {}, rows = []) {
  const merged = { ...history };
  for (const { at, values } of rows) {
    merged[at] = values;
  }
  const instants = Object.keys(merged).map(Number);
  const newest = instants.length ? Math.max(...instants) : 0;
  return Object.fromEntries(
    Object.entries(merged).filter(([at]) => Number(at) > newest - KEEP_HOURS * HOUR_MS),
  );
}

/**
 * @description The level of a mean concentration.
 * @param {string} taxon - The taxon.
 * @param {number|null} mean - The mean, pollen per m³.
 * @returns {number|null} 0 (none) to 4 (very high), null without a mean.
 */
function levelOf(taxon, mean) {
  if (!Number.isFinite(mean)) {
    return null;
  }
  const value = Math.round(mean);
  if (value < 1) {
    return 0;
  }
  const [moderate, high, veryHigh] = THRESHOLDS[taxon];
  if (value < moderate) {
    return 1;
  }
  if (value < high) {
    return 2;
  }
  return value < veryHigh ? 3 : 4;
}

/**
 * @description What a station's history says now.
 * @param {object} history - `{ [at]: values }`.
 * @param {number} now - Now, in ms.
 * @returns {object} `{ measuredAt, stale, level, taxa: { [taxon]: { lastHour,
 * mean, level } } }`; measuredAt null when nothing was measured.
 */
function snapshotOf(history = {}, now = Date.now()) {
  const rows = Object.entries(history)
    .map(([at, values]) => ({ at: Number(at), values }))
    .filter((row) => TAXA.some((taxon) => Number.isFinite(row.values?.[taxon])))
    .sort((a, b) => a.at - b.at);
  const latest = rows.at(-1) ?? null;
  const taxa = {};
  for (const taxon of TAXA) {
    const window = latest
      ? rows
          .filter((row) => row.at > latest.at - 24 * HOUR_MS)
          .map((row) => row.values[taxon])
          .filter(Number.isFinite)
      : [];
    const mean =
      window.length >= MIN_HOURS
        ? window.reduce((sum, value) => sum + value, 0) / window.length
        : null;
    const lastHour = latest?.values[taxon];
    taxa[taxon] = {
      lastHour: Number.isFinite(lastHour) ? lastHour : null,
      mean: mean === null ? null : Math.round(mean),
      level: levelOf(taxon, mean),
    };
  }
  const levels = TAXA.map((taxon) => taxa[taxon].level).filter(Number.isInteger);
  return {
    measuredAt: latest?.at ?? null,
    stale: !latest || now - latest.at > STALE_AFTER_MS,
    level: levels.length ? Math.max(...levels) : null,
    taxa,
  };
}

/**
 * @description The taxon that matters most now: highest level, then highest mean.
 * @param {object|null} snapshot - snapshotOf.
 * @returns {string|null} The taxon, null when none is at least low.
 */
function mainTaxon(snapshot) {
  let best = null;
  for (const taxon of TAXA) {
    const entry = snapshot?.taxa?.[taxon];
    if (!entry || !(entry.level >= 1)) {
      continue;
    }
    const current = best && snapshot.taxa[best];
    if (
      !current ||
      entry.level > current.level ||
      (entry.level === current.level && entry.mean > current.mean)
    ) {
      best = taxon;
    }
  }
  return best;
}

/**
 * @description The hourly series of the taxa present in a history, for a chart.
 * @param {object} history - `{ [at]: values }`.
 * @param {number} [max] - Series at most (a chart holds four).
 * @returns {Array<{ taxon: string, points: Array<{ at: number, value: number }> }>}
 * The taxa with at least one pollen counted, highest peak first.
 */
function seriesOf(history = {}, max = 4) {
  const rows = Object.entries(history)
    .map(([at, values]) => ({ at: Number(at), values }))
    .sort((a, b) => a.at - b.at);
  return TAXA.map((taxon) => ({
    taxon,
    points: rows
      .filter((row) => Number.isFinite(row.values?.[taxon]))
      .map((row) => ({ at: row.at, value: row.values[taxon] })),
  }))
    .map((serie) => ({ ...serie, peak: Math.max(0, ...serie.points.map((point) => point.value)) }))
    .filter((serie) => serie.peak > 0)
    .sort((a, b) => b.peak - a.peak || TAXA.indexOf(a.taxon) - TAXA.indexOf(b.taxon))
    .slice(0, max)
    .map(({ taxon, points }) => ({ taxon, points }));
}

export {
  HOUR_MS,
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
};
