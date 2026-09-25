// Shared wording describes real behavior, never a placeholder feature promise.
export const CONTROL_HELP = Object.freeze({
  Diagnostics:
    'Inspect or export page and plugin diagnostics, and access this product’s data maintenance controls.',
  'Reduce Motion':
    'Disable FL Tools animation and transitions. Operating system reduced-motion preferences still apply.',
  Notifications: 'Show or hide noncritical FL Tools notices on this browser and site.',
  'Menu theme': 'Choose the shared visual theme used by every FL Tools menu on this page.',
  'Picture threshold':
    'Highlight known picture counts below this number when the Pictures rule is enabled.',
  'Video threshold':
    'Highlight known video counts below this number when the Videos rule is enabled. Zero disables the low-count match.',
  'Writing threshold':
    'Highlight known writing counts below this number when the Writings rule is enabled. Zero disables the low-count match.',
  'Minimum pictures':
    'Require at least this many source-reported pictures. Leave blank to ignore picture count.',
  'Minimum videos':
    'Require at least this many source-reported videos. Leave blank to ignore video count.',
  'Minimum writings':
    'Require at least this many source-reported writings. Leave blank to ignore writing count.',
  'Maximum additional pages (1–20)':
    'Stop automatic loading after this many additional native pages during the current traversal.',
  'Blur strength (1–10)': 'Choose the blur strength applied to media in Blur presentation mode.',
  'Seen profile presentation':
    'Choose whether previously visited profiles stay normal, dim, or disappear from supported card lists.',
  'Soft-blocked profiles':
    'Hide or dim people you have locally Soft Blocked. Native FetLife blocks remain separate.',
  'Media presentation': 'Show, blur, or hide supported media already loaded on the page.',
  'Appearance and accessibility':
    'Control spacing, contrast, menu width, system notices, and default launcher placement.',
  'Fixed shortcuts':
    'Open the ? button beside Close for shortcuts. Basic and Pro share single keys, with Alt+Shift+B reserved for the native bookmark conflict.',
  Reset: 'Restore Browse defaults. Other product data is not removed by this action.',
  'Group name contains': 'Filter only the loaded native Groups whose names contain this text.',
  'Event name contains': 'Filter only the loaded native Events whose names contain this text.',
  'Source location contains':
    'Match the location text supplied by the event; no external location lookup is performed.',
  'Creator name or stable ID':
    'Search creators in the local Vault catalog; this does not search FetLife.',
  'Saved since (YYYY-MM-DD)': 'Limit the Vault catalog to items saved on or after this date.',
  'Reindex Vault':
    'Check the chosen destination for committed saves and recovery evidence. Does not import arbitrary files or delete bytes.',
  Filters:
    'Filter visible profile cards using age, role, location, content counts, and term chips.',
  Highlighter:
    'Highlight cards with verified low content counts, relationships, or an explicit People selection.',
  People:
    'Search local People records by name, ID, or private note, then open a result for its actions.',
  'Soft Block':
    'Manage locally blocked people by name or numeric profile ID, then choose Hide or Dim. Native FetLife Block remains separate.',
  Media:
    'Show, blur, or hide loaded media, adjust blur strength, or temporarily reveal native presentation.',
  Seen: 'Control indicators and presentation for profiles visited by this account.',
  Advanced: 'Automatic next-page loading and reversible page enhancements.',
  Personalize:
    'Private Session, Themes swatches, menu width, launcher placement, and keyboard shortcuts.',
  Themes:
    'Choose a site and menu color theme. Site Default leaves the native site theme unchanged.',
  System:
    'Appearance preferences and a Diagnostics submenu for export and resetting Browse settings.',
  Settings: 'Product maintenance and page/plugin diagnostics export.',
  Groups: 'Filter loaded native Groups by name, membership, and source-reported activity.',
  Events: 'Filter loaded native Events by name, source location, dates, and attendance mode.',
  Saved: 'Open or remove your locally saved Group and Event references.',
  Library:
    'Search the local saved-content catalog; remove catalog entries or deliberately delete saved files.',
  Save: 'Select qualified content already loaded on this page and review it before saving.',
  'Minimum age': 'Exclude known ages below this value. Leave blank for no lower bound.',
  'Maximum age': 'Exclude known ages above this value. Leave blank for no upper bound.',
  'Match criteria':
    'AND requires every selected criterion; OR accepts any selected criterion. Hard limits still take priority.',
  'Nonmatching profiles':
    'Hide removes nonmatches from the page layout; Dim keeps them visible for review.',
  'Role matching': 'Required rejects known role mismatches; Preferred does not reject them.',
  'Profile card': 'Include visible profile-card text when evaluating term chips.',
  Tags: 'Include parsed tag text when evaluating term chips.',
  Nickname: 'Include the displayed nickname when evaluating term chips.',
  'Include terms':
    'Match at least one active term in the selected fields. Add with Enter or comma; remove with ×.',
  'Exclude terms':
    'Reject cards matching any active term in the selected fields. Saved chips can be reused.',
  'Hard limits':
    'Matching terms take priority over other filters. On supported profile pages, a match offers local Soft Block or the native FetLife Block flow.',
  Pictures: 'Highlight profiles with a verified picture count below the configured threshold.',
  Videos: 'Highlight profiles with a verified video count below the configured threshold.',
  Writings: 'Highlight profiles with a verified writing count below the configured threshold.',
  Friends:
    'Use the friend relationship reported by the page; unknown relationships are not assumed.',
  'Follows you':
    'Use the follows-you relationship reported by the page; unknown relationships are not assumed.',
  Following:
    'Use the following relationship reported by the page; unknown relationships are not assumed.',
  'Blur avatars in SFW': 'Include loaded avatar images in SFW blurring.',
  'Blur videos in SFW': 'Include loaded video media in SFW blurring.',
  'Show Seen indicators':
    'Show an indicator on supported cards for profiles already visited by this account.',
  'Auto Page Load':
    'Load the native next page near the bottom, including FetLife numbered and Next links, up to the configured additional-page limit.',
  'Infinite Scroll': 'Load native next pages near the bottom, up to the configured limit.',
  'Page Enhancements':
    'Reversible changes to supported native links, timestamps, interests, banners, and picture navigation.',
  'Visited profile styling':
    'Mark links to profiles recorded in this account’s local Seen history.',
  'Exact timestamps': 'Show an exact time where the page provides a parseable source timestamp.',
  'Shared interests': 'Emphasize shared-interest information supplied by the page.',
  'Hide banners': 'Hide recognized promotional banners without removing native navigation.',
  'Picture navigation':
    'Add next-picture navigation where a native next-picture destination is available.',
  'Compact layout': 'Reduce spacing in plugin controls without fixing row heights.',
  'High contrast': 'Increase contrast for plugin surfaces and boundaries.',
  'Menu width':
    'Choose Full, Compact, or Narrow plugin menu width. Other FL Tools menus on this page follow the same width.',
  'Update and system notifications': 'Show product update and system notices.',
  'Launcher side':
    'Choose the default docking side. You can also drag any launcher to move the whole grid.',
  'Reduce motion': 'Reduce interface animations and transitions.',
  'Compact dock': 'Use a narrower launcher arrangement.',
  'Hide Pro dock launcher':
    'Hide the Pro launcher; use the configured interface shortcut to restore it.',
  'Show Quieted cards dimmed':
    'Keep Quieted people visible but dimmed instead of hiding their cards.',
  'Joined groups only': 'Keep Groups whose native source confirms your membership.',
  'Has source-reported new activity':
    'Keep Groups with new activity explicitly reported by the native page.',
  'Search People':
    'Search local names, IDs, and private notes. No names are listed until you enter a search.',
  'Select all qualified items in this loaded scope':
    'Select supported items already loaded here. This does not crawl other pages or start a save.',
});

