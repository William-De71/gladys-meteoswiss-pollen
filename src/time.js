// -----------------------------------------------------------------------------
// Local dates and the reading pace.
//
// MeteoSwiss publishes the hourly pollen values a few minutes after each hour
// and refreshes its files every 10 minutes: the integration reads every 20
// minutes, each instance at its own offset (a stable jitter), and an unchanged
// file costs a 304. "Today" (the scene trigger remembers what it announced per
// local day) is the date in the timezone of the Gladys instance (TZ, injected
// by the supervisor).
// -----------------------------------------------------------------------------

const DAY_MS = 24 * 3600 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const READ_INTERVAL_MS = 20 * MINUTE_MS;
const JITTER_SECONDS = 300;

/**
 * @description The timezone of the instance.
 * @returns {string|undefined} An IANA name, undefined for the system one.
 */
function defaultTimeZone() {
  return process.env.TZ || undefined;
}

/**
 * @description The local date of an instant in a timezone.
 * @param {number} instant - The instant, in ms.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} `YYYY-MM-DD`.
 * @example
 * localDate(Date.parse('2026-10-17T23:30:00Z'), 'Europe/Zurich'); // '2026-10-18'
 */
function localDate(instant, timeZone = defaultTimeZone()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}

/**
 * @description Shift a calendar date by a number of days.
 * @param {string} date - `YYYY-MM-DD`.
 * @param {number} days - Days to add (negative to go back).
 * @returns {string} `YYYY-MM-DD`.
 */
function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * @description A stable jitter, in ms, from a seed (the stations): the same
 * instance always reads at the same offset.
 * @param {string} seed - The seed.
 * @returns {number} 0 to JITTER_SECONDS seconds, in ms.
 */
function jitterOf(seed) {
  let hash = 0;
  for (const char of String(seed ?? '')) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }
  return (hash % JITTER_SECONDS) * 1000;
}

export {
  DAY_MS,
  MINUTE_MS,
  HOUR_MS,
  READ_INTERVAL_MS,
  JITTER_SECONDS,
  defaultTimeZone,
  localDate,
  addDays,
  jitterOf,
};
