// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`), which checks the discovered
// devices, the states and the scene events like the host API does, and a
// fake MeteoSwiss serving the recorded files of Bern and synthetic ones.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import {
  createApp,
  SCENE_ACTIONS,
  ACTIONS,
  RETRY_DELAYS_MIN,
  REFRESH_MIN_INTERVAL_MS,
  recentHours,
} from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { TRIGGERS, ACTION_OUTPUTS } from '../src/events.js';
import { READ_INTERVAL_MS, MINUTE_MS } from '../src/time.js';
import {
  FILES,
  HOUR,
  NOW,
  TZ,
  csvOf,
  hours,
  fakeMeteoSwiss,
  storePath,
  silent,
} from './helpers/fixtures.js';

const CONFIG = { station_1: 'PBE', station_2: 'PZH', language: 'fr' };
const BERN = 'ext:test-integration:station:PBE';
const ZURICH = 'ext:test-integration:station:PZH';
const LAST_HOUR = Date.parse('2026-10-28T20:00:00Z');

/**
 * @description The files of a fake MeteoSwiss: the recorded real-time file of
 * Bern (21 hours, too short: the yearly file completes it), 24 hours for Zürich.
 * @returns {object} The files.
 */
const files = () => ({
  'PBE/now': FILES.now,
  'PBE/recent': csvOf('PBE', hours(LAST_HOUR - 21 * HOUR, 24)),
  'PZH/now': csvOf('PZH', hours(LAST_HOUR, 24)),
  'PZH/recent': csvOf('PZH', hours(LAST_HOUR - 24 * HOUR, 24)),
});

/**
 * @description The integration, connected to a fake Gladys and a fake MeteoSwiss.
 * @param {object} [options] - `{ config, server, path, now, logger }`.
 * @returns {Promise<object>} `{ gladys, app, server, clock, path }`.
 */
async function startApp({
  config = CONFIG,
  server = fakeMeteoSwiss({ files: files() }),
  path = storePath(),
  now = NOW,
  logger = silent,
} = {}) {
  const clock = { now };
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, {
    fetch: server,
    sleep: async () => {},
    storePath: path,
    now: () => clock.now,
    timeZone: TZ,
    timers: false,
    logger,
  });
  await gladys.connect();
  await app.whenReady();
  return { gladys, app, server, clock, path };
}

const created = async (gladys, externalId) => {
  const device = gladys.fake.discoveredDevices.find((d) => d.external_id === externalId);
  assert.ok(device, `${externalId} is offered`);
  await gladys.fake.deviceCreated(device);
  return device;
};
const paths = (server) => server.requests.map((request) => request.url.split('/').at(-1));

test('startup: the stations are read, the yearly file completes a short history', async (t) => {
  const { gladys, server, app } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.deepEqual(paths(server), [
    'ogd-pollen_pbe_h_now.csv',
    'ogd-pollen_pbe_h_recent.csv',
    'ogd-pollen_pzh_h_now.csv',
  ]);
  assert.ok(recentHours(app.store.data.history.PBE) >= 24);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => [device.external_id, device.name]),
    [
      [BERN, 'Pollens Bern'],
      [ZURICH, 'Pollens Zürich'],
    ],
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(gladys.fake.connectionStatus.message.fr, /^MétéoSuisse lu : Bern nul, Zürich nul\./);
  assert.match(gladys.fake.connectionStatus.message.en, /Bern none, Zürich none/);
});

test('states only for the created devices, all of them again on creation', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.states.length, 0, 'nothing before a device exists');
  await created(gladys, BERN);
  assert.equal(gladys.fake.lastState(`${BERN}:level`), 0);
  assert.equal(gladys.fake.lastState(`${BERN}:birch`), 0);
  assert.equal(gladys.fake.lastState(`${BERN}:main_pollen`), '-');
  assert.equal(gladys.fake.lastState(`${ZURICH}:level`), undefined);
  assert.ok(gladys.fake.widgetRefreshes.length > 0);
});

