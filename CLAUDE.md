# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for the pollen measured by
MeteoSwiss: a Node.js service (Node 22+, ESM, no build step) that runs in its
own sandboxed Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. Every 20 minutes it reads the hourly CSV file of
each chosen station from the MeteoSwiss Open Government Data
(`https://data.geo.admin.ch/ch.meteoschweiz.ogd-pollen/<abbr>/ogd-pollen_<abbr>_h_now.csv`,
STAC collection `ch.meteoschweiz.ogd-pollen`, no key), keeps a 48-hour history
in `/data`, and works out the levels from the MeteoSwiss pollen load classes.
Transport: cloud only. "Source: MeteoSwiss" must stay visible (widgets, docs).

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/widgets.test.js          # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp)
src/app.js              every handler, registered before connect(); the timer,
                        the reading round, the yearly-file backfill
src/meteoswiss.js       client of the MeteoSwiss files (ETag, pace, error kinds)
src/pollen.js           CSV reader, 48-hour history, 24-hour means, levels
                        (MeteoSwiss thresholds), main pollen, chart series
src/stations.js         the 15 stations with real-time values (same list as
                        the manifest)
src/time.js             local date (TZ), reading pace, stable jitter
src/store.js            /data/meteoswiss-pollen.json: history, etags, `seen`
src/events.js           pollen alert transitions, payloads, scene action outputs
src/device.js           one device per station, its states
src/widgets.js          station and 48-hour history dashboard widgets
src/config.js           configuration (three stations, language)
src/i18n.js             runtime texts, en / fr / de / es
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          real MeteoSwiss CSV files, byte for byte (CRLF kept)
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **External ids are forever**, and so is every key users store: device and
  feature external ids (`station:<abbr>`, the MeteoSwiss three-letter
  abbreviation such as `PBE`, and the feature keys `level`, `<taxon>`,
  `<taxon>_level`, `main_pollen`), feature `category` / `type` / `unit` /
  `min` / `max` / `step`, the keys of `config_schema` (`station_1..3`,
  `language`), `actions`, the widgets and their settings, the scene trigger
  (fields, options, variables) and the scene action (fields, outputs). The
  taxon keys are `hazel`, `alder`, `ash`, `birch`, `beech`, `oak`, `grasses`.
  `test/structure.test.js` compares them to a baseline: never update the
  baseline to make a test pass without a documented migration.
- **Category / type pairs.** Levels (0 none to 4 very high) and
  concentrations (pollen per m³) are `airquality-sensor` / `aqi` **without a
  unit**: Gladys has no pollen unit and `aqi` would be wrong. The main pollen
  is `text` / `text`. No state for an unknown value, and none for a stale
  station (no new hour for six hours).
- **Levels.** The thresholds of MeteoSwiss ("Threshold values for pollen load
  classes of allergenic pollen types", 2024-01-10) are meant for a daily mean;
  they are applied to the mean of the last 24 hours, with at least 18
  measured hours. Timestamps are UTC and mark the end of the hour.
- **Be gentle with MeteoSwiss.** One request at a time, half a second apart,
  conditional (`If-None-Match`), with a user agent naming the project; the
  real-time file every 20 minutes plus a stable jitter; the yearly `recent`
  file (~270 KB) only when fewer than 24 hours are kept, at most every six
  hours per station. Never add a request per widget, per scene or per tick.
  The CDN may serve a copy up to two hours old: never "fix" it by asking more
  often.
- **The format can change.** When the reader breaks, record the new file in
  `test/fixtures/` first (byte for byte: the fixtures are excluded from
  Prettier and from line-ending normalization), then fix `src/pollen.js`.
  Columns are found by their parameter name (`k?<genus>h0`), never by
  position.
- **Events once.** `seen` (in /data) remembers per station, local date and
  taxon the highest level announced; the first reading of a station is a
  baseline. A scene action or a widget never fires an event.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. Level names follow MeteoSwiss
  (faible / moyen / fort / très fort; schwach / mäßig / stark / sehr stark).
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files. A card
  list in `list` display holds 8 items; a chart holds 4 series.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB; at most 20 scene action outputs. The station options of the
  manifest and `src/stations.js` stay in step. `countries: ["CH"]`. No
  permission is declared. Transport: `["cloud"]`. `gladys_version` `>=5.3.0`.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (a fake `fetch` at most).
