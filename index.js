// -----------------------------------------------------------------------------
// Entry point of the MeteoSwiss Pollen external integration.
//
// Brings the pollen measured by the national pollen monitoring network of
// MeteoSwiss (Open Government Data, no account, no key) into Gladys:
//   - devices: one per chosen pollen station, with the level now, the last
//     hour and the level of hazel, alder, ash, birch, beech, oak and grasses,
//     and the main pollen (see src/device.js);
//   - scene trigger: pollen alert;
//   - scene action: read the pollen of a station;
//   - dashboard widgets: the taxa of a station, the last 48 hours.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the MeteoSwiss Pollen integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