export function attachHelp(element, description) {
  if (!description) return;
  element.dataset.fltTip = description;
  element.setAttribute('aria-description', description);
}

export class HelpTooltips {
  #document;
  #abort;
  #tip;
  constructor(document) {
    this.#document = document;
  }

  ensureMounted() {
    if (this.#tip && !this.#tip.isConnected && this.#document.body) {
      this.#document.body.append(this.#tip);
    }
  }

  start() {
    if (this.#tip) {
      this.ensureMounted();
      return;
    }
    const document = this.#document;
    const view = document.defaultView;
    this.#abort = new view.AbortController();
    const options = { signal: this.#abort.signal };
    const tip = document.createElement('div');
    tip.className = 'flt-root flt-help-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    this.#tip = tip;
    document.body.append(tip);
    const hide = () => {
      tip.hidden = true;
    };
    const show = (event) => {
      const target = event.target.closest?.('[data-flt-tip]');
      if (!target || target.classList.contains('flt-card-chip') || !target.closest('.flt-root')) {
        hide();
        return;
      }
      if (!tip.isConnected) document.body.append(tip);
      tip.textContent = target.dataset.fltTip;
      tip.hidden = false;
      const rect = target.getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      tip.style.left = `${Math.max(8, Math.min(rect.left, view.innerWidth - box.width - 8))}px`;
      tip.style.top = `${Math.max(8, rect.bottom + box.height + 8 < view.innerHeight ? rect.bottom + 6 : rect.top - box.height - 6)}px`;
    };
    for (const type of ['pointerover', 'focusin']) document.addEventListener(type, show, options);
    for (const type of ['pointerout', 'focusout', 'pointerdown'])
      document.addEventListener(type, hide, options);
    document.addEventListener('scroll', hide, { ...options, capture: true });
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') hide();
      },
      options,
    );
  }
  stop() {
    this.#abort?.abort();
    this.#tip?.remove();
  }
}
