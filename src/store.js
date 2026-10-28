// -----------------------------------------------------------------------------
// What the integration keeps across restarts, in /data/meteoswiss-pollen.json
// (the only writable place of the container):
//   - `history`   the hourly values of each station, `{ [station]: { [at]:
//                 values } }`, the last 48 hours: a restart neither loses the
//                 24-hour means nor reads the large yearly file again;
//   - `etags`     the ETag of the last file read per station, for the
//                 conditional requests MeteoSwiss asks for;
//   - `fetchedAt` when the files were last asked for;
//   - `seen`      what the scene trigger already announced, per station, local
//                 date and taxon, so a restart never fires twice.
// -----------------------------------------------------------------------------

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const DEFAULT_PATH = '/data/meteoswiss-pollen.json';
const EMPTY = () => ({ history: {}, etags: {}, fetchedAt: null, seen: {} });

/**
 * @description The store.
 * @param {object} [options] - `{ path, logger }`.
 * @returns {object} `{ data, load, save }`.
 */
function createStore({ path = DEFAULT_PATH, logger } = {}) {
  const store = {
    data: EMPTY(),
    /**
     * @description Read the file; an absent or broken file is an empty store.
     * @returns {Promise<void>}
     */
    async load() {
      try {
        const raw = JSON.parse(await readFile(path, 'utf8'));
        store.data = { ...EMPTY(), ...(raw && typeof raw === 'object' ? raw : {}) };
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger?.warn(`Unable to read ${path}: ${err.message}`);
        }
        store.data = EMPTY();
      }
    },
    /**
     * @description Write the file (atomically: a temporary file, then a rename).
     * @returns {Promise<void>}
     */
    async save() {
      try {
        await mkdir(dirname(path), { recursive: true });
        const temporary = `${path}.tmp`;
        await writeFile(temporary, JSON.stringify(store.data));
        await rename(temporary, path);
      } catch (err) {
        logger?.warn(`Unable to write ${path}: ${err.message}`);
      }
    },
  };
  return store;
}

export { DEFAULT_PATH, createStore };
