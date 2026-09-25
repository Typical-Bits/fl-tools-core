/**
 * Shared FL Tools chrome contract.
 *
 * Products remain self-contained userscripts, while Core owns the contract
 * that keeps their launcher, menu, update notice, theme, and distribution
 * behavior aligned.
 */
export const CHROME_CONTRACT_VERSION = 1;

export const CHROME_CONTRACT = Object.freeze({
  baseline: 'compact-product-shell',
  artwork: Object.freeze({
    launcherChromeOwner: 'core',
    launcherSize: 48,
    menuBadgeContainer: 'borderless',
    menuBadgeSize: 38,
  }),
  header: Object.freeze({
    divider: 'soft-edge-fade',
    prideDivider: 'full-gradient',
    versionAction: 'changelog',
  }),
  menu: Object.freeze({
    layout: 'content-driven',
    navigation: 'single-open-accordion',
    widths: Object.freeze({ compact: 260, full: 312, narrow: 220 }),
  }),
  notices: Object.freeze({
    actions: Object.freeze(['release', 'install']),
    durationMs: 30_000,
    gapPx: 8,
    insideMenu: false,
    placement: 'floating',
  }),
  toggles: Object.freeze({
    height: 20,
    knobSize: 14,
    style: 'matte',
    width: 34,
  }),
  updates: Object.freeze({
    intervalMs: 15 * 60 * 1000,
    source: 'userscript-metadata',
  }),
});

export function applyChromeContract(element) {
  if (!element?.dataset) return element;
  element.dataset.fltChromeContract = String(CHROME_CONTRACT_VERSION);
  return element;
}
