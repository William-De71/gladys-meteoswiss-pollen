// -----------------------------------------------------------------------------
// Client of the MeteoSwiss Open Government Data (pollen stations).
//
// Files of the STAC collection `ch.meteoschweiz.ogd-pollen`, served by the
// Federal Spatial Data Infrastructure without a key:
//
//   https://data.geo.admin.ch/ch.meteoschweiz.ogd-pollen/<abbr>/ogd-pollen_<abbr>_h_now.csv
//     hourly values from yesterday 12:00 UTC to now, updated every 10 minutes
//     (about 2 KB);
//   https://data.geo.admin.ch/ch.meteoschweiz.ogd-pollen/<abbr>/ogd-pollen_<abbr>_h_recent.csv
//     hourly values from 1 January to yesterday (about 270 KB), read once,
//     only when the history kept in /data is too short for a 24-hour mean.
//
// MeteoSwiss asks for conditional requests (`If-None-Match`): an unchanged file
// answers 304 and costs nothing. One request at a time, half a second apart,
// with a user agent naming the project. No rate limit is published.
// -----------------------------------------------------------------------------

import { parseHourlyCsv } from './pollen.js';

const BASE_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-pollen';
const TIMEOUT_MS = 20000;
const PAUSE_MS = 500;
const USER_AGENT =
  'gladys-meteoswiss-pollen (+https://github.com/William-De71/gladys-meteoswiss-pollen)';

class MeteoSwissError extends Error {
  /**
   * @param {string} kind - `not_found`, `blocked`, `unreachable` or `invalid`.
   * @param {string} message - The detail.
   * @param {object} [extra] - `{ status }`.
   */
  constructor(kind, message, { status = null } = {}) {
    super(message);
    this.name = 'MeteoSwissError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description The URL of a file of a station.
 * @param {string} station - `PBE`.
 * @param {string} period - `now` or `recent`.
 * @returns {string} The URL.
 */
function fileUrl(station, period) {
  const abbr = station.toLowerCase();
  return `${BASE_URL}/${abbr}/ogd-pollen_${abbr}_h_${period}.csv`;
}

/**
 * @description A client of the MeteoSwiss pollen files.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - The fetch function (tests).
 * @param {Function} [options.now] - `() => number` in ms.
 * @param {Function} [options.sleep] - `(ms) => Promise` between two requests (tests).
 * @returns {object} `{ hourly, requests }`.
 */
function createMeteoSwissClient({
  fetch: fetchFn = globalThis.fetch,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  // Requests made, for the diagnostic.
  const requests = { total: 0, notModified: 0, last: null };
  let queue = Promise.resolve();

  /**
   * @description One request.
   * @param {string} station - The station.
   * @param {string} period - `now` or `recent`.
   * @param {string|null} etag - The ETag of the copy already read.
   * @returns {Promise<object>} `{ notModified: true }` or `{ rows, etag }`.
   */
  async function request(station, period, etag) {
    if (requests.last !== null && now() - requests.last < PAUSE_MS) {
      await sleep(PAUSE_MS - (now() - requests.last));
    }
    requests.total += 1;
    requests.last = now();
    let response;
    try {
      response = await fetchFn(fileUrl(station, period), {
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/csv',
          ...(etag ? { 'if-none-match': etag } : {}),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new MeteoSwissError('unreachable', err.cause?.code ?? err.message);
    }
    if (response.status === 304) {
      requests.notModified += 1;
      return { notModified: true };
    }
    if (response.status === 404) {
      throw new MeteoSwissError('not_found', `no ${period} file for ${station}`, { status: 404 });
    }
    if (response.status === 403 || response.status === 429) {
      throw new MeteoSwissError('blocked', `HTTP ${response.status}`, { status: response.status });
    }
    if (!response.ok) {
      throw new MeteoSwissError('unreachable', `HTTP ${response.status}`, {
        status: response.status,
      });
    }
    // Windows-1252: only digits and ASCII names matter here, latin1 reads them.
    const text = new TextDecoder('latin1').decode(await response.arrayBuffer());
    let rows;
    try {
      rows = parseHourlyCsv(text, station);
    } catch (err) {
      throw new MeteoSwissError('invalid', err.message);
    }
    return { rows, etag: response.headers.get('etag') };
  }

  /**
   * @description The hourly values of a station.
   * @param {string} station - `PBE`.
   * @param {object} [options] - `{ period: 'now' | 'recent', etag }`.
   * @returns {Promise<object>} `{ notModified: true }` or `{ rows, etag }`.
   */
  function hourly(station, { period = 'now', etag = null } = {}) {
    const run = queue.then(() => request(station, period, etag));
    queue = run.catch(() => {});
    return run;
  }

  return { hourly, requests };
}

export { BASE_URL, PAUSE_MS, USER_AGENT, MeteoSwissError, fileUrl, createMeteoSwissClient };
