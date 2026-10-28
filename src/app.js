// -----------------------------------------------------------------------------
// The MeteoSwiss Pollen integration: every handler, registered on a Gladys
// client.
//
// Brings the pollen measured by the national pollen monitoring network of
// MeteoSwiss (15 stations in Switzerland, seven taxa, hourly values) into
// Gladys:
//   - devices (device.js): one per chosen station: the level now, the last
//     hour and the level of each taxon, the main pollen;
//   - scene trigger (events.js): pollen alert, per taxon;
//   - scene action: read the pollen of a station;
//   - dashboard widgets (widgets.js): the taxa of a station, the last 48 hours.
//
// MeteoSwiss is read on the integration's own timer (every 20 minutes, with
// conditional requests, time.js), never on a Gladys poll; the hourly history is
// kept in /data so a restart loses nothing. Transport: cloud only.
//
// index.js only creates the SDK client; the tests drive this module with the
// fake Gladys of the SDK (test/app.test.js).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import {
  normalizeConfig,
  readLanguage,
  INTERNAL_KEYS,
  AUTO_LANGUAGE,
  DEFAULT_TEXT_LANGUAGE,
} from './config.js';
import { createMeteoSwissClient } from './meteoswiss.js';
import { createStore, DEFAULT_PATH } from './store.js';
import { stationOf } from './stations.js';
import { HOUR_MS, MIN_HOURS, mergeHistory, snapshotOf } from './pollen.js';
import { buildDevice, buildStates, idsOf, stationIdOf } from './device.js';
import { detectEvents, actionOutputs } from './events.js';
import {
  WIDGETS,
  messageContent,
  buildStationWidget,
  buildHistoryWidget,
  readWidgetSettings,
} from './widgets.js';
import { defaultTimeZone, localDate, jitterOf, MINUTE_MS, READ_INTERVAL_MS } from './time.js';
import { t, all, LANGUAGES, levelLabel, shortTime } from './i18n.js';

