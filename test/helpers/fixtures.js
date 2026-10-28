// A fake MeteoSwiss for the tests, served through the `fetch` option of the
// integration. Two recorded files of the Bern station (byte for byte, CRLF):
//   - pbe_h_now.csv     the real-time file of 2026-10-28, 00:00 to 20:00 UTC,
//                       all zeros (out of season);
//   - pbe_h_spring.csv  the lines of 6 to 8 April 2026 of the yearly file,
//                       the birch peak.
// Other stations and hours are synthetic CSV built by csvOf(), in the same
// format. Tests never touch the network.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';

import { TAXA } from '../../src/pollen.js';
import { stationOf } from '../../src/stations.js';

const HOUR = 3600 * 1000;
// 2026-10-28 21:30 in Zürich: the last row of pbe_h_now.csv is 20:00 UTC.
const NOW = Date.parse('2026-10-28T20:30:00Z');
const TODAY = '2026-10-28';
// 2026-04-09 01:30 in Zürich: the last row of pbe_h_spring.csv is 8 April 23:00 UTC.
const SPRING_NOW = Date.parse('2026-04-08T23:30:00Z');
const TZ = 'Europe/Zurich';

const silent = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * @description A recorded file.
 * @param {string} name - The file in test/fixtures.
 * @returns {string} Its text.
 */
const fixture = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'latin1');

const FILES = {
  now: fixture('pbe_h_now.csv'),
  spring: fixture('pbe_h_spring.csv'),
};

// The header of MeteoSwiss: the column order is its own, not the order of TAXA.
const HEADER =
  'station_abbr;reference_timestamp;kabetuh0;khpoach0;kaalnuh0;kacoryh0;kafaguh0;kafraxh0;kaquerh0';
const COLUMNS = ['birch', 'grasses', 'alder', 'hazel', 'beech', 'ash', 'oak'];

/**
 * @description A MeteoSwiss timestamp.
 * @param {number} at - The instant, in ms (UTC).
 * @returns {string} `28.10.2026 20:00`.
 */
function stamp(at) {
  const date = new Date(at);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/**
 * @description A synthetic hourly file.
 * @param {string} station - `PZH`.
 * @param {Array<{ at: number, values?: object }>} rows - Rows; a missing taxon is 0,
 * a null one an empty field.
 * @returns {string} The CSV (CRLF).
 */
function csvOf(station, rows) {
  const lines = rows.map(({ at, values = {} }) =>
    [
      station,
      stamp(at),
      ...COLUMNS.map((taxon) => (values[taxon] === null ? '' : String(values[taxon] ?? 0))),
    ].join(';'),
  );
  return `${[HEADER, ...lines].join('\r\n')}\r\n`;
}

/**
 * @description Hourly rows ending at an instant.
 * @param {number} end - The last hour (end of interval).
 * @param {number} count - Hours.
 * @param {object|Function} [values] - The values, or `(index, at) => values`.
 * @returns {Array<{ at: number, values: object }>} The rows, oldest first.
 */
function hours(end, count, values = {}) {
  return Array.from({ length: count }, (_, index) => {
    const at = end - (count - 1 - index) * HOUR;
    return { at, values: typeof values === 'function' ? values(index, at) : values };
  });
}

/**
 * @description A simple ETag of a text.
 * @param {string} text - The text.
 * @returns {string} The ETag.
 */
function etagOf(text) {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }
  return `"${hash.toString(16)}-1"`;
}

/**
 * @description A fake MeteoSwiss server.
 * @param {object} [options] - Options.
 * @param {object} [options.files] - `{ 'PBE/now': text, 'PBE/recent': text }`.
 * @param {object} [options.errors] - `{ 'PBE/now': 404 | 403 | 500 | 'network' }`.
 * @returns {Function} A fetch function, with `requests`, `files` and `errors` to change.
 */
function fakeMeteoSwiss({ files = { 'PBE/now': FILES.now }, errors = {} } = {}) {
  const requests = [];
  const fake = async (url, init = {}) => {
    const headers = init.headers ?? {};
    const match = /\/([a-z]{3})\/ogd-pollen_([a-z]{3})_h_(now|recent)\.csv$/.exec(url);
    requests.push({ url, headers });
    if (!match) {
      return new Response('not found', { status: 404 });
    }
    const key = `${match[1].toUpperCase()}/${match[3]}`;
    const error = fake.errors[key] ?? fake.errors['*'];
    if (error === 'network') {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    }
    if (error) {
      return new Response('error', { status: error });
    }
    const text = fake.files[key];
    if (text === undefined) {
      return new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 });
    }
    const etag = etagOf(text);
    if (headers['if-none-match'] === etag) {
      return new Response(null, { status: 304, headers: { etag } });
    }
    return new Response(Buffer.from(text, 'latin1'), {
      status: 200,
      headers: { 'content-type': 'text/csv', etag },
    });
  };
  fake.requests = requests;
  fake.files = { ...files };
  fake.errors = { ...errors };
  return fake;
}

/**
 * @description A temporary path for the file kept in /data.
 * @returns {string} The path (its directory exists, the file does not).
 */
const storePath = () => join(mkdtempSync(join(tmpdir(), 'meteoswiss-')), 'meteoswiss-pollen.json');

// A Gladys client only used for its external ids (selector `test-integration`).
const fakeGladys = createFakeGladys({});
const BERN = stationOf('PBE');
const ZURICH = stationOf('PZH');

/**
 * @description A history object from rows.
 * @param {Array<{ at: number, values?: object }>} rows - Rows.
 * @returns {object} `{ [at]: values }`, every taxon present.
 */
const historyOf = (rows) =>
  Object.fromEntries(
    rows.map(({ at, values = {} }) => [
      at,
      Object.fromEntries(
        TAXA.map((taxon) => [taxon, values[taxon] === undefined ? 0 : values[taxon]]),
      ),
    ]),
  );

export {
  HOUR,
  NOW,
  TODAY,
  SPRING_NOW,
  TZ,
  FILES,
  HEADER,
  silent,
  fixture,
  stamp,
  csvOf,
  hours,
  etagOf,
  fakeMeteoSwiss,
  storePath,
  fakeGladys,
  historyOf,
  BERN,
  ZURICH,
};