test('the next readings are conditional: 304, no yearly file again', async (t) => {
  const { gladys, app, server, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  clock.now += READ_INTERVAL_MS;
  await app.tick();
  assert.equal(server.requests.length, 5);
  assert.ok(server.requests.slice(3).every((request) => request.headers['if-none-match']));
  assert.equal(app.client.requests.notModified, 2);
});

test('a restart before the next reading makes no request', async (t) => {
  const first = await startApp();
  first.gladys.fake.shutdown();
  const second = await startApp({ path: first.path, now: NOW + 5 * MINUTE_MS });
  t.after(() => second.gladys.fake.shutdown());
  assert.equal(second.server.requests.length, 0);
  assert.equal(second.gladys.fake.discoveredDevices.length, 2);
  assert.equal(second.gladys.fake.connectionStatus.connected, true);
});

test('a pollen rise fires the alert once, after the baseline', async (t) => {
  const { gladys, app, server, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await created(gladys, BERN);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'the first reading is a baseline');
  server.files['PBE/now'] = csvOf('PBE', hours(LAST_HOUR + HOUR, 24, { birch: 400 }));
  clock.now = NOW + HOUR;
  await app.read();
  assert.equal(gladys.fake.sceneEvents.length, 1);
  const [event] = gladys.fake.sceneEvents;
  assert.equal(event.key, TRIGGERS.POLLEN_ALERT);
  assert.equal(event.data.station, BERN);
  assert.equal(event.data.pollen_type, 'birch');
  assert.equal(event.data.level, 4);
  assert.equal(event.data.label, 'Très fort');
  assert.equal(gladys.fake.lastState(`${BERN}:birch_level`), 4);
  assert.match(gladys.fake.lastState(`${BERN}:main_pollen`), /^Bouleau : très fort/);
  clock.now += READ_INTERVAL_MS;
  await app.read();
  assert.equal(gladys.fake.sceneEvents.length, 1, 'never twice the same day');
});

test('every station down: disconnected, then the retry delays', async (t) => {
  const server = fakeMeteoSwiss({ files: files(), errors: { '*': 500 } });
  const { gladys, app, clock } = await startApp({ server });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /cannot be reached \(HTTP 500\)/);
  assert.equal(app.getRetryAt(), NOW + RETRY_DELAYS_MIN[0] * MINUTE_MS);
  clock.now = app.getRetryAt();
  await app.tick();
  assert.equal(app.getRetryAt(), clock.now + RETRY_DELAYS_MIN[1] * MINUTE_MS);
  server.errors = {};
  clock.now = app.getRetryAt();
  await app.tick();
  assert.equal(app.getRetryAt(), null);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('blocked and unreadable answers have their own message', async (t) => {
  const blocked = await startApp({
    server: fakeMeteoSwiss({ files: files(), errors: { '*': 403 } }),
  });
  t.after(() => blocked.gladys.fake.shutdown());
  assert.match(blocked.gladys.fake.connectionStatus.message.fr, /refuse les requêtes \(HTTP 403\)/);
  const invalid = await startApp({
    server: fakeMeteoSwiss({
      files: { ...files(), 'PBE/now': 'oops', 'PZH/now': 'oops' },
    }),
  });
  t.after(() => invalid.gladys.fake.shutdown());
  assert.match(invalid.gladys.fake.connectionStatus.message.en, /could not be read/);
});

test('one station down: still connected, the problem in the message', async (t) => {
  const server = fakeMeteoSwiss({ files: files(), errors: { 'PZH/now': 404 } });
  const { gladys, app } = await startApp({ server });
  t.after(() => gladys.fake.shutdown());
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.match(
    gladys.fake.connectionStatus.message.en,
    /Zürich: not read \(no now file for PZH\)\./,
  );
  assert.equal(app.getRetryAt(), null);
});

test('no station chosen: disconnected with a hint, nothing read', async (t) => {
  const { gladys, server } = await startApp({ config: {} });
  t.after(() => gladys.fake.shutdown());
  assert.equal(server.requests.length, 0);
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.equal(gladys.fake.connectionStatus.message.en, 'Choose at least one pollen station.');
  const answer = await gladys.fake.action(ACTIONS.REFRESH);
  assert.equal(answer.data.message.en, 'Choose at least one pollen station.');
  const {
    data: { content },
  } = await gladys.fake.widgetGet(WIDGETS.STATION, { language: 'fr' });
  assert.match(content.components[0].text, /Choisissez une station pollinique/);
});

test('widgets: the first station by default, or the chosen one, valid contents', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  for (const key of Object.values(WIDGETS)) {
    for (const settings of [{}, { station: ZURICH }]) {
      const {
        data: { content },
      } = await gladys.fake.widgetGet(key, { settings, language: 'de' });
      assert.deepEqual(validateWidgetContent(content), [], key);
      assert.equal(content.components[0].text, settings.station ? 'Zürich (ZH)' : 'Bern (BE)');
    }
  }
});

test('a widget remembers the language for the texts of the scenes', async (t) => {
  const { gladys } = await startApp({ config: { station_1: 'PBE' } });
  t.after(() => gladys.fake.shutdown());
  const before = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_POLLEN, {});
  assert.equal(before.data.outputs.label, 'Keine', 'German until a widget is shown');
  await gladys.fake.widgetGet(WIDGETS.STATION, { language: 'es' });
  const after = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_POLLEN, {});
  assert.equal(after.data.outputs.label, 'Nulo');
});

