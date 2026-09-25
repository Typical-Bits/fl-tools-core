import { ABBREVIATION_REFERENCE, GENDER_REFERENCE } from '../fetlife/terminology.js';
import { attachHelp } from './help.js';

function sourceLink(document, label, url) {
  const link = document.createElement('a');
  link.textContent = label;
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.referrerPolicy = 'no-referrer';
  return link;
}

export function terminologyHelp(document, onLayout) {
  const fragment = document.createDocumentFragment();
  const genders = document.createElement('details');
  genders.className = 'flt-native-shortcuts';
  const genderTitle = document.createElement('summary');
  genderTitle.textContent = 'Gender reference';
  attachHelp(
    genderTitle,
    'An explicitly empty profile gender means Not applicable. An unreadable or unrecognized value remains Unknown. Codes are distinct; matching ignores case.',
  );
  genders.append(genderTitle);
  for (const group of ['Profile abbreviations', 'Other shorthand']) {
    const heading = document.createElement('h4');
    heading.textContent = group;
    const list = document.createElement('dl');
    list.className = 'flt-reference-list';
    for (const entry of GENDER_REFERENCE.filter((e) => e.group === group)) {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = entry.code;
      const definition = document.createElement('dd');
      definition.append(sourceLink(document, entry.label, entry.url));
      row.append(term, definition);
      list.append(row);
    }
    genders.append(heading, list);
  }
  const glossary = document.createElement('details');
  glossary.className = 'flt-native-shortcuts';
  const title = document.createElement('summary');
  title.textContent = 'Abbreviations & meanings';
  attachHelp(
    title,
    'Reference meanings depend on context. These definitions do not assign traits to a profile or change your filters.',
  );
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'flt-input';
  search.placeholder = 'Search a code or meaning';
  search.setAttribute('aria-label', 'Search abbreviations');
  const status = document.createElement('p');
  status.className = 'flt-glossary-status';
  status.setAttribute('role', 'status');
  const list = document.createElement('dl');
  list.className = 'flt-reference-list flt-glossary-results';
  const rows = ABBREVIATION_REFERENCE.map((entry) => {
    const row = document.createElement('div');
    row.className = 'flt-glossary-entry';
    const term = document.createElement('dt');
    term.textContent = entry.code;
    const definition = document.createElement('dd');
    for (const meaning of entry.meanings) {
      const text = document.createElement('p');
      text.textContent = meaning;
      definition.append(text);
    }
    for (const { label, url } of entry.sources)
      definition.append(sourceLink(document, label, url), document.createTextNode(' '));
    row.append(term, definition);
    list.append(row);
    return row;
  });
  const filter = () => {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    for (const row of rows) {
      row.hidden = !row.textContent.toLocaleLowerCase().includes(query);
      if (!row.hidden) count++;
    }
    status.textContent = count ? `${count} of ${rows.length} entries` : 'No matching abbreviations';
    onLayout?.();
  };
  search.addEventListener('input', filter);
  status.textContent = `${rows.length} entries`;
  glossary.append(title, search, status, list);
  for (const section of [genders, glossary]) section.addEventListener('toggle', () => onLayout?.());
  fragment.append(genders, glossary);
  return fragment;
}
