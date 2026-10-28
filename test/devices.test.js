// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): a device is only polled with
// should_poll AND poll_frequency, every feature needs min / max / read_only /
// has_feedback, a wrong category / type pair shows no icon nor label, and a
// single invalid field rejects the whole discovery batch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

import {
  DEVICE_TYPE,
  FEATURES,
  MAX_CONCENTRATION,
  buildDevice,
  buildStates,
  idsOf,
  stationIdOf,
  mainPollenText,
} from '../src/device.js';
import { STATIONS } from '../src/stations.js';
import { TAXA, parseHourlyCsv, mergeHistory, snapshotOf, STALE_AFTER_MS } from '../src/pollen.js';
import { LANGUAGES } from '../src/i18n.js';
import { fakeGladys, FILES, NOW, SPRING_NOW, HOUR, BERN, hours } from './helpers/fixtures.js';

const devices = (language) =>
  STATIONS.map((station) => buildDevice(fakeGladys, station, { language }));
const snapshotFrom = (text, now) => snapshotOf(mergeHistory({}, parseHourlyCsv(text, 'PBE')), now);
const october = snapshotFrom(FILES.now, NOW);
const spring = snapshotFrom(FILES.spring, SPRING_NOW);

// DEVICE_FEATURE_UNITS_BY_CATEGORY of the Gladys core (server/utils/constants.js).
const UNITS = { 'airquality-sensor': [DEVICE_FEATURE_UNITS.AQI] };
// Pairs with an icon in the Gladys front (front/src/utils/consts.js).
const PAIRS = [
  [DEVICE_FEATURE_CATEGORIES.AIRQUALITY_SENSOR, DEVICE_FEATURE_TYPES.AIRQUALITY_SENSOR.AQI],
  [DEVICE_FEATURE_CATEGORIES.TEXT, DEVICE_FEATURE_TYPES.TEXT.TEXT],
];

