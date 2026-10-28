// -----------------------------------------------------------------------------
// The pollen stations of the MeteoSwiss national pollen monitoring network
// that publish real-time hourly values (`ogd-pollen_<abbr>_h_now.csv`).
//
// Source: ogd-pollen_meta_stations.csv of the STAC collection
// `ch.meteoschweiz.ogd-pollen` (2026-10-28). The three-letter abbreviation is
// MeteoSwiss's own station identifier: it is the device id and never changes.
// Jungfraujoch (PJU) stopped its real-time values in June 2026 and Coldrerio,
// Meyrin and Visp publish no file: they are left out. The manifest offers the
// same list (test/manifest.test.js keeps both in step).
// -----------------------------------------------------------------------------

const STATIONS = [
  { id: 'PBS', name: 'Basel', canton: 'BS', latitude: 47.5618, longitude: 7.583931, altitude: 256 },
  {
    id: 'PBE',
    name: 'Bern',
    canton: 'BE',
    latitude: 46.950342,
    longitude: 7.424661,
    altitude: 546,
  },
  {
    id: 'PBU',
    name: 'Buchs SG',
    canton: 'SG',
    latitude: 47.173267,
    longitude: 9.472614,
    altitude: 446,
  },
  {
    id: 'PDS',
    name: 'Davos',
    canton: 'GR',
    latitude: 46.829092,
    longitude: 9.855489,
    altitude: 1591,
  },
  {
    id: 'PGE',
    name: 'Genève',
    canton: 'GE',
    latitude: 46.191969,
    longitude: 6.147544,
    altitude: 379,
  },
  {
    id: 'PCF',
    name: 'La Chaux-de-Fonds',
    canton: 'NE',
    latitude: 47.113514,
    longitude: 6.832,
    altitude: 1037,
  },
  {
    id: 'PLS',
    name: 'Lausanne',
    canton: 'VD',
    latitude: 46.524103,
    longitude: 6.644825,
    altitude: 576,
  },
  {
    id: 'PLO',
    name: 'Locarno',
    canton: 'TI',
    latitude: 46.172547,
    longitude: 8.787389,
    altitude: 376,
  },
  {
    id: 'PLU',
    name: 'Lugano',
    canton: 'TI',
    latitude: 46.004231,
    longitude: 8.960631,
    altitude: 275,
  },
  {
    id: 'PLZ',
    name: 'Luzern',
    canton: 'LU',
    latitude: 47.057678,
    longitude: 8.296803,
    altitude: 463,
  },
  {
    id: 'PMU',
    name: 'Münsterlingen',
    canton: 'TG',
    latitude: 47.630206,
    longitude: 9.236878,
    altitude: 415,
  },
  {
    id: 'PNE',
    name: 'Neuchâtel',
    canton: 'NE',
    latitude: 47.000269,
    longitude: 6.949828,
    altitude: 490,
  },
  {
    id: 'PPY',
    name: 'Payerne',
    canton: 'VD',
    latitude: 46.813403,
    longitude: 6.942939,
    altitude: 490,
  },
  {
    id: 'PSN',
    name: 'Sion',
    canton: 'VS',
    latitude: 46.235403,
    longitude: 7.384606,
    altitude: 494,
  },
  {
    id: 'PZH',
    name: 'Zürich',
    canton: 'ZH',
    latitude: 47.378225,
    longitude: 8.565644,
    altitude: 559,
  },
];

const BY_ID = new Map(STATIONS.map((station) => [station.id, station]));

/**
 * @description A station by its abbreviation.
 * @param {unknown} id - `PBE`, any case.
 * @returns {object|null} The station.
 */
const stationOf = (id) => BY_ID.get(String(id ?? '').toUpperCase()) ?? null;

/**
 * @description Whether an abbreviation is a known station.
 * @param {unknown} id - The value.
 * @returns {boolean} True for one of STATIONS.
 */
const isStation = (id) => typeof id === 'string' && BY_ID.has(id.toUpperCase());

export { STATIONS, stationOf, isStation };
