// The client of the MeteoSwiss files: URLs, headers, conditional requests,
// error kinds, pace. Against the fake server of the helpers.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_URL,
  PAUSE_MS,
  USER_AGENT,
  MeteoSwissError,
  fileUrl,
  createMeteoSwissClient,
} from '../src/meteoswiss.js';
import { FILES, fakeMeteoSwiss } from './helpers/fixtures.js';

/**
 * @description A client on a fake server, with a fake clock.
 * @param {object} [server] - Options of fakeMeteoSwiss.
 * @returns {object} `{ client, server, pauses, clock }`.
 */
function setup(server = {}) {
  const fake = fakeMeteoSwiss(server);
  const pauses = [];
  const clock = { now: 1000 };
  const client = createMeteoSwissClient({
    fetch: fake,
    now: () => clock.now,
    sleep: async (ms) => {
      pauses.push(ms);
      clock.now += ms;
    },
  });
  return { client, server: fake, pauses, clock };
}

test('the URLs of the STAC collection, lower-case abbreviation', () => {
  assert.equal(BASE_URL, 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-pollen');
  assert.equal(
    fileUrl('PBE', 'now'),
    'https://data.geo.admin.ch/ch.meteoschweiz.ogd-pollen/pbe/ogd-pollen_pbe_h_now.csv',
  );
  assert.equal(
    fileUrl('PZH', 'recent'),
    'https://data.geo.admin.ch/ch.meteoschweiz.ogd-pollen/pzh/ogd-pollen_pzh_h_recent.csv',
  );
});

test('reads the rows and the ETag, with a user agent naming the project', async () => {
  const { client, server } = setup();
  const result = await client.hourly('PBE');
  assert.equal(result.rows.length, 21);
  assert.match(result.etag, /^".+"$/);
  const [request] = server.requests;
  assert.equal(request.url, fileUrl('PBE', 'now'));
  assert.equal(request.headers['user-agent'], USER_AGENT);
  assert.match(USER_AGENT, /gladys-meteoswiss-pollen/);
  assert.equal(request.headers['if-none-match'], undefined);
  assert.equal(client.requests.total, 1);
});

test('a known ETag gives a 304: nothing to read again', async () => {
  const { client, server } = setup();
  const first = await client.hourly('PBE');
  const second = await client.hourly('PBE', { etag: first.etag });
  assert.deepEqual(second, { notModified: true });
  assert.equal(server.requests[1].headers['if-none-match'], first.etag);
  assert.equal(client.requests.notModified, 1);
  server.files['PBE/now'] = FILES.spring;
  const third = await client.hourly('PBE', { etag: first.etag });
  assert.equal(third.rows.length, 72, 'a changed file is read');
});

test('the yearly file on demand', async () => {
  const { client, server } = setup({ files: { 'PBE/recent': FILES.spring } });
  const result = await client.hourly('PBE', { period: 'recent' });
  assert.equal(result.rows.length, 72);
  assert.equal(server.requests[0].url, fileUrl('PBE', 'recent'));
});

test('error kinds: not_found, blocked, unreachable, invalid', async () => {
  const cases = [
    [{ errors: { 'PBE/now': 404 } }, 'not_found', 404],
    [{ files: {} }, 'not_found', 404],
    [{ errors: { 'PBE/now': 403 } }, 'blocked', 403],
    [{ errors: { 'PBE/now': 429 } }, 'blocked', 429],
    [{ errors: { 'PBE/now': 500 } }, 'unreachable', 500],
    [{ errors: { 'PBE/now': 'network' } }, 'unreachable', null],
    [{ files: { 'PBE/now': '<html>maintenance</html>' } }, 'invalid', null],
  ];
  for (const [server, kind, status] of cases) {
    const { client } = setup(server);
    await assert.rejects(client.hourly('PBE'), (err) => {
      assert.ok(err instanceof MeteoSwissError);
      assert.equal(err.kind, kind, JSON.stringify(server));
      assert.equal(err.status, status);
      return true;
    });
  }
  const { client } = setup({ errors: { 'PBE/now': 'network' } });
  await assert.rejects(client.hourly('PBE'), /ECONNREFUSED/);
});

test('one request at a time, half a second apart; a failure does not block the queue', async () => {
  const { client, pauses } = setup({
    files: { 'PBE/now': FILES.now },
    errors: { 'PZH/now': 500 },
  });
  const results = await Promise.allSettled([
    client.hourly('PBE'),
    client.hourly('PZH'),
    client.hourly('PBE'),
  ]);
  assert.deepEqual(
    results.map((result) => result.status),
    ['fulfilled', 'rejected', 'fulfilled'],
  );
  assert.deepEqual(pauses, [PAUSE_MS, PAUSE_MS]);
  assert.equal(client.requests.total, 3);
});

test('Windows-1252 bytes are read as Latin-1', async () => {
  const text =
    'station_abbr;reference_timestamp;kabetuh0\r\nPBE;28.10.2026 20:00;4\r\n# Zürich\r\n';
  const fake = async () =>
    new Response(Buffer.from(text, 'latin1'), { status: 200, headers: { etag: '"x"' } });
  const client = createMeteoSwissClient({ fetch: fake, sleep: async () => {} });
  const result = await client.hourly('PBE');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].values.birch, 4);
});