test('devices are never polled by Gladys: the integration has its own timer', () => {
  for (const device of devices('en')) {
    assert.equal(device.should_poll, false, device.external_id);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('16 features: the level, then concentration and level per taxon, the main pollen', () => {
  assert.equal(FEATURES.length, 16);
  assert.deepEqual(
    FEATURES.map((spec) => spec.key),
    ['level', ...TAXA, ...TAXA.map((taxon) => `${taxon}_level`), 'main_pollen'],
  );
});

test('every feature carries min, max, read_only and has_feedback, in every language', () => {
  for (const language of LANGUAGES) {
    for (const device of devices(language)) {
      for (const feature of device.features) {
        for (const key of ['min', 'max', 'read_only', 'has_feedback']) {
          assert.notEqual(feature[key], undefined, `${feature.external_id}.${key}`);
        }
        assert.ok(feature.min <= feature.max, feature.external_id);
        assert.equal(feature.read_only, true);
        assert.ok(feature.name.trim(), feature.external_id);
      }
    }
  }
});

test('category / type pairs come from the SDK constants, no unit outside the allowed ones', () => {
  for (const feature of devices('en')[0].features) {
    assert.ok(
      PAIRS.some(([category, type]) => feature.category === category && feature.type === type),
      `${feature.external_id}: ${feature.category}/${feature.type}`,
    );
    if (feature.unit !== undefined) {
      assert.ok(UNITS[feature.category]?.includes(feature.unit), feature.external_id);
    }
  }
  const byKey = new Map(FEATURES.map((spec) => [spec.key, spec.shape]));
  assert.deepEqual([byKey.get('level').min, byKey.get('level').max], [0, 4]);
  assert.deepEqual([byKey.get('birch').min, byKey.get('birch').max], [0, MAX_CONCENTRATION]);
  assert.equal(byKey.get('birch').unit, undefined, 'no AQI unit on a concentration');
});

test('external ids: the MeteoSwiss abbreviation, unique, readable back', () => {
  const all = devices('en');
  const ids = all.flatMap((device) => [
    device.external_id,
    ...device.features.map((f) => f.external_id),
  ]);
  assert.equal(new Set(ids).size, ids.length);
  const bern = buildDevice(fakeGladys, BERN, { language: 'en' });
  assert.equal(bern.external_id, `ext:test-integration:${DEVICE_TYPE}:PBE`);
  assert.equal(bern.features[1].external_id, 'ext:test-integration:station:PBE:hazel');
  assert.equal(stationIdOf(bern.external_id), 'PBE');
  assert.equal(stationIdOf(bern.features[15].external_id), 'PBE');
  assert.equal(stationIdOf('ext:x:station:pbe'), null);
  assert.equal(stationIdOf(undefined), null);
  assert.equal(idsOf(fakeGladys, 'PZH').device, 'ext:test-integration:station:PZH');
});

test('names and params in the language of the user', () => {
  const fr = buildDevice(fakeGladys, BERN, { language: 'fr' });
  assert.equal(fr.name, 'Pollens Bern');
  assert.equal(fr.features[4].name, 'Pollens Bouleau (dernière heure)');
  assert.equal(buildDevice(fakeGladys, BERN, { language: 'de' }).name, 'Pollen Bern');
  assert.deepEqual(
    fr.params.map((param) => param.name),
    ['STATION', 'CANTON', 'LATITUDE', 'LONGITUDE', 'ALTITUDE'],
  );
  assert.ok(fr.params.every((param) => typeof param.value === 'string'));
});

test('the fake Gladys accepts the discovery of every station', async () => {
  const gladys = createFakeGladys({});
  await gladys.connect();
  await gladys.publishDiscoveredDevices(STATIONS.map((station) => buildDevice(gladys, station)));
  assert.equal(gladys.fake.discoveredDevices.length, STATIONS.length);
});

test('states of the birch peak: concentrations, levels, the main pollen', () => {
  const states = buildStates(fakeGladys, 'PBE', spring, { language: 'en' });
  assert.equal(states.length, 16);
  const byKey = Object.fromEntries(
    states.map((state) => [state.device_feature_external_id.split(':').at(-1), state]),
  );
  assert.equal(byKey.level.state, 4);
  assert.equal(byKey.birch.state, 1308);
  assert.equal(byKey.birch_level.state, 4);
  assert.match(byKey.main_pollen.text, /^Birch: very high \(\d+\/m³\)$/);
  assert.equal(byKey.main_pollen.state, undefined);
});

test('states out of season: zeros, the main pollen is a dash', () => {
  const states = buildStates(fakeGladys, 'PBE', october, { language: 'fr' });
  assert.equal(states.length, 16);
  assert.ok(states.filter((state) => 'state' in state).every((state) => state.state === 0));
  assert.equal(states.at(-1).text, '-');
});

test('no state for a stale station, an empty history, or an unknown value', () => {
  const stale = snapshotFrom(FILES.now, NOW + STALE_AFTER_MS + HOUR);
  assert.deepEqual(buildStates(fakeGladys, 'PBE', stale), []);
  assert.deepEqual(buildStates(fakeGladys, 'PBE', snapshotOf({}, NOW)), []);
  assert.deepEqual(buildStates(fakeGladys, 'PBE', null), []);
  // A few hours only: the last hour is known, the levels are not.
  const short = snapshotOf(mergeHistory({}, hours(NOW, 3, { birch: 5 })), NOW);
  const states = buildStates(fakeGladys, 'PBE', short);
  const keys = states.map((state) => state.device_feature_external_id.split(':').at(-1));
  assert.ok(keys.includes('birch'));
  assert.ok(!keys.includes('level') && !keys.includes('birch_level'));
  assert.ok(keys.includes('main_pollen'));
});

test('a concentration above the bounds is capped', () => {
  const huge = snapshotOf(mergeHistory({}, hours(NOW, 24, { birch: 99999 })), NOW);
  const birch = buildStates(fakeGladys, 'PBE', huge).find((state) =>
    state.device_feature_external_id.endsWith(':birch'),
  );
  assert.equal(birch.state, MAX_CONCENTRATION);
});

test('main pollen text: null without measurement, in four languages', () => {
  assert.equal(mainPollenText(null, 'en'), null);
  assert.equal(mainPollenText(snapshotOf({}, NOW), 'en'), null);
  assert.match(mainPollenText(spring, 'fr'), /^Bouleau : très fort \(\d+\/m³\)$/);
  assert.match(mainPollenText(spring, 'de'), /^Birke: sehr stark/);
  assert.match(mainPollenText(spring, 'es'), /^Abedul: muy alto/);
});
