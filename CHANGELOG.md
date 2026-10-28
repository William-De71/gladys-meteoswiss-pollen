# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.1.0] - unreleased

### Added

- Pollen stations of MeteoSwiss as devices: one per chosen station (up to three of the 15 stations with real-time values), with the pollen level now, and for hazel, alder, ash, birch, beech, oak and grasses the concentration of the last hour and the level of the last 24 hours (MeteoSwiss pollen load classes), plus the main pollen as text.
- Scene trigger "pollen alert": a pollen reaches moderate, high or very high at a station, filtered by station, pollen and level.
- Scene action "read the pollen" of a station, with 20 outputs for messages and conditions.
- Dashboard widgets: the seven pollens of a station, and a chart of the last 48 hours.
- Cloud transport: the open data files of MeteoSwiss are read every 20 minutes with conditional requests (ETag), and the hourly history is kept in `/data`.
- Configuration actions: read now, and a diagnostic written to the Logs tab.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.
