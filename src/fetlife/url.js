const FETLIFE_HOST = /(^|\.)fetlife\.com$/i;

export function toUrl(value, baseUrl = 'https://fetlife.com/') {
  if (value === undefined || value === null || value === '') return null;
  try {
    return value instanceof URL ? new URL(value.href) : new URL(value, baseUrl);
  } catch {
    return null;
  }
}

export function isFetLifeUrl(value, baseUrl) {
  const url = toUrl(value, baseUrl);
  return Boolean(url && url.protocol === 'https:' && FETLIFE_HOST.test(url.hostname));
}

export function canonicalizeFetLifeUrl(value, baseUrl) {
  const url = toUrl(value, baseUrl);
  if (!url || url.protocol !== 'https:' || !FETLIFE_HOST.test(url.hostname)) return null;
  url.hash = '';
  url.search = '';
  url.hostname = 'fetlife.com';
  url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  return url.href;
}
