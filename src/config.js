// -----------------------------------------------------------------------------
// Configuration of the MeteoSwiss Pollen integration.
//
// Fields of the config_schema:
//   - `station_<n>`  up to three pollen stations, by their MeteoSwiss
//                    abbreviation (PBE, PZH…), chosen in a list;
//   - `language`     language of the texts Gladys does not ask for in a
//                    language (feature names, scene summaries): `auto`
//                    follows the language of the last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language`  language of the last widget request, kept for the
//                      texts after a restart.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';
import { isStation } from './stations.js';

const MAX_STATIONS = 3;
const AUTO_LANGUAGE = 'auto';
// Until a widget is shown: German, the first language of the Swiss stations.
const DEFAULT_TEXT_LANGUAGE = 'de';
const INTERNAL_KEYS = { language: 'last_language' };

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} `{ stations: [{ slot, id }], language }`; an empty or
 * unknown slot is left out, a station chosen twice is kept once.
 * @example
 * normalizeConfig({ station_1: 'PBE' });
 */
function normalizeConfig(rawConfig = {}) {
  const config = rawConfig ?? {};
  const stations = [];
  for (let slot = 1; slot <= MAX_STATIONS; slot += 1) {
    const raw = config[`station_${slot}`];
    const id = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
    if (isStation(id) && !stations.some((station) => station.id === id)) {
      stations.push({ slot, id });
    }
  }
  return {
    stations,
    language: isLanguage(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Read the stored language of the last request.
 * @param {object} [rawConfig] - The raw config values.
 * @param {string} fallback - The language to keep when nothing valid is stored.
 * @returns {string} The language.
 * @example
 * readLanguage({ last_language: 'fr' }, 'en'); // -> 'fr'
 */
function readLanguage(rawConfig, fallback) {
  const language = (rawConfig ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  MAX_STATIONS,
  AUTO_LANGUAGE,
  DEFAULT_TEXT_LANGUAGE,
  INTERNAL_KEYS,
  normalizeConfig,
  readLanguage,
};
