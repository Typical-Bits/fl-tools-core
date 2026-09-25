import { DATABASE_VERSION, STORE_NAMES } from './constants.js';

// Historical identifier used only to find existing data; never rename or delete the source.
export const PREVIOUS_DATABASE_NAME = 'FLToolsV3';
const MARKER = 'migration:unversioned-database';

function result(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openExisting(factory) {
  return new Promise((resolve, reject) => {
    const request = factory.open(PREVIOUS_DATABASE_NAME);
    let absent = false;
    request.onupgradeneeded = () => {
      absent = true;
      request.transaction.abort();
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => (absent ? resolve(null) : reject(request.error));
  });
}

export async function importPreviousDatabase(factory, destination) {
  if (await destination.get('meta', MARKER)) return;
  const source = await openExisting(factory);
  const records = {};
  try {
    if (source) {
      if (source.version > DATABASE_VERSION)
        throw new Error('Previous database schema is newer than this Core understands');
      const names = STORE_NAMES.filter((name) => source.objectStoreNames.contains(name));
      if (names.length) {
        const transaction = source.transaction(names, 'readonly');
        await Promise.all(
          names.map(async (name) => {
            records[name] = await result(transaction.objectStore(name).getAll());
          }),
        );
      }
    }
  } finally {
    source?.close();
  }
  // The marker and every imported record commit together. A failed copy can retry.
  await destination.atomic(STORE_NAMES, async (stores, requestResult) => {
    if (await requestResult(stores.meta.get(MARKER))) return;
    for (const [name, rows] of Object.entries(records)) {
      for (const record of rows) {
        if (name === 'meta' && record.key === MARKER) continue;
        if ((await requestResult(stores[name].get(record.key))) === undefined) {
          await requestResult(stores[name].put(record));
        }
      }
    }
    await requestResult(stores.meta.put({ key: MARKER, completed: true }));
  });
}
