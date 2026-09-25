export const DATABASE_NAME = 'FLTools';
export const DATABASE_VERSION = 1;

export const STORE_NAMES = Object.freeze([
  'meta',
  'settings',
  'people',
  'history',
  'watches',
  'social',
  'vault',
]);

export const ACCOUNT_STORES = Object.freeze(
  new Set(['settings', 'people', 'history', 'watches', 'social', 'vault']),
);

export const BROWSE_SETTINGS_KEY = 'browse';
