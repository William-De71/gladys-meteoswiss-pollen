// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, levels, taxa, widget contents, scene
// summaries, messages of the Configuration screen. Vocabulary of the Gladys
// interface (appareil / Gerät / dispositivo, scène / Szene / escena) and of
// MeteoSwiss for the pollen load classes (faible / moyen / fort / très fort).
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  deviceName: {
    en: 'Pollen {station}',
    fr: 'Pollens {station}',
    de: 'Pollen {station}',
    es: 'Polen {station}',
  },
  feature_level: {
    en: 'Pollen level',
    fr: 'Niveau de pollens',
    de: 'Pollenbelastung',
    es: 'Nivel de polen',
  },
  feature_concentration: {
    en: '{taxon} pollen (last hour)',
    fr: 'Pollens {taxon} (dernière heure)',
    de: 'Pollen {taxon} (letzte Stunde)',
    es: 'Polen {taxon} (última hora)',
  },
  feature_taxon_level: {
    en: '{taxon} pollen level',
    fr: 'Niveau pollens {taxon}',
    de: 'Belastung {taxon}',
    es: 'Nivel de polen {taxon}',
  },
  feature_main: {
    en: 'Main pollen',
    fr: 'Pollen principal',
    de: 'Hauptpollen',
    es: 'Polen principal',
  },
  mainPollen: {
    en: '{taxon}: {label} ({count}/m³)',
    fr: '{taxon} : {label} ({count}/m³)',
    de: '{taxon}: {label} ({count}/m³)',
    es: '{taxon}: {label} ({count}/m³)',
  },

  // levels (MeteoSwiss pollen load classes)
  level_0: { en: 'None', fr: 'Nul', de: 'Keine', es: 'Nulo' },
  level_1: { en: 'Low', fr: 'Faible', de: 'Schwach', es: 'Bajo' },
  level_2: { en: 'Moderate', fr: 'Moyen', de: 'Mäßig', es: 'Moderado' },
  level_3: { en: 'High', fr: 'Fort', de: 'Stark', es: 'Alto' },
  level_4: { en: 'Very high', fr: 'Très fort', de: 'Sehr stark', es: 'Muy alto' },
  level_none: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },

  // taxa
  taxon_hazel: { en: 'Hazel', fr: 'Noisetier', de: 'Hasel', es: 'Avellano' },
  taxon_alder: { en: 'Alder', fr: 'Aulne', de: 'Erle', es: 'Aliso' },
  taxon_ash: { en: 'Ash', fr: 'Frêne', de: 'Esche', es: 'Fresno' },
  taxon_birch: { en: 'Birch', fr: 'Bouleau', de: 'Birke', es: 'Abedul' },
  taxon_beech: { en: 'Beech', fr: 'Hêtre', de: 'Buche', es: 'Haya' },
  taxon_oak: { en: 'Oak', fr: 'Chêne', de: 'Eiche', es: 'Roble' },
  taxon_grasses: { en: 'Grasses', fr: 'Graminées', de: 'Gräser', es: 'Gramíneas' },
  taxonLower_hazel: { en: 'hazel', fr: 'de noisetier', de: 'Hasel', es: 'de avellano' },
  taxonLower_alder: { en: 'alder', fr: 'd’aulne', de: 'Erlen', es: 'de aliso' },
  taxonLower_ash: { en: 'ash', fr: 'de frêne', de: 'Eschen', es: 'de fresno' },
  taxonLower_birch: { en: 'birch', fr: 'de bouleau', de: 'Birken', es: 'de abedul' },
  taxonLower_beech: { en: 'beech', fr: 'de hêtre', de: 'Buchen', es: 'de haya' },
  taxonLower_oak: { en: 'oak', fr: 'de chêne', de: 'Eichen', es: 'de roble' },
  taxonLower_grasses: { en: 'grass', fr: 'de graminées', de: 'Gräser', es: 'de gramíneas' },

  // scene summaries
  summaryUnknown: {
    en: 'Pollen in {station}: no recent measurement.',
    fr: 'Pollens à {station} : pas de mesure récente.',
    de: 'Pollen in {station}: keine aktuelle Messung.',
    es: 'Polen en {station}: sin medición reciente.',
  },
  summaryNone: {
    en: 'Pollen in {station}: none in the air over the last 24 hours.',
    fr: 'Pollens à {station} : aucun dans l’air sur les dernières 24 heures.',
    de: 'Pollen in {station}: keine in der Luft in den letzten 24 Stunden.',
    es: 'Polen en {station}: ninguno en el aire en las últimas 24 horas.',
  },
  summaryStation: {
    en: 'Pollen in {station}: {label}. Main pollen: {main}.',
    fr: 'Pollens à {station} : niveau {label}. Pollen principal : {main}.',
    de: 'Pollen in {station}: Belastung {label}. Hauptpollen: {main}.',
    es: 'Polen en {station}: nivel {label}. Polen principal: {main}.',
  },
  summaryAlert: {
    en: 'The {taxon} pollen is {level} in {station}: {count} pollen/m³ on average over the last 24 hours.',
    fr: 'Les pollens {taxon} sont à un niveau {level} à {station} : {count} pollens/m³ en moyenne sur les dernières 24 heures.',
    de: 'Die {taxon}pollen-Belastung ist {level} in {station}: im Mittel {count} Pollen/m³ in den letzten 24 Stunden.',
    es: 'El polen {taxon} está en nivel {level} en {station}: {count} pólenes/m³ de media en las últimas 24 horas.',
  },

  // widgets
  widgetMeasured: { en: 'Measured', fr: 'Mesuré', de: 'Gemessen', es: 'Medido' },
  widgetSource: { en: 'Source', fr: 'Source', de: 'Quelle', es: 'Fuente' },
  widgetLevel: { en: 'Level', fr: 'Niveau', de: 'Belastung', es: 'Nivel' },
  widgetMainPollen: {
    en: 'Main pollen',
    fr: 'Pollen principal',
    de: 'Hauptpollen',
    es: 'Polen principal',
  },
  // A chart unit holds 6 characters at most (longer is cut by Gladys).
  widgetUnit: { en: '/m³', fr: '/m³', de: '/m³', es: '/m³' },
  widgetTaxonLine: {
    en: 'Last hour {hour}/m³ · 24 h {mean}/m³',
    fr: 'Dernière heure {hour}/m³ · 24 h {mean}/m³',
    de: 'Letzte Stunde {hour}/m³ · 24 h {mean}/m³',
    es: 'Última hora {hour}/m³ · 24 h {mean}/m³',
  },
  widgetStale: {
    en: 'No new measurement from this station for more than six hours.',
    fr: 'Aucune nouvelle mesure de cette station depuis plus de six heures.',
    de: 'Seit über sechs Stunden keine neue Messung dieser Station.',
    es: 'Ninguna medición nueva de esta estación desde hace más de seis horas.',
  },
  widgetNoPollen: {
    en: 'No pollen measured over the last 48 hours.',
    fr: 'Aucun pollen mesuré sur les dernières 48 heures.',
    de: 'In den letzten 48 Stunden wurden keine Pollen gemessen.',
    es: 'No se midió polen en las últimas 48 horas.',
  },
  widgetNoStation: {
    en: 'Choose a pollen station in the configuration of the integration.',
    fr: 'Choisissez une station pollinique dans la configuration de l’intégration.',
    de: 'Wählen Sie eine Pollenstation in der Konfiguration der Integration.',
    es: 'Elija una estación de polen en la configuración de la integración.',
  },
  widgetNotRead: {
    en: 'The measurements of MeteoSwiss have not been read yet.',
    fr: 'Les mesures de MétéoSuisse n’ont pas encore été lues.',
    de: 'Die Messwerte von MeteoSchweiz wurden noch nicht gelesen.',
    es: 'Las mediciones de MeteoSuiza aún no se han leído.',
  },

  // status and actions of the Configuration screen
  noStations: {
    en: 'Choose at least one pollen station.',
    fr: 'Choisissez au moins une station pollinique.',
    de: 'Wählen Sie mindestens eine Pollenstation.',
    es: 'Elija al menos una estación de polen.',
  },
  statusConnected: {
    en: 'MeteoSwiss read: {stations}. Next reading around {next}.',
    fr: 'MétéoSuisse lu : {stations}. Prochaine lecture vers {next}.',
    de: 'MeteoSchweiz gelesen: {stations}. Nächste Abfrage gegen {next}.',
    es: 'MeteoSuiza leída: {stations}. Próxima lectura hacia las {next}.',
  },
  statusStale: {
    en: '{station} without new measurement',
    fr: '{station} sans nouvelle mesure',
    de: '{station} ohne neue Messung',
    es: '{station} sin medición nueva',
  },
  statusStationError: {
    en: '{station}: {detail}',
    fr: '{station} : {detail}',
    de: '{station}: {detail}',
    es: '{station}: {detail}',
  },
  stationError: {
    en: 'not read ({detail}).',
    fr: 'non lue ({detail}).',
    de: 'nicht gelesen ({detail}).',
    es: 'no leída ({detail}).',
  },
  statusBlocked: {
    en: 'MeteoSwiss refuses the requests (HTTP {status}). New try in {minutes} min.',
    fr: 'MétéoSuisse refuse les requêtes (HTTP {status}). Nouvel essai dans {minutes} min.',
    de: 'MeteoSchweiz lehnt die Anfragen ab (HTTP {status}). Neuer Versuch in {minutes} Min.',
    es: 'MeteoSuiza rechaza las peticiones (HTTP {status}). Nuevo intento en {minutes} min.',
  },
  statusInvalid: {
    en: 'The files of MeteoSwiss could not be read (format changed?). New try in {minutes} min.',
    fr: 'Les fichiers de MétéoSuisse sont illisibles (format changé ?). Nouvel essai dans {minutes} min.',
    de: 'Die Dateien von MeteoSchweiz sind nicht lesbar (Format geändert?). Neuer Versuch in {minutes} Min.',
    es: 'Los archivos de MeteoSuiza no se pueden leer (¿cambió el formato?). Nuevo intento en {minutes} min.',
  },
  statusNotFound: {
    en: 'MeteoSwiss no longer publishes these stations. New try in {minutes} min.',
    fr: 'MétéoSuisse ne publie plus ces stations. Nouvel essai dans {minutes} min.',
    de: 'MeteoSchweiz veröffentlicht diese Stationen nicht mehr. Neuer Versuch in {minutes} Min.',
    es: 'MeteoSuiza ya no publica estas estaciones. Nuevo intento en {minutes} min.',
  },
  statusUnreachable: {
    en: 'MeteoSwiss cannot be reached ({detail}). New try in {minutes} min.',
    fr: 'MétéoSuisse est injoignable ({detail}). Nouvel essai dans {minutes} min.',
    de: 'MeteoSchweiz ist nicht erreichbar ({detail}). Neuer Versuch in {minutes} Min.',
    es: 'No se puede acceder a MeteoSuiza ({detail}). Nuevo intento en {minutes} min.',
  },
  refreshTooSoon: {
    en: 'Already read {minutes} min ago: MeteoSwiss publishes one value per hour.',
    fr: 'Déjà lu il y a {minutes} min : MétéoSuisse publie une valeur par heure.',
    de: 'Bereits vor {minutes} Min. gelesen: MeteoSchweiz veröffentlicht einen Wert pro Stunde.',
    es: 'Ya leído hace {minutes} min: MeteoSuiza publica un valor por hora.',
  },
  refreshDone: {
    en: 'MeteoSwiss read: {stations}.',
    fr: 'MétéoSuisse lu : {stations}.',
    de: 'MeteoSchweiz gelesen: {stations}.',
    es: 'MeteoSuiza leída: {stations}.',
  },
  diagnosticDone: {
    en: 'Diagnostic written to the Logs tab ({count} line(s) “Pollen diagnostic”).',
    fr: 'Diagnostic écrit dans l’onglet Journaux ({count} ligne(s) « Pollen diagnostic »).',
    de: 'Diagnose in den Tab Protokolle geschrieben ({count} Zeile(n) „Pollen diagnostic“).',
    es: 'Diagnóstico escrito en la pestaña Registros ({count} línea(s) «Pollen diagnostic»).',
  },
};

/**
 * @description Whether a value is a supported language.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('deviceName', 'fr', { station: 'Bern' }); // -> 'Pollens Bern'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string} key - The TEXTS key.
 * @param {object|Function} [values] - The substitutions, or `(language) => values`.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description Label of a pollen level.
 * @param {number|null} level - 0 to 4.
 * @param {string} language - The language.
 * @returns {string} The label, "Unknown" without a level.
 */
function levelLabel(level, language) {
  return Number.isInteger(level) && level >= 0 && level <= 4
    ? t(`level_${level}`, language)
    : t('level_none', language);
}

/**
 * @description A time of day ("15:42").
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The text.
 */
function shortTime(instant, language, timeZone = process.env.TZ || undefined) {
  return new Intl.DateTimeFormat(isLanguage(language) ? language : 'en', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(instant));
}

/**
 * @description An instant written the short way of a language ("17/10 13:00").
 * @param {number} instant - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The text.
 */
function shortDateTime(instant, language, timeZone = process.env.TZ || undefined) {
  return new Intl.DateTimeFormat(isLanguage(language) ? language : 'en', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(instant));
}

export { LANGUAGES, TEXTS, isLanguage, t, all, levelLabel, shortTime, shortDateTime };
