import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_STATIONS,
  AUTO_LANGUAGE,
  DEFAULT_TEXT_LANGUAGE,
  INTERNAL_KEYS,
  normalizeConfig,
  readLanguage,
} from '../src/config.js';

test('empty config: no station, automatic language', () => {
  assert.deepEqual(normalizeConfig(), { stations: [], language: AUTO_LANGUAGE });
  assert.deepEqual(normalizeConfig(null), { stations: [], language: AUTO_LANGUAGE });
  assert.equal(DEFAULT_TEXT_LANGUAGE, 'de');
});

test('up to three stations, in slot order, case and spaces ignored', () => {
  const config = normalizeConfig({ station_1: 'pbe', station_2: ' PZH ', station_3: 'PLU' });
  assert.deepEqual(config.stations, [
    { slot: 1, id: 'PBE' },
    { slot: 2, id: 'PZH' },
    { slot: 3, id: 'PLU' },
  ]);
  assert.equal(MAX_STATIONS, 3);
  assert.equal(normalizeConfig({ station_4: 'PGE' }).stations.length, 0);
});

test('an empty, unknown or repeated station is left out, the slot is kept', () => {
  const config = normalizeConfig({
    station_1: '',
    station_2: 'PJU',
    station_3: 'PZH',
  });
  assert.deepEqual(config.stations, [{ slot: 3, id: 'PZH' }]);
  assert.deepEqual(normalizeConfig({ station_1: 'PZH', station_2: 'pzh' }).stations, [
    { slot: 1, id: 'PZH' },
  ]);
  assert.deepEqual(normalizeConfig({ station_1: 42 }).stations, []);
});

test('language: one of the four, else automatic', () => {
  assert.equal(normalizeConfig({ language: 'fr' }).language, 'fr');
  assert.equal(normalizeConfig({ language: 'it' }).language, AUTO_LANGUAGE);
});

test('the stored language of the last widget request', () => {
  assert.equal(INTERNAL_KEYS.language, 'last_language');
  assert.equal(readLanguage({ last_language: 'fr' }, 'en'), 'fr');
  assert.equal(readLanguage({ last_language: 'french' }, 'en'), 'en');
  assert.equal(readLanguage(undefined, null), null);
});