test('the scene action reads a station, the first by default; an unknown one fails', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const {
    data: { outputs },
  } = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_POLLEN, { station: ZURICH });
  assert.deepEqual(Object.keys(outputs), ACTION_OUTPUTS);
  assert.equal(outputs.station_name, 'Zürich');
  assert.equal(outputs.level, 0);
  assert.equal(outputs.label, 'Nul');
  assert.equal(outputs.measured_at, new Date(LAST_HOUR).toISOString());
  const first = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_POLLEN, {});
  assert.equal(first.data.outputs.station_name, 'Bern');
  const unknown = await gladys.fake.sceneAction(SCENE_ACTIONS.GET_POLLEN, {
    station: 'ext:test-integration:station:PSN',
  });
  assert.equal(unknown.success, false);
  assert.match(unknown.error, /Unknown station/);
});

test('read now: too soon after a reading, then a new reading with its summary', async (t) => {
  const { gladys, server, clock } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const soon = await gladys.fake.action(ACTIONS.REFRESH);
  assert.match(soon.data.message.en, /^Already read [01] min ago/);
  assert.equal(server.requests.length, 3);
  clock.now = NOW + REFRESH_MIN_INTERVAL_MS + MINUTE_MS;
  const done = await gladys.fake.action(ACTIONS.REFRESH);
  assert.equal(done.data.message.fr, 'MétéoSuisse lu : Bern nul, Zürich nul.');
  assert.equal(server.requests.length, 5);
});

test('the diagnostic writes the state to the logs, in chunks', async (t) => {
  const lines = [];
  const { gladys } = await startApp({ logger: { ...silent, info: (line) => lines.push(line) } });
  t.after(() => gladys.fake.shutdown());
  const answer = await gladys.fake.action(ACTIONS.DIAGNOSTIC);
  assert.match(answer.data.message.en, /Diagnostic written to the Logs tab \(\d+ line\(s\)/);
  const report = JSON.parse(
    lines
      .filter((line) => line.startsWith('Pollen diagnostic'))
      .map((line) => line.replace(/^Pollen diagnostic \d+\/\d+: /, ''))
      .join(''),
  );
  assert.deepEqual(
    report.stations.map((station) => station.id),
    ['PBE', 'PZH'],
  );
  assert.equal(report.requests.total, 3);
  assert.equal(report.timeZone, TZ);
  assert.ok(report.stations[0].hours >= 24);
});

test('a new station in the configuration reads at once; a language change only renames', async (t) => {
  const { gladys, server } = await startApp();
  t.after(() => gladys.fake.shutdown());
  await gladys.fake.configUpdated({ ...CONFIG, language: 'en' });
  assert.equal(server.requests.length, 3, 'no new reading');
  assert.equal(gladys.fake.discoveredDevices[0].name, 'Pollen Bern');
  server.files['PLU/now'] = csvOf('PLU', hours(LAST_HOUR, 24));
  await gladys.fake.configUpdated({ ...CONFIG, station_3: 'PLU', language: 'en' });
  assert.ok(paths(server).includes('ogd-pollen_plu_h_now.csv'));
  assert.equal(gladys.fake.discoveredDevices.length, 3);
});

test('a scan offers the stations again', async (t) => {
  const { gladys } = await startApp();
  t.after(() => gladys.fake.shutdown());
  const before = gladys.fake.bodies('POST', '/discovered_device').length;
  await gladys.fake.scanRequest();
  assert.equal(gladys.fake.bodies('POST', '/discovered_device').length, before + 1);
});

test('the version logged and reported comes from package.json', () => {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.match(version, /^0\.\d+\.\d+$/);
});