const ACTIONS = { REFRESH: 'refresh', DIAGNOSTIC: 'diagnostic' };
const SCENE_ACTIONS = { GET_POLLEN: 'get_pollen' };
// After a failed reading: new tries, then the usual pace.
const RETRY_DELAYS_MIN = [5, 10, 20, 40];
// A manual refresh never reads again within this delay.
const REFRESH_MIN_INTERVAL_MS = 2 * MINUTE_MS;
// The yearly file of a station is read again at most this often.
const BACKFILL_INTERVAL_MS = 6 * HOUR_MS;
const DIAGNOSTIC_CHUNK = 3000;
const { version: VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

/**
 * @description The hours measured in the 24 hours before the newest one.
 * @param {object} history - `{ [at]: values }`.
 * @returns {number} The count.
 */
function recentHours(history = {}) {
  const instants = Object.keys(history).map(Number);
  if (instants.length === 0) {
    return 0;
  }
  const newest = Math.max(...instants);
  return instants.filter((at) => at > newest - 24 * HOUR_MS).length;
}

/**
 * @description Register every handler of the integration on a Gladys client.
 * @param {object} gladys - A GladysIntegration (or the fake Gladys of the SDK).
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - HTTP transport to MeteoSwiss (tests).
 * @param {Function} [options.sleep] - Pause between two requests (tests).
 * @param {string} [options.storePath] - The file kept in /data.
 * @param {Function} [options.now] - `() => number` in ms (tests).
 * @param {string} [options.timeZone] - IANA timezone of "today" (TZ by default).
 * @param {boolean} [options.timers] - Arm the reading timer (false in tests).
 * @param {object} [options.logger] - Logger.
 * @returns {object} Handles for the tests.
 */
function createApp(
  gladys,
  {
    fetch: fetchFn,
    sleep,
    storePath = DEFAULT_PATH,
    now = () => Date.now(),
    timeZone = defaultTimeZone(),
    timers = true,
    logger = sdkLogger,
  } = {},
) {
  let config = normalizeConfig();
  // Language of the last widget request: the fallback of the texts Gladys does
  // not ask for in a language, when the `language` setting is `auto`.
  let language = null;
  let createdDevices = new Set();
  // The problems of the last reading, per station.
  let stationErrors = [];
  let lastStatus = null;
  let lastDiscovery = null;
  let lastError = null;
  let failures = 0;
  let retryAt = null;
  let timer = null;
  let running = null;
  let stopped = false;
  // When the yearly file of a station was last read (this process only).
  const backfilledAt = new Map();

  const client = createMeteoSwissClient({
    now,
    ...(fetchFn ? { fetch: fetchFn } : {}),
    ...(sleep ? { sleep } : {}),
  });
  const store = createStore({ path: storePath, logger });

  const today = () => localDate(now(), timeZone);
  const jitter = () => jitterOf(config.stations.map((station) => station.id).join('|'));

  /**
   * @description The configured stations, with their device id.
   * @returns {object[]} `{ id, name, canton, …, slot, deviceId }`.
   */
  const stations = () =>
    config.stations.map(({ slot, id }) => ({
      ...stationOf(id),
      slot,
      deviceId: idsOf(gladys, id).device,
    }));

  /**
   * @description What the history of a station says now.
   * @param {string} id - The station.
   * @returns {object} snapshotOf.
   */
  const snapshot = (id) => snapshotOf(store.data.history[id], now());

  /**
   * @description Remember the language of a request, and store it when it changed.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === language) {
      return;
    }
    language = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Language of the texts Gladys does not ask for in a language.
   * @returns {string} The language.
   */
  const textLanguage = () =>
    config.language === AUTO_LANGUAGE ? (language ?? DEFAULT_TEXT_LANGUAGE) : config.language;

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description Refresh the list of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  // --- Devices and states ------------------------------------------------------------

  /**
   * @description Offer the station devices on the Discovery screen, when they changed.
   * @param {boolean} [force] - Publish even when unchanged.
   * @returns {Promise<number>} The count.
   */
  async function publishDiscoveredDevices(force = false) {
    const lang = textLanguage();
    const devices = stations().map((station) => buildDevice(gladys, station, { language: lang }));
    const signature = JSON.stringify(devices);
    if (force || signature !== lastDiscovery) {
      await gladys.publishDiscoveredDevices(devices);
      lastDiscovery = signature;
    }
    return devices.length;
  }

  /**
   * @description Publish the states of the created devices (only the changed ones).
   * @returns {Promise<void>}
   */
  async function publishStates() {
    const lang = textLanguage();
    const states = stations()
      .filter((station) => createdDevices.has(station.deviceId))
      .flatMap((station) =>
        buildStates(gladys, station.id, snapshot(station.id), { language: lang }),
      );
    if (states.length > 0) {
      await gladys.publishChangedStates(states);
    }
  }

  const publishQuietly = () =>
    publishStates().catch((err) => logger.warn(`Unable to publish the states: ${err.message}`));

  /**
   * @description Ask every open widget to pull its content again.
   */
  function refreshWidgets() {
    for (const key of Object.values(WIDGETS)) {
      Promise.resolve(gladys.requestWidgetRefresh(key)).catch(() => {});
    }
  }

  // --- Reading -----------------------------------------------------------------------

  /**
   * @description When the next reading is due.
   * @returns {number} The instant, in ms.
   */
  const nextReading = () =>
    store.data.fetchedAt ? store.data.fetchedAt + READ_INTERVAL_MS + jitter() : now();

  /**
   * @description The stations and their level now, for a message.
   * @param {string} l - The language.
   * @returns {string} "Bern low, Zürich moderate".
   */
  const stationsText = (l) =>
    stations()
      .map((station) => {
        const current = snapshot(station.id);
        if (current.measuredAt && current.stale) {
          return t('statusStale', l, { station: station.name });
        }
        return `${station.name} ${levelLabel(current.level, l).toLowerCase()}`;
      })
      .join(', ') || '-';

  /**
   * @description The problems of the stations, for a message.
   * @param {string} l - The language.
   * @returns {string[]} One sentence per station.
   */
  const problemsText = (l) =>
    stationErrors.map((error) =>
      t('statusStationError', l, { station: error.name, detail: error.detail(l) }),
    );

  /**
   * @description The status message after a reading.
   * @returns {object} The multi-language message.
   */
  function connectedMessage() {
    const next = Math.min(nextReading(), retryAt ?? Infinity);
    return Object.fromEntries(
      LANGUAGES.map((l) => [
        l,
        [
          t('statusConnected', l, {
            stations: stationsText(l),
            next: shortTime(next, l, timeZone),
          }),
          ...problemsText(l),
        ].join(' '),
      ]),
    );
  }

  /**
   * @description The multi-language message of a failed reading.
   * @param {Error} err - The error.
   * @param {number} minutes - Minutes before the next try.
   * @returns {object} The message.
   */
  function errorMessage(err, minutes) {
    switch (err.kind) {
      case 'blocked':
        return all('statusBlocked', { status: err.status ?? '?', minutes });
      case 'invalid':
        return all('statusInvalid', { minutes });
      case 'not_found':
        return all('statusNotFound', { minutes });
      default:
        return all('statusUnreachable', { detail: String(err.message).slice(0, 80), minutes });
    }
  }

  /**
   * @description Read one station: the recent hours, and the yearly file when
   * the history is too short for a 24-hour mean.
   * @param {object} station - The station.
   * @returns {Promise<void>}
   */
  async function readStation(station) {
    const result = await client.hourly(station.id, { etag: store.data.etags[station.id] });
    if (!result.notModified) {
      store.data.history[station.id] = mergeHistory(store.data.history[station.id], result.rows);
      store.data.etags[station.id] = result.etag ?? null;
    }
    const last = backfilledAt.get(station.id);
    if (
      recentHours(store.data.history[station.id]) < MIN_HOURS + 6 &&
      (last === undefined || now() - last >= BACKFILL_INTERVAL_MS)
    ) {
      backfilledAt.set(station.id, now());
      try {
        const recent = await client.hourly(station.id, { period: 'recent' });
        if (!recent.notModified) {
          // The hours already kept win: they come from the real-time file.
          const kept = Object.entries(store.data.history[station.id] ?? {}).map(([at, values]) => ({
            at: Number(at),
            values,
          }));
          store.data.history[station.id] = mergeHistory({}, [...recent.rows, ...kept]);
        }
      } catch (err) {
        logger.warn(`Station ${station.id}: yearly file not read (${err.message})`);
      }
    }
  }

  /**
   * @description Read MeteoSwiss for every station, publish everything.
   * @returns {Promise<boolean>} True when at least one station was read.
   */
  async function round() {
    const list = stations();
    if (list.length === 0) {
      stationErrors = [];
      await reportStatus(false, all('noStations'));
      return false;
    }
    const errors = [];
    let failure = null;
    for (const station of list) {
      try {
        await readStation(station);
      } catch (err) {
        logger.warn(`Station ${station.id}: ${err.kind ?? 'error'} ${err.message}`);
        failure = failure ?? err;
        errors.push({
          id: station.id,
          name: station.name,
          kind: err.kind ?? 'error',
          detail: (l) => t('stationError', l, { detail: String(err.message).slice(0, 80) }),
        });
      }
    }
    stationErrors = errors;

    if (errors.length === list.length) {
      failures += 1;
      lastError = { at: now(), kind: failure.kind ?? 'error', message: failure.message };
      const delay = RETRY_DELAYS_MIN[Math.min(failures, RETRY_DELAYS_MIN.length) - 1] * MINUTE_MS;
      retryAt = now() + delay;
      await store.save();
      logger.warn(`MeteoSwiss reading failed (${failure.kind ?? 'error'}): ${failure.message}`);
      await publishDiscoveredDevices().catch(() => {});
      await reportStatus(false, errorMessage(failure, Math.round(delay / MINUTE_MS)));
      return false;
    }

    failures = 0;
    retryAt = null;
    lastError = failure
      ? { at: now(), kind: failure.kind ?? 'error', message: failure.message }
      : null;
    store.data.fetchedAt = now();
    const { events, seen } = detectEvents({
      stations: list,
      snapshotOf: snapshot,
      seen: store.data.seen,
      today: today(),
      language: textLanguage(),
    });
    store.data.seen = { ...store.data.seen, ...seen };
    await store.save();
    for (const event of events) {
      try {
        await gladys.publishSceneEvent(event.key, event.data);
      } catch (err) {
        logger.warn(`Unable to fire ${event.key}: ${err.message}`);
      }
    }
    logger.info(
      `MeteoSwiss read for ${list.map((s) => s.id).join(', ')}: ${events.length} scene event(s), ${errors.length} station problem(s), ${client.requests.total} request(s) so far`,
    );
    await publishDiscoveredDevices().catch((err) =>
      logger.warn(`Unable to offer the devices: ${err.message}`),
    );
    await publishQuietly();
    refreshWidgets();
    await reportStatus(true, connectedMessage());
    return true;
  }

  /**
   * @description Run one reading at a time.
   * @returns {Promise<boolean>} The result of round().
   */
  function read() {
    if (!running) {
      running = round().finally(() => {
        running = null;
      });
    }
    return running;
  }

  /**
   * @description Whether the data kept in /data are still fresh for these stations.
   * @returns {boolean} True when read less than an interval ago, every station known.
   */
  function cacheIsFresh() {
    if (!store.data.fetchedAt || now() >= nextReading()) {
      return false;
    }
    return (
      config.stations.length > 0 &&
      config.stations.every(({ id }) => recentHours(store.data.history[id]) >= MIN_HOURS)
    );
  }

  // --- Timer -------------------------------------------------------------------------

  /**
   * @description Arm the timer for the next reading or retry.
   */
  function schedule() {
    if (!timers || stopped) {
      return;
    }
    clearTimeout(timer);
    const current = now();
    const at = Math.min(nextReading(), retryAt ?? Infinity);
    timer = setTimeout(tick, Math.max(1000, at - current));
    timer.unref?.();
  }

  /**
   * @description What the timer does when it fires.
   * @returns {Promise<void>}
   */
  async function tick() {
    try {
      if (config.stations.length > 0) {
        await read();
      }
    } catch (err) {
      logger.error('Timer', err);
    }
    schedule();
  }

  /**
   * @description Offer the devices, read when needed.
   * @param {object} [options] - `{ force }`: read even with fresh data.
   * @returns {Promise<void>}
   */
  async function refreshAll({ force = false } = {}) {
    if (!force && cacheIsFresh()) {
      stationErrors = [];
      await publishDiscoveredDevices().catch((err) =>
        logger.warn(`Unable to offer the devices: ${err.message}`),
      );
      await publishQuietly();
      refreshWidgets();
      await reportStatus(true, connectedMessage());
    } else {
      await read();
    }
    schedule();
  }

  // --- Dashboard widgets -------------------------------------------------------------

  /**
   * @description The station of a widget instance.
   * @param {object} settings - The settings.
   * @returns {object|null} The station.
   */
  function stationOfWidget(settings) {
    const id = stationIdOf(readWidgetSettings(settings).station);
    const list = stations();
    return list.find((station) => station.id === id) ?? list[0] ?? null;
  }

  /**
   * @description Common checks of a widget request.
   * @param {object|null} station - The station.
   * @param {string} lang - The language.
   * @returns {object|null} A message content, null when the widget can be built.
   */
  function widgetProblem(station, lang) {
    if (!station) {
      return messageContent(t('widgetNoStation', lang), 60);
    }
    if (!snapshot(station.id).measuredAt) {
      return messageContent(t('widgetNotRead', lang), 60);
    }
    return null;
  }

  gladys.onWidgetGet(WIDGETS.STATION, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const station = stationOfWidget(settings);
    return (
      widgetProblem(station, lang) ??
      buildStationWidget({ station, snapshot: snapshot(station.id), language: lang, timeZone })
    );
  });

  gladys.onWidgetGet(WIDGETS.HISTORY, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    const station = stationOfWidget(settings);
    return (
      widgetProblem(station, lang) ??
      buildHistoryWidget({
        station,
        history: store.data.history[station.id],
        snapshot: snapshot(station.id),
        language: lang,
        timeZone,
      })
    );
  });

  // --- Scene action ------------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.GET_POLLEN, async (fields = {}) => {
    const id = stationIdOf(fields.station);
    const list = stations();
    const station = list.find((candidate) => candidate.id === id) ?? (id ? null : list[0]);
    if (!station) {
      throw new Error(`Unknown station: ${fields.station ?? '(none)'}`);
    }
    const current = snapshot(station.id);
    if (!current.measuredAt) {
      throw new Error('MeteoSwiss has not been read yet');
    }
    return actionOutputs({ station, snapshot: current }, textLanguage());
  });

  // --- Configuration screen actions --------------------------------------------------
  gladys.onAction(ACTIONS.REFRESH, async () => {
    if (config.stations.length === 0) {
      return all('noStations');
    }
    const fetchedAt = store.data.fetchedAt;
    if (fetchedAt && now() - fetchedAt < REFRESH_MIN_INTERVAL_MS && !lastError && cacheIsFresh()) {
      return all('refreshTooSoon', {
        minutes: Math.max(1, Math.round((now() - fetchedAt) / MINUTE_MS)),
      });
    }
    const ok = await read();
    schedule();
    if (!ok) {
      return lastStatus ? JSON.parse(lastStatus)[1] : all('noStations');
    }
    return Object.fromEntries(
      LANGUAGES.map((l) => [
        l,
        [t('refreshDone', l, { stations: stationsText(l) }), ...problemsText(l)].join(' '),
      ]),
    );
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const report = {
      version: VERSION,
      timeZone: timeZone ?? null,
      today: today(),
      stations: stations().map(({ id, name, slot, deviceId }) => ({
        id,
        name,
        slot,
        created: createdDevices.has(deviceId),
        hours: Object.keys(store.data.history[id] ?? {}).length,
        etag: store.data.etags[id] ?? null,
        snapshot: snapshot(id),
      })),
      stationErrors: stationErrors.map(({ id, kind, detail }) => ({
        id,
        kind,
        detail: detail('en'),
      })),
      fetchedAt: store.data.fetchedAt ? new Date(store.data.fetchedAt).toISOString() : null,
      nextReading: new Date(nextReading()).toISOString(),
      retryAt: retryAt ? new Date(retryAt).toISOString() : null,
      lastError,
      requests: client.requests,
      seen: store.data.seen,
    };
    const json = JSON.stringify(report);
    const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
    for (let chunk = 0; chunk < count; chunk += 1) {
      logger.info(
        `Pollen diagnostic ${chunk + 1}/${count}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
      );
    }
    return all('diagnosticDone', { count });
  });

  // --- Devices -----------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    const count = await publishDiscoveredDevices(true);
    logger.info(`Scan: ${count} station(s) offered`);
  });

  gladys.onDeviceCreated(async () => {
    await refreshCreatedDevices();
    // States sent before the device existed were dropped by Gladys, and the SDK
    // forgot what it sent for this device: send everything known again.
    await publishQuietly();
    refreshWidgets();
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration -----------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallback] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallback) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      language = readLanguage(raw, language);
    } catch (err) {
      if (fallback) {
        config = normalizeConfig(fallback);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const before = JSON.stringify(config.stations.map((station) => station.id));
    await loadConfig(rawConfig);
    const after = JSON.stringify(config.stations.map((station) => station.id));
    lastDiscovery = null;
    failures = 0;
    retryAt = null;
    logger.info('Configuration updated');
    // New stations: read now; a language change only renames the offered devices.
    await refreshAll({ force: before !== after });
  });

  // --- Connection lifecycle ----------------------------------------------------------
  // Each (re)connection resynchronizes; the promise lets the tests wait for it.
  let startup = Promise.resolve();
  gladys.on('connected', () => {
    startup = (async () => {
      await loadConfig();
      await store.load();
      await refreshCreatedDevices();
      lastStatus = null;
      lastDiscovery = null;
      await refreshAll();
    })().catch((err) => logger.error('Startup', err));
  });

  // --- Graceful shutdown -------------------------------------------------------------
  gladys.handleShutdown(async (signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    stopped = true;
    clearTimeout(timer);
  });

  return {
    store,
    client,
    read,
    tick,
    refreshAll,
    getConfig: () => config,
    getStations: stations,
    getRetryAt: () => retryAt,
    whenReady: () => startup,
  };
}

export {
  createApp,
  ACTIONS,
  SCENE_ACTIONS,
  RETRY_DELAYS_MIN,
  REFRESH_MIN_INTERVAL_MS,
  BACKFILL_INTERVAL_MS,
  recentHours,
};
