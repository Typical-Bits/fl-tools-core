// Human-facing US dates; persistence stays ISO so comparisons and old data remain stable.
export function displayCalendarDate(iso = '') {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : '';
}

export function parseCalendarDate(value) {
  const text = String(value).trim();
  if (!text) return '';
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) throw new TypeError('Use MM/DD/YYYY.');
  const iso = `${match[3]}-${match[1]}-${match[2]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== iso) {
    throw new TypeError('Enter a valid date in MM/DD/YYYY format.');
  }
  return iso;
}
