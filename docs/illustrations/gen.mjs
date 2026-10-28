// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// The two widgets for Bern during the birch peak of April 2026: the hourly
// values are real ones (test/fixtures/pbe_h_spring.csv, lines of the recent
// file of MeteoSwiss), read by the real reader (src/pollen.js) up to a fixed
// "now", and drawn by the real widget builders (src/widgets.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildStationWidget, buildHistoryWidget } = await load('src/widgets.js');
const { parseHourlyCsv, mergeHistory, snapshotOf } = await load('src/pollen.js');
const { stationOf } = await load('src/stations.js');
const { LANGUAGES } = await load('src/i18n.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// Wednesday 8 April 2026, 18:10 in Bern: the 16:00 UTC value is the last one.
const NOW = Date.parse('2026-04-08T16:10:00Z');
const TZ = 'Europe/Zurich';
const rows = parseHourlyCsv(
  readFileSync(`${repo}/test/fixtures/pbe_h_spring.csv`, 'latin1'),
  'PBE',
).filter((row) => row.at <= NOW);
const history = mergeHistory({}, rows);
const snapshot = snapshotOf(history, NOW);
const station = stationOf('PBE');

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    station: buildStationWidget({ station, snapshot, language, timeZone: TZ }),
    history: buildHistoryWidget({ station, history, snapshot, language, timeZone: TZ }),
  };
}
const widgets = Object.fromEntries(
  manifest.widgets.map((w) => [w.key, { icon: w.icon, label: w.label }]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents }));
