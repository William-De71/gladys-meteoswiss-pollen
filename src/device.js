// -----------------------------------------------------------------------------
// One Gladys device per pollen station: "Pollen Bern".
//
// External ids: `ext:<selector>:station:<abbr>` and
// `…:station:<abbr>:<feature key>`, the MeteoSwiss abbreviation of the
// station (PBE, PZH…): MeteoSwiss's own identifier, it never changes.
//
// Features (category / type, chosen from the SDK constants):
//   - the pollen level now, the highest of the seven taxa:
//     `airquality-sensor` / `aqi`, 0 (none) to 4 (very high). A level, not a
//     concentration;
//   - per taxon, the concentration of the last hour, in pollen per m³:
//     `airquality-sensor` / `aqi` without a unit, 0 to 20 000 (Gladys has no
//     pollen unit, and the only `airquality-sensor` unit is AQI, which would
//     be wrong);
//   - per taxon, the level of the mean of the last 24 hours, 0 to 4;
//   - the main pollen as text ("Birch: high (120/m³)"), in the configured
//     language.
//
// No state is published for an unknown value, nor for a stale station (no new
// measurement for six hours): a scene comparing "level ≥ 3" must not see an
// old or fake value. `should_poll` stays false: MeteoSwiss is read on the
// integration's own timer.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';

import { t, levelLabel } from './i18n.js';
import { TAXA, mainTaxon } from './pollen.js';

const DEVICE_TYPE = 'station';
const MODEL = 'MeteoSwiss pollen station';
const MAX_CONCENTRATION = 20000;

const level = {
  category: CATEGORIES.AIRQUALITY_SENSOR,
  type: TYPES.AIRQUALITY_SENSOR.AQI,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: 4,
};
const concentration = {
  category: CATEGORIES.AIRQUALITY_SENSOR,
  type: TYPES.AIRQUALITY_SENSOR.AQI,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: MAX_CONCENTRATION,
};
const text = {
  category: CATEGORIES.TEXT,
  type: TYPES.TEXT.TEXT,
  read_only: true,
  has_feedback: false,
  keep_history: false,
  min: 0,
  max: 0,
};

/**
 * @description The main pollen of a station as text.
 * @param {object|null} snapshot - snapshotOf.
 * @param {string} language - The language.
 * @returns {string|null} "Birch: high (120/m³)", '-' when no pollen is in the
 * air, null without a measurement.
 */
function mainPollenText(snapshot, language) {
  if (!snapshot?.measuredAt) {
    return null;
  }
  const taxon = mainTaxon(snapshot);
  if (!taxon) {
    return '-';
  }
  const entry = snapshot.taxa[taxon];
  return t('mainPollen', language, {
    taxon: t(`taxon_${taxon}`, language),
    label: levelLabel(entry.level, language).toLowerCase(),
    count: entry.mean,
  });
}

const usable = (value) => (Number.isFinite(value) ? value : null);

// The features: key (eternal), name (TEXTS key and values), shape, and the
// state of a station's snapshot (null: nothing to publish).
const FEATURES = [
  {
    key: 'level',
    name: ['feature_level'],
    shape: level,
    state: (snapshot) => usable(snapshot.level),
  },
  ...TAXA.map((taxon) => ({
    key: taxon,
    name: ['feature_concentration', (language) => ({ taxon: t(`taxon_${taxon}`, language) })],
    shape: concentration,
    state: (snapshot) => {
      const value = usable(snapshot.taxa[taxon]?.lastHour);
      return value === null ? null : Math.min(MAX_CONCENTRATION, Math.round(value));
    },
  })),
  ...TAXA.map((taxon) => ({
    key: `${taxon}_level`,
    name: ['feature_taxon_level', (language) => ({ taxon: t(`taxon_${taxon}`, language) })],
    shape: level,
    state: (snapshot) => usable(snapshot.taxa[taxon]?.level),
  })),
  {
    key: 'main_pollen',
    name: ['feature_main'],
    shape: text,
    state: (snapshot, language) => {
      const value = mainPollenText(snapshot, language);
      return value === null ? null : { text: value };
    },
  },
];

/**
 * @description The ids of a station device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} stationId - `PBE`.
 * @returns {{ device: string, feature: Function }} The ids.
 */
const idsOf = (gladys, stationId) => gladys.externalIds(DEVICE_TYPE, stationId);

/**
 * @description The station a device (or feature) external id stands for.
 * @param {unknown} externalId - The external id.
 * @returns {string|null} The abbreviation.
 * @example
 * stationIdOf('ext:meteoswiss-pollen:station:PBE:level'); // -> 'PBE'
 */
function stationIdOf(externalId) {
  const match = /:station:([A-Z]{3})(?::[a-z0-9_]+)?$/.exec(String(externalId ?? ''));
  return match ? match[1] : null;
}

/**
 * @description The name of a feature.
 * @param {object} spec - The spec.
 * @param {string} language - The language.
 * @returns {string} The name.
 */
function featureName(spec, language) {
  const [key, values] = spec.name;
  return t(key, language, typeof values === 'function' ? values(language) : {});
}

/**
 * @description The device of a station.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {object} station - A station of stations.js.
 * @param {object} options - `{ language }`.
 * @returns {object} The discovered device.
 */
function buildDevice(gladys, station, { language = 'en' } = {}) {
  const ids = idsOf(gladys, station.id);
  return {
    name: t('deviceName', language, { station: station.name }),
    external_id: ids.device,
    model: MODEL,
    should_poll: false,
    params: [
      { name: 'STATION', value: station.id },
      { name: 'CANTON', value: station.canton },
      { name: 'LATITUDE', value: String(station.latitude) },
      { name: 'LONGITUDE', value: String(station.longitude) },
      { name: 'ALTITUDE', value: String(station.altitude) },
    ],
    features: FEATURES.map((spec) => ({
      name: featureName(spec, language),
      external_id: ids.feature(spec.key),
      ...spec.shape,
    })),
  };
}

/**
 * @description The states of a station device.
 * @param {object} gladys - The GladysIntegration instance.
 * @param {string} stationId - The station.
 * @param {object} snapshot - snapshotOf.
 * @param {object} options - `{ language }`.
 * @returns {object[]} The states; none for a stale station.
 */
function buildStates(gladys, stationId, snapshot, { language = 'en' } = {}) {
  if (!snapshot?.measuredAt || snapshot.stale) {
    return [];
  }
  const ids = idsOf(gladys, stationId);
  return FEATURES.flatMap((spec) => {
    const value = spec.state(snapshot, language);
    if (value === null || value === undefined) {
      return [];
    }
    const id = ids.feature(spec.key);
    return [
      typeof value === 'object'
        ? { device_feature_external_id: id, text: value.text }
        : { device_feature_external_id: id, state: value },
    ];
  });
}

export {
  DEVICE_TYPE,
  FEATURES,
  MAX_CONCENTRATION,
  idsOf,
  stationIdOf,
  mainPollenText,
  buildDevice,
  buildStates,
};
