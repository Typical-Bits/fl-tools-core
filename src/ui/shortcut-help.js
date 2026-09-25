// Reference only: FetLife owns these bindings.
const NATIVE_SHORTCUTS = {
  Sitewide: [
    ['?', 'Show keyboard shortcuts'],
    ['/', 'Focus navigation search'],
    ['.', 'Go to top of the page'],
  ],
  'Commenting & Replying': [
    ['C', 'Comment / reply'],
    ['Ctrl+Enter', 'Send'],
    ['Esc', 'Exit input mode'],
    ['Ctrl+B', 'Bold'],
    ['Ctrl+I', 'Italic'],
    ['Ctrl+Shift+S', 'Strikethrough'],
  ],
  Content: [
    ['C', 'Comment'],
    ['L', 'Love / Unlove'],
    ['B', 'Bookmark / Unbookmark'],
    ['→', 'Next'],
    ['←', 'Previous'],
  ],
  Navigation: [
    ['G then H', 'Go to home'],
    ['G then A', 'Go to notifications'],
    ['G then P', 'Go to your profile'],
    ['G then C', 'Go to inbox'],
    ['G then E', 'Go to explore'],
  ],
};

export function nativeShortcutHelp(document) {
  const details = document.createElement('details');
  details.className = 'flt-native-shortcuts';
  const summary = document.createElement('summary');
  summary.textContent = 'FetLife native shortcuts';
  details.append(summary);
  for (const [title, shortcuts] of Object.entries(NATIVE_SHORTCUTS)) {
    const heading = document.createElement('h4');
    heading.textContent = title;
    const list = document.createElement('dl');
    list.className = 'flt-native-shortcut-list';
    for (const [keys, label] of shortcuts) {
      const row = document.createElement('div');
      row.className = 'flt-native-shortcut-row';
      const term = document.createElement('dt');
      term.textContent = label;
      const definition = document.createElement('dd');
      const key = document.createElement('kbd');
      key.textContent = keys;
      definition.append(key);
      row.append(term, definition);
      list.append(row);
    }
    details.append(heading, list);
  }
  return details;
}
