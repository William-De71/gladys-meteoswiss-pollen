// The manifest against the code: the keys it declares are the ones the code
// handles, the store limits hold, the transport and permissions are right.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { TRIGGERS, ACTION_OUTPUTS } from '../src/events.js';
import { SCENE_ACTIONS, ACTIONS } from '../src/app.js';
import { WIDGETS } from '../src/widgets.js';
import { MAX_STATIONS, AUTO_LANGUAGE } from '../src/config.js';
import { STATIONS } from '../src/stations.js';
import { BASE_URL } from '../src/meteoswiss.js';
import { TAXA } from '../src/pollen.js';
import { LANGUAGES } from '../src/i18n.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const lock = read('../package-lock.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'MeteoSwiss Pollen');
  assert.equal(manifest.version, pkg.version);
  assert.match(pkg.version, /^0\.\d+\.\d+$/);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(
    manifest.docker_image,
    `ghcr.io/william-de71/gladys-meteoswiss-pollen:${pkg.version}`,
  );
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/William-De71/gladys-meteoswiss-pollen/main/cover.jpg',
  );
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-meteoswiss-pollen');
});

test('declares the cloud transport only: the open data files of MeteoSwiss', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.doesNotMatch(source('../src/app.js'), /publishTransports|GLADYS_PREFER_LOCAL/);
  assert.match(BASE_URL, /^https:\/\/data\.geo\.admin\.ch\/ch\.meteoschweiz\.ogd-pollen$/);
});

test('requires Gladys 5.3.0 (catalog keywords and countries); no permission at all', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.deepEqual(manifest.categories, ['environment']);
  for (const key of ['location', 'network_wake', 'containers', 'network_discovery', 'webhooks']) {
    assert.equal(manifest[key], undefined, key);
  }
  assert.doesNotMatch(source('../src/app.js'), /getHouses\(\)/);
  assert.ok(
    manifest.config_schema.every((field) => field.source !== 'houses'),
    'a houses select needs 5.2.0',
  );
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key).sort(),
    Object.values(TRIGGERS).sort(),
  );
  assert.deepEqual(
    manifest.scene_actions.map((action) => action.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key).sort(),
    Object.values(WIDGETS).sort(),
  );
  const app = source('../src/app.js');
  for (const key of Object.keys(WIDGETS)) {
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  }
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  assert.deepEqual(
    manifest.actions.map((action) => action.key),
    Object.values(ACTIONS),
  );
  for (const key of Object.keys(ACTIONS)) {
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  }
  const action = byKey(manifest.scene_actions).get(SCENE_ACTIONS.GET_POLLEN);
  assert.deepEqual(
    action.outputs.map((output) => output.key),
    ACTION_OUTPUTS,
  );
  const trigger = byKey(manifest.scene_triggers).get(TRIGGERS.POLLEN_ALERT);
  assert.deepEqual(values(byKey(trigger.fields).get('pollen_type')), TAXA);
  assert.deepEqual(values(byKey(trigger.fields).get('level')), ['2', '3', '4']);
});

test('the stations of the code, the same list in the three slots, no secret', () => {
  const config = byKey(manifest.config_schema);
  const ids = STATIONS.map((station) => station.id);
  for (let slot = 1; slot <= MAX_STATIONS; slot += 1) {
    const field = config.get(`station_${slot}`);
    assert.equal(field.type, 'select', `station_${slot}`);
    assert.deepEqual(values(field), ids, `station_${slot}`);
    assert.deepEqual(
      field.options.map((option) => option.label.en),
      STATIONS.map((station) => station.name),
    );
  }
  assert.equal(config.get('station_1').required, true);
  assert.equal(config.get('station_2').required, false);
  assert.equal(config.get(`station_${MAX_STATIONS + 1}`), undefined);
  assert.equal(new Set(ids).size, 15);
  assert.ok(manifest.config_schema.every((field) => field.type !== 'secret'));
  for (const field of manifest.config_schema) {
    assert.ok(!['text', 'password', 'number'].includes(field.type), `${field.key}: ${field.type}`);
    assert.equal(field.display_if, undefined, field.key);
  }
});

test('limits of the store: counts, timeouts, sizes, no secret in widget settings', () => {
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  assert.ok(manifest.scene_triggers.length <= 20);
  assert.ok(manifest.scene_actions.length <= 20);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
    assert.ok(trigger.key.length <= 40);
  }
  for (const action of [...manifest.scene_actions, ...manifest.actions]) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
    assert.ok(
      (action.fields ?? []).length <= 10 && (action.outputs ?? []).length <= 20,
      action.key,
    );
  }
  for (const widget of manifest.widgets) {
    assert.ok((widget.settings ?? []).length <= 10);
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8, 'cover.jpg is a JPEG');
});

test('offers the languages of the code, automatic by default', () => {
  const field = byKey(manifest.config_schema).get('language');
  assert.deepEqual(values(field), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(field.default, AUTO_LANGUAGE);
});

test('catalog of Gladys 5.3.0: search keywords within the store bounds, Switzerland only', () => {
  const { keywords } = manifest;
  assert.ok(Array.isArray(keywords) && keywords.length >= 1 && keywords.length <= 10);
  const normalized = keywords.map((keyword) => keyword.trim().toLowerCase());
  for (const keyword of normalized) {
    assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword);
  }
  assert.equal(new Set(normalized).size, normalized.length, 'unique once trimmed and lowercased');
  assert.ok(!normalized.includes(manifest.name.toLowerCase()), 'never the name itself');
  assert.deepEqual(manifest.countries, ['CH'], 'stations in Switzerland only');
});
