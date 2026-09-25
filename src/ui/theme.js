import { ContractError } from '../errors.js';
import { CHROME_CONTRACT } from './chrome-contract.js';

export const UI_Z_INDEX = Object.freeze({
  launcher: 2147483200,
  panel: 2147483300,
  notice: 2147483400,
  dialog: 2147483500,
});

export const THEME_TOKENS = Object.freeze([
  'accent',
  'accent-contrast',
  'background',
  'border',
  'danger',
  'focus',
  'muted',
  'shadow',
  'surface',
  'surface-raised',
  'text',
  'warning',
]);

const BASE_CSS = `
html.flt-reduce-motion .flt-root, html.flt-reduce-motion .flt-root * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
:root {
  --flt-accent: #7f91a8;
  --flt-accent-contrast: #0e1217;
  --flt-background: #111114;
  --flt-border: #34343b;
  --flt-danger: #e27979;
  --flt-focus: #9cc8ff;
  --flt-muted: #adadb8;
  --flt-shadow: 0 18px 50px rgb(0 0 0 / 53%);
  --flt-surface: #18181b;
  --flt-surface-raised: #202026;
  --flt-text: #efeff1;
  --flt-warning: #edc574;
  --flt-radius-small: 7px;
  --flt-radius-medium: 11px;
  --flt-radius-large: 14px;
  --flt-launcher-size: ${CHROME_CONTRACT.artwork.launcherSize}px;
  --flt-menu-badge-size: ${CHROME_CONTRACT.artwork.menuBadgeSize}px;
  --flt-menu-width-compact: ${CHROME_CONTRACT.menu.widths.compact}px;
  --flt-menu-width-full: ${CHROME_CONTRACT.menu.widths.full}px;
  --flt-menu-width-narrow: ${CHROME_CONTRACT.menu.widths.narrow}px;
  --flt-control-height: 30px;
  --flt-toggle-height: ${CHROME_CONTRACT.toggles.height}px;
  --flt-toggle-knob-size: ${CHROME_CONTRACT.toggles.knobSize}px;
  --flt-toggle-width: ${CHROME_CONTRACT.toggles.width}px;
  --flt-z-launcher: ${UI_Z_INDEX.launcher};
  --flt-z-panel: ${UI_Z_INDEX.panel};
  --flt-z-notice: ${UI_Z_INDEX.notice};
  --flt-z-dialog: ${UI_Z_INDEX.dialog};
}
.flt-root, .flt-root * { box-sizing: border-box; }
.flt-launcher { touch-action: pan-x; user-select: none; }
.flt-launcher[data-dragging="true"], .flt-launcher[data-dragging="true"] * { cursor: grabbing; }
.flt-cluster {
  position: fixed;
  right: 12px;
  bottom: 12px;
  z-index: var(--flt-z-panel);
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-end;
  width: max-content;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 16px);
  gap: 8px;
}
.flt-cluster.open-up { flex-direction: column; }
.flt-progress-stack {
  width: min(var(--flt-menu-width-full), calc(100vw - 24px));
  max-width: calc(100vw - 24px);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  transition: .15s width;
}
.flt-progress-stack > .flt-launcher { align-self: flex-end; }
.flt-root {
  color: var(--flt-text);
  color-scheme: dark;
  font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.flt-button, .flt-icon-button, .flt-launcher-button {
  appearance: none;
  border: 1px solid var(--flt-border);
  border-radius: var(--flt-radius-small);
  background: var(--flt-surface-raised);
  color: var(--flt-text);
  cursor: pointer;
  font: inherit;
}
.flt-button {
  height: auto; min-height: var(--flt-control-height); padding: 5px 8px; line-height: 1.25;
  white-space: normal; overflow-wrap: anywhere;
}
.flt-button:hover, .flt-icon-button:hover, .flt-launcher-button:hover {
  border-color: var(--flt-accent);
}
.flt-button:focus-visible, .flt-icon-button:focus-visible, .flt-tool-header:focus-visible,
.flt-launcher-button:focus-visible, .flt-input:focus-visible, .flt-toggle:focus-visible,
.flt-theme-swatch:focus-visible {
  outline: 3px solid var(--flt-focus);
  outline-offset: 2px;
}
.flt-button:disabled, .flt-icon-button:disabled,
.flt-launcher-button:disabled, .flt-toggle:disabled { cursor: not-allowed; opacity: .58; }
.flt-button[data-flt-variant="primary"] { background: var(--flt-accent); color: var(--flt-accent-contrast); }
.flt-button[data-flt-variant="danger"] { border-color: var(--flt-danger); color: var(--flt-danger); }
.flt-launcher {
  display: grid;
  grid-template-columns: repeat(2, var(--flt-launcher-size));
  gap: 8px;
  width: max-content;
  max-width: calc(100vw - 24px);
  direction: rtl;
}
.flt-launcher-button {
  position: relative;
  width: var(--flt-launcher-size);
  height: var(--flt-launcher-size);
  padding: 3px;
  border: 1px solid color-mix(in srgb, var(--flt-accent) 30%, transparent);
  border-radius: 10px;
  background: var(--flt-surface);
  box-shadow: 0 6px 22px rgb(0 0 0 / 40%);
  direction: ltr;
  transition: .14s border-color, .14s box-shadow, .14s background, .14s transform;
}
.flt-launcher-button:hover {
  border-color: color-mix(in srgb, var(--flt-accent) 58%, transparent);
  background: color-mix(in srgb, var(--flt-surface) 96%, var(--flt-accent) 4%);
  box-shadow: 0 8px 24px rgb(0 0 0 / 47%);
  transform: scale(1.015);
}
.flt-launcher-button[aria-expanded="true"] {
  border-color: color-mix(in srgb, var(--flt-accent) 72%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--flt-accent) 22%, transparent), 0 8px 26px rgb(0 0 0 / 53%);
  transform: scale(1.01);
}
.flt-launcher[data-dragging="true"] .flt-launcher-button { transform: scale(1.03); box-shadow: 0 10px 28px rgb(0 0 0 / 60%); }
.flt-launcher-button.update-available::after {
  content: "↑";
  position: absolute;
  top: -4px;
  right: -4px;
  width: 14px;
  height: 14px;
  display: grid;
  place-items: center;
  border: 2px solid var(--flt-surface);
  border-radius: 4px;
  background: #f59e0b;
  color: #111114;
  font-size: 8px;
  font-weight: 950;
  box-shadow: 0 2px 6px rgb(0 0 0 / 47%);
  z-index: 4;
  pointer-events: none;
}
.flt-launcher-icon { width: 40px; height: 40px; border-radius: 9px; display: block; overflow: hidden; direction: ltr; }
.flt-panel {
  position: relative;
  z-index: auto;
  width: min(var(--flt-menu-width-full), calc(100vw - 24px));
  height: max-content;
  min-height: 0;
  max-height: calc(100vh - 24px);
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  overflow: hidden;
  border: 0;
  border-radius: var(--flt-radius-large);
  background: var(--flt-background);
  box-shadow: var(--flt-shadow);
  transition: .15s width, .15s opacity;
}
.flt-update-notice { transition: .15s opacity; }
.flt-panel[hidden] { display: none !important; }
.flt-header { padding: 9px 9px 4px; background: var(--flt-background); }
.flt-menu-head { display: grid; grid-template-columns: minmax(0, 1fr) 30px; align-items: start; gap: 8px; width: 100%; }
.flt-menu-head-with-help { grid-template-columns: minmax(0, 1fr) 30px 30px; gap: 6px; }
.flt-header-brand { display: grid; grid-template-columns: var(--flt-menu-badge-size) minmax(0, 1fr); align-items: center; gap: 8px; min-width: 0; width: 100%; }
.flt-header-icon {
  box-sizing: border-box;
  width: var(--flt-menu-badge-size);
  height: var(--flt-menu-badge-size);
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  display: block;
  object-fit: contain;
  overflow: hidden;
}
.flt-header-copy { min-width: 0; overflow: hidden; }
.flt-header-brand > .flt-header-copy:first-child { grid-column: 1 / -1; }
.flt-header-title-row { display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap; }
.flt-header-title { margin: 0; font-size: 15px; font-weight: 800; line-height: 1.1; }
.flt-header-version { min-height: 18px; padding: 1px 6px; border: 1px solid color-mix(in srgb, var(--flt-accent) 48%, var(--flt-border)); border-radius: 6px; background: color-mix(in srgb, var(--flt-accent) 10%, var(--flt-surface)); color: color-mix(in srgb, var(--flt-accent) 66%, var(--flt-text)); cursor: pointer; font: 800 8px/1 system-ui, sans-serif; white-space: nowrap; }
.flt-header-version:hover, .flt-header-version:focus-visible { border-color: var(--flt-accent); background: color-mix(in srgb, var(--flt-accent) 18%, var(--flt-surface)); color: var(--flt-text); outline: none; }
.flt-header-help, .flt-header-close { width: 30px; height: 30px; min-width: 30px; padding: 0; justify-self: end; border-radius: 8px; background: var(--flt-surface); color: var(--flt-muted); font: 18px/1 Arial, sans-serif; }
.flt-header-help:hover, .flt-header-help[aria-expanded="true"], .flt-header-close:hover { border-color: var(--flt-accent); color: var(--flt-text); background: var(--flt-surface-raised); }
.flt-header-items { min-width: 0; margin-top: 2px; color: var(--flt-muted); font-size: 9px; line-height: 1.2; white-space: normal; overflow-wrap: anywhere; }
.flt-header-item { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
.flt-header-divider { height: 1px; width: 100%; margin: 5px 0; background: linear-gradient(90deg, transparent, var(--flt-accent), var(--flt-accent-secondary, var(--flt-accent)), transparent); opacity: .62; }
.flt-visually-hidden { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.flt-menu-search { display: block; margin-top: 0; }
.flt-panel .flt-menu-search-input { width: 100%; max-width: none; min-height: 28px; padding: 3px 7px; font-size: 11px; }
.flt-panel-body { flex: 0 1 auto; min-height: 0; width: 100%; max-width: none; margin: 0; overflow: auto; padding: 4px 6px; scrollbar-width: thin; scrollbar-color: var(--flt-border) transparent; }
.flt-top-content { flex: none; padding: 0 6px 4px; }
.flt-preset-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 5px 7px; padding: 4px 0; border-top: 1px solid var(--flt-border); border-bottom: 1px solid var(--flt-border); }
.flt-preset-toolbar > .flt-label { color: var(--flt-text); font-weight: 750; }
.flt-update-notice {
  position: relative;
  display: block;
  width: 100%;
  max-width: calc(100vw - 24px);
  margin: 0 0 8px;
  padding: 10px;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--flt-accent) 62%, var(--flt-border));
  border-radius: 10px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--flt-surface) 88%, var(--flt-accent) 12%),
    var(--flt-background) 76%
  );
  color: var(--flt-text);
  box-shadow: 0 10px 28px rgb(0 0 0 / 53%);
  z-index: 12;
}
.flt-progress-stack > .flt-update-notice { width: min(var(--flt-menu-width-full), calc(100vw - 24px)); }
.flt-update-notice[hidden] { display: none; }
.flt-update-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding-right: 36px; }
.flt-update-heading { min-width: 0; }
.flt-update-kicker { margin-bottom: 2px; color: var(--flt-accent-secondary, var(--flt-accent)); font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.flt-update-title { color: var(--flt-text); font-size: 12px; font-weight: 850; line-height: 1.25; }
.flt-update-version { flex: none; padding: 2px 6px; border: 1px solid color-mix(in srgb, var(--flt-accent) 62%, var(--flt-border)); border-radius: 6px; background: color-mix(in srgb, var(--flt-surface) 82%, var(--flt-accent) 18%); color: var(--flt-text); font-size: 8px; font-weight: 800; white-space: nowrap; }
.flt-update-text { margin-top: 6px; color: var(--flt-muted); font-size: 9px; line-height: 1.45; white-space: normal; overflow-wrap: anywhere; }
.flt-update-list { margin: 7px 0 0; padding: 0 0 0 15px; max-height: 86px; overflow: auto; color: var(--flt-text); font-size: 9px; line-height: 1.4; scrollbar-width: thin; }
.flt-update-list li::marker { color: var(--flt-accent); }
.flt-update-list li + li { margin-top: 3px; }
.flt-update-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; padding-top: 7px; border-top: 1px solid var(--flt-border); }
.flt-update-action, .flt-update-release, .flt-update-dismiss { border: 1px solid var(--flt-border); border-radius: 7px; background: var(--flt-background); color: var(--flt-text); cursor: pointer; }
.flt-update-action, .flt-update-release { min-height: 27px; padding: 0 10px; font-size: 9px; font-weight: 800; }
.flt-update-action { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; border-color: var(--flt-accent); background: color-mix(in srgb, var(--flt-surface) 68%, var(--flt-accent) 32%); }
.flt-update-action[hidden], .flt-update-release[hidden] { display: none; }
.flt-update-release { border-color: color-mix(in srgb, var(--flt-border) 78%, var(--flt-accent) 22%); background: var(--flt-surface); }
.flt-update-dismiss { position: absolute; top: 7px; right: 7px; width: 23px; height: 23px; padding: 0; background: var(--flt-surface); color: var(--flt-muted); font-size: 15px; line-height: 1; }
.flt-update-action:hover, .flt-update-action:focus-visible { border-color: var(--flt-accent); background: color-mix(in srgb, var(--flt-surface) 55%, var(--flt-accent) 45%); color: var(--flt-text); outline: none; }
.flt-update-release:hover, .flt-update-release:focus-visible, .flt-update-dismiss:hover, .flt-update-dismiss:focus-visible { border-color: var(--flt-accent); color: var(--flt-text); outline: none; }
.flt-update-dismiss:hover, .flt-update-dismiss:focus-visible { background: var(--flt-surface-raised); }
.flt-update-release:hover, .flt-update-release:focus-visible { background: color-mix(in srgb, var(--flt-surface) 88%, var(--flt-accent) 12%); }
.flt-update-notice[data-flt-theme-skin="pride"] {
  border: 1px solid transparent;
  background-image: linear-gradient(var(--flt-surface), var(--flt-surface)),
    linear-gradient(90deg, #c97b83, #d29a70, #d0c07d, #70a886, #7091b6, #a27ba9);
  background-origin: border-box;
  background-clip: padding-box, border-box;
}
.flt-update-notice[data-flt-theme-skin="pride"] .flt-update-version,
.flt-update-notice[data-flt-theme-skin="pride"] .flt-update-action {
  border-color: transparent;
  background-image: linear-gradient(var(--flt-surface), var(--flt-surface)),
    linear-gradient(90deg, #c97b83, #d29a70, #d0c07d, #70a886, #7091b6, #a27ba9);
  background-origin: border-box;
  background-clip: padding-box, border-box;
}
.flt-tool-panel { position: relative; margin-top: 5px; border: 1px solid #27272d; background: #19191e; border-radius: 9px; overflow: visible; }
.flt-tool-panel:first-child { margin-top: 0; }
.flt-tool-header {
  appearance: none; display: flex; justify-content: space-between; align-items: flex-start;
  width: 100%; height: auto; min-height: 0; padding: 7px 8px; border: 0; border-radius: 8px;
  background: transparent; color: var(--flt-text); cursor: pointer; font: inherit; text-align: left;
}
.flt-tool-header:hover { background: color-mix(in srgb, var(--flt-accent) 10%, transparent); }
.flt-tool-header.last-opened { box-shadow: inset 3px 0 0 var(--flt-accent); }
.flt-tool-title { min-width: 0; flex: 1; font-size: 12px; font-weight: 700; white-space: normal; overflow-wrap: anywhere; }
.flt-tool-chevron { flex: none; padding: 1px 0 0 6px; border: 0; background: none; color: var(--flt-muted); font-size: 13px; line-height: 1; }
.flt-tool-body { padding: 0 10px 8px; }
.flt-tool-body:not(.flt-tool-hidden) {
  display: grid; height: auto; min-height: 0; max-height: none; overflow: visible;
  grid-template-columns: minmax(0, 1fr); align-items: stretch; column-gap: 8px;
}
.flt-tool-body > :is(.flt-button, .flt-toggle-row, .flt-field) { min-width: 0; }
.flt-control-grid > .flt-button, .flt-feature-content > .flt-button, .flt-tool-body > .flt-button {
  width: 100%; min-height: 28px; margin-top: 6px;
}
.flt-tool-hidden { display: none !important; }
.flt-feature-content { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; min-width: 0; }
.flt-field { display: grid; gap: 3px; margin-block: 4px; min-width: 0; }
.flt-label { min-width: 0; color: var(--flt-muted); font-size: 11px; line-height: 1.25; white-space: normal; overflow-wrap: anywhere; }
.flt-input {
  width: 100%; height: auto; min-height: var(--flt-control-height); border: 1px solid var(--flt-border);
  border-radius: var(--flt-radius-small); background: var(--flt-surface); color: var(--flt-text);
  padding: 5px 7px; font: inherit; line-height: 1.25;
}
.flt-input option { background: var(--flt-surface); color: var(--flt-text); }
.flt-panel select.flt-input {
  position: relative; z-index: 1; appearance: auto !important; pointer-events: auto !important;
  cursor: pointer; opacity: 1;
}
.flt-field-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 6px; align-items: start; }
.flt-field-row > .flt-field { min-width: 0; }
.flt-panel .flt-field-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.flt-panel .flt-three-columns { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.flt-panel .flt-control-grid:not([hidden]) { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 8px; row-gap: 0; align-items: stretch; }
.flt-control-grid > .flt-field-row { display: contents; }
.flt-control-grid > .flt-field-row.flt-three-columns { display: grid; grid-column: 1 / -1; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.flt-control-grid > .flt-basic-section-title, .flt-control-grid > .flt-basic-subsection, .flt-control-grid > .flt-button { grid-column: 1 / -1; }
.flt-panel .flt-control-grid .flt-input, .flt-panel .flt-three-columns .flt-input { width: 100%; max-width: 100%; }
.flt-three-columns > .flt-field > .flt-label { font-size: 9px; letter-spacing: -0.1px; white-space: nowrap; }
.flt-three-columns > .flt-field > .flt-input { padding: 4px 5px; font-size: 10px; }
.flt-control-grid > .flt-toggle-row { border-top: 0; gap: 5px; padding-block: 4px; }
.flt-match-scopes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px 6px; }
.flt-match-scopes > .flt-basic-section-title { grid-column: 1 / -1; }
.flt-match-scopes > .flt-toggle-row { min-width: 0; align-items: center; gap: 3px; padding: 2px 0; border-top: 0; }
.flt-match-scopes > .flt-toggle-row > .flt-label { min-width: 0; font-size: 9px; }
.flt-match-scopes > .flt-toggle-row > .flt-toggle { flex: none; }
.flt-inline-setting-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(104px, 1fr)); align-items: stretch; gap: 6px; }
.flt-inline-setting-row > .flt-toggle-row { min-width: 0; padding: 0; border: 0; }
.flt-inline-setting-row > .flt-toggle-row > .flt-label { font-size: 10px; }
.flt-inline-setting-row > .flt-toggle-row { flex-direction: row; justify-content: space-between; min-height: var(--flt-control-height); }
.flt-inline-setting-row > .flt-field { margin: 0; }
.flt-inline-setting-row > .flt-field > .flt-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
.flt-inline-setting-row .flt-input { width: 100%; max-width: 100%; }
.flt-inline-setting-row .flt-button { white-space: nowrap; padding-inline: 6px; }
.flt-appearance-settings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 7px; }
.flt-appearance-settings > .flt-basic-section-title { grid-column: 1 / -1; }
.flt-appearance-settings > .flt-toggle-row { min-width: 0; padding: 2px 0; border-top: 0; gap: 4px; }
.flt-appearance-settings > .flt-toggle-row > .flt-label { font-size: 10px; }
.flt-appearance-settings > .flt-field { margin: 0; }
.flt-appearance-settings > [role="status"] { grid-column: 1 / -1; }
.flt-appearance-controls { align-items: end !important; }
.flt-control-stack { display: grid; gap: 6px; }
.flt-soft-block-person { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.flt-soft-block-person > span { min-width: 0; overflow-wrap: anywhere; }
.flt-soft-block-person > button { flex: none; }
.flt-panel .flt-shortcut-editor { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 70px) auto; align-items: center; gap: 6px; margin-block: 5px; }
.flt-shortcut-editor > .flt-field { display: contents; }
.flt-panel .flt-shortcut-editor .flt-input { width: 100%; max-width: 100%; }
.flt-panel .flt-shortcut-editor .flt-button { padding: 4px 6px; font-size: 11px; }
.flt-toggle-row {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
  height: auto; min-height: var(--flt-control-height); padding: 6px 0;
}
.flt-toggle-row + .flt-toggle-row { border-top: 1px solid #26262b; }
.flt-toggle-row > .flt-label { flex: 1 1 auto; }
.flt-panel .flt-button { height: auto; min-height: var(--flt-control-height); padding: 5px 8px; }
.flt-panel .flt-input {
  width: 100%; min-width: 0; max-width: 100%; height: auto; min-height: var(--flt-control-height); padding: 4px 7px;
}
.flt-panel .flt-inline-setting-row .flt-input { width: 100%; max-width: 100%; }
.flt-panel .flt-field-row .flt-input { width: 100%; max-width: 100%; }
.flt-panel .flt-input[type="file"] { width: 100%; max-width: 100%; }
.flt-toggle {
  position: relative; box-sizing: border-box; flex: 0 0 var(--flt-toggle-width); width: var(--flt-toggle-width); height: var(--flt-toggle-height); min-width: var(--flt-toggle-width);
  min-height: var(--flt-toggle-height); margin-top: 1px; padding: 0;
  border: 1px solid color-mix(in srgb, var(--flt-border) 88%, var(--flt-muted) 12%);
  border-radius: 6px;
  background: color-mix(in srgb, var(--flt-background) 84%, var(--flt-surface) 16%);
  background-image: none;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 1.8%);
  cursor: pointer;
  transition: .15s background, .15s border-color;
}
.flt-toggle-indicator {
  display: block; position: absolute; top: 2px; left: 2px; width: var(--flt-toggle-knob-size); height: var(--flt-toggle-knob-size); box-sizing: border-box;
  border: 0; border-radius: 4px;
  background: color-mix(in srgb, var(--flt-muted) 82%, var(--flt-text) 18%);
  box-shadow: none;
  transform: translateX(0); transition: .15s transform, .15s background;
}
.flt-toggle[aria-checked="true"] {
  border-color: color-mix(in srgb, var(--flt-border) 52%, var(--flt-accent) 48%);
  background: color-mix(in srgb, var(--flt-surface) 72%, var(--flt-accent) 28%);
  background-image: none;
}
.flt-toggle[aria-checked="true"] .flt-toggle-indicator {
  transform: translateX(var(--flt-toggle-knob-size)); background: var(--flt-text);
}
.flt-theme-field { display: grid; gap: 6px; min-width: 0; }
.flt-control-grid > .flt-theme-field, .flt-appearance-controls > .flt-theme-field { grid-column: 1 / -1; }
.flt-theme-swatches { display: flex; align-items: center; gap: 6px; min-height: 28px; flex-wrap: wrap; }
.flt-theme-swatch {
  appearance: none; box-sizing: border-box; flex: 0 0 22px; width: 22px; height: 22px; min-width: 22px;
  min-height: 22px; max-width: 22px; max-height: 22px; padding: 0; border: 2px solid var(--flt-border);
  border-radius: 5px; cursor: pointer; background-repeat: no-repeat; background-size: 100% 100%;
}
.flt-theme-swatch.is-on { border-color: var(--flt-text); box-shadow: 0 0 0 2px var(--flt-accent); }
.flt-cluster[data-flt-menu-width="compact"] .flt-panel,
.flt-cluster[data-flt-menu-width="compact"] > .flt-update-notice[data-flt-placement="menu"],
.flt-panel[data-flt-menu-width="compact"], html.flt-menu-width-compact .flt-panel,
html.flt-menu-width-compact .flt-update-notice,
.flt-update-notice[data-flt-menu-width="compact"] { width: min(var(--flt-menu-width-compact), calc(100vw - 24px)); }
.flt-cluster[data-flt-menu-width="narrow"] .flt-panel,
.flt-cluster[data-flt-menu-width="narrow"] > .flt-update-notice[data-flt-placement="menu"],
.flt-panel[data-flt-menu-width="narrow"], html.flt-menu-width-narrow .flt-panel,
html.flt-menu-width-narrow .flt-update-notice,
.flt-update-notice[data-flt-menu-width="narrow"] { width: min(var(--flt-menu-width-narrow), calc(100vw - 24px)); }
.flt-cluster[data-flt-menu-width="full"] .flt-panel,
.flt-cluster[data-flt-menu-width="full"] > .flt-update-notice[data-flt-placement="menu"] {
  width: min(var(--flt-menu-width-full), calc(100vw - 24px));
}
.flt-cluster[data-flt-menu-width="compact"] .flt-progress-stack,
.flt-cluster[data-flt-menu-width="compact"] .flt-progress-stack > .flt-update-notice { width: min(var(--flt-menu-width-compact), calc(100vw - 24px)); }
.flt-cluster[data-flt-menu-width="narrow"] .flt-progress-stack,
.flt-cluster[data-flt-menu-width="narrow"] .flt-progress-stack > .flt-update-notice { width: min(var(--flt-menu-width-narrow), calc(100vw - 24px)); }
html.flt-menu-width-compact .flt-panel .flt-control-grid:not([hidden]),
html.flt-menu-width-narrow .flt-panel .flt-control-grid:not([hidden]),
html.flt-menu-width-compact .flt-appearance-settings,
html.flt-menu-width-narrow .flt-appearance-settings,
html.flt-menu-width-compact .flt-panel .flt-field-row,
html.flt-menu-width-narrow .flt-panel .flt-field-row,
html.flt-menu-width-compact .flt-panel .flt-three-columns,
html.flt-menu-width-narrow .flt-panel .flt-three-columns,
html.flt-menu-width-compact .flt-match-scopes,
html.flt-menu-width-narrow .flt-match-scopes,
.flt-panel[data-flt-menu-width="compact"] .flt-control-grid:not([hidden]),
.flt-panel[data-flt-menu-width="narrow"] .flt-control-grid:not([hidden]),
.flt-panel[data-flt-menu-width="compact"] .flt-appearance-settings,
.flt-panel[data-flt-menu-width="narrow"] .flt-appearance-settings,
.flt-panel[data-flt-menu-width="compact"] .flt-field-row,
.flt-panel[data-flt-menu-width="narrow"] .flt-field-row,
.flt-panel[data-flt-menu-width="compact"] .flt-three-columns,
.flt-panel[data-flt-menu-width="narrow"] .flt-three-columns,
.flt-panel[data-flt-menu-width="compact"] .flt-match-scopes,
.flt-panel[data-flt-menu-width="narrow"] .flt-match-scopes {
  grid-template-columns: minmax(0, 1fr);
}
html.flt-basic-high-contrast .flt-toggle, html.flt-pro-high-contrast .flt-toggle,
.flt-root[data-flt-contrast="true"] .flt-toggle {
  border: 2px solid #fff; background: #050505; background-image: none;
}
html.flt-basic-high-contrast .flt-toggle-indicator, html.flt-pro-high-contrast .flt-toggle-indicator,
.flt-root[data-flt-contrast="true"] .flt-toggle-indicator {
  top: 0; left: 0; border: 1px solid #050505; background: #fff;
}
html.flt-basic-high-contrast .flt-toggle[aria-checked="true"],
html.flt-pro-high-contrast .flt-toggle[aria-checked="true"],
.flt-root[data-flt-contrast="true"] .flt-toggle[aria-checked="true"] {
  background: #fff; border-color: #fff; background-image: none;
}
html.flt-basic-high-contrast .flt-toggle[aria-checked="true"] .flt-toggle-indicator,
html.flt-pro-high-contrast .flt-toggle[aria-checked="true"] .flt-toggle-indicator,
.flt-root[data-flt-contrast="true"] .flt-toggle[aria-checked="true"] .flt-toggle-indicator {
  background: #050505; border-color: #fff; transform: translateX(var(--flt-toggle-knob-size));
}
html[data-flt-pro-theme="pride"] .flt-toggle[aria-checked="true"],
html[data-flt-pro-accent="pride"] .flt-toggle[aria-checked="true"],
.flt-root[data-flt-theme-skin="pride"] .flt-toggle[aria-checked="true"] {
  background-image: none !important;
  border-color: color-mix(in srgb, var(--flt-border) 52%, var(--flt-accent) 48%) !important;
  background: color-mix(in srgb, var(--flt-surface) 72%, var(--flt-accent) 28%) !important;
}
html[data-flt-pro-theme="pride"] .flt-panel, html[data-flt-pro-accent="pride"] .flt-panel,
.flt-root[data-flt-theme-skin="pride"].flt-panel {
  border: 1px solid transparent;
  background-image: linear-gradient(var(--flt-background), var(--flt-background)),
    linear-gradient(90deg, #c97b83, #d29a70, #d0c07d, #70a886, #7091b6, #a27ba9);
  background-origin: border-box;
  background-clip: padding-box, border-box;
}
html[data-flt-pro-theme="pride"] .flt-header-divider, html[data-flt-pro-accent="pride"] .flt-header-divider,
.flt-root[data-flt-theme-skin="pride"] .flt-header-divider {
  height: 2px; border-radius: 2px; opacity: .9;
  background: linear-gradient(90deg, #c97b83, #d29a70, #d0c07d, #70a886, #7091b6, #a27ba9);
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 16%, #000 84%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 16%, #000 84%, transparent 100%);
}
html[data-flt-pro-theme="pride"] .flt-tool-header.last-opened,
html[data-flt-pro-accent="pride"] .flt-tool-header.last-opened,
.flt-root[data-flt-theme-skin="pride"] .flt-tool-header.last-opened,
.flt-root[data-flt-theme-skin="pride"] .flt-button.last-opened {
  box-shadow: none; position: relative;
}
html[data-flt-pro-theme="pride"] .flt-tool-header.last-opened::before,
html[data-flt-pro-accent="pride"] .flt-tool-header.last-opened::before,
.flt-root[data-flt-theme-skin="pride"] .flt-tool-header.last-opened::before,
.flt-root[data-flt-theme-skin="pride"] .flt-button.last-opened::before {
  content: ""; position: absolute; left: 0; top: 4px; bottom: 4px; width: 2px; border-radius: 2px;
  background: linear-gradient(180deg, #c97b83, #d29a70, #d0c07d, #70a886, #7091b6, #a27ba9);
}
.flt-root[data-flt-theme-skin="pride"] .flt-tool-header:hover,
.flt-root[data-flt-theme-skin="pride"] .flt-tool-header:focus-visible,
.flt-root[data-flt-theme-skin="pride"] .flt-tool-header[aria-expanded="true"] {
  background: color-mix(in srgb, var(--flt-surface) 88%, var(--flt-accent) 12%);
}
.flt-root[data-flt-theme-skin="pride"] .flt-header-version {
  border: 1px solid var(--flt-border); border-radius: 6px; background: var(--flt-background); color: var(--flt-text);
}
.flt-root[data-flt-theme-skin="pride"] .flt-header-version:hover,
.flt-root[data-flt-theme-skin="pride"] .flt-header-version:focus-visible {
  border-color: transparent;
  background-image: linear-gradient(var(--flt-surface), var(--flt-surface)),
    linear-gradient(90deg, #c97b83, #d29a70, #d0c07d, #70a886, #7091b6, #a27ba9);
  background-origin: border-box; background-clip: padding-box, border-box;
}
.flt-root[data-flt-theme-skin="pride"] .flt-launcher-button[aria-expanded="true"] {
  border: 1px solid transparent;
  background-image: linear-gradient(var(--flt-surface), var(--flt-surface)),
    linear-gradient(90deg, #c97b83, #d29a70, #d0c07d, #70a886, #7091b6, #a27ba9);
  background-origin: border-box; background-clip: padding-box, border-box;
}
@media (forced-colors: active) {
  .flt-toggle { forced-color-adjust: none; border: 1px solid CanvasText; background: Canvas; background-image: none; }
  .flt-toggle-indicator { border-color: CanvasText; background: CanvasText; }
  .flt-toggle[aria-checked="true"] { border-color: Highlight; background: Highlight; background-image: none; }
  .flt-toggle[aria-checked="true"] .flt-toggle-indicator { border-color: HighlightText; background: HighlightText; }
}
.flt-list { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
.flt-list-item { border: 1px solid var(--flt-border); border-radius: 7px; padding: 7px; background: color-mix(in srgb, var(--flt-surface-raised) 55%, transparent); }
.flt-list-item > div { display: grid; gap: 5px; }
.flt-list-item .flt-button { width: fit-content; }
.flt-visit-history-status { margin: 3px 0 5px !important; }
.flt-visit-history-list { max-height: 260px; overflow-y: auto; overscroll-behavior: contain; }
.flt-visit-history-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 7px; }
.flt-visit-history-item > div { min-width: 0; }
.flt-visit-history-item a { color: var(--flt-text); font-weight: 700; overflow-wrap: anywhere; }
.flt-visit-history-item time { display: block; margin-top: 2px; }
.flt-empty { border: 1px dashed var(--flt-border); border-radius: 7px; padding: 10px; color: var(--flt-muted); text-align: center; font-size: 11px; }
.flt-chip-field { display: grid; grid-template-columns: minmax(0, 1fr); gap: 3px; min-width: 0; }
.flt-chip-input { width: 50%; }
.flt-chip-search { width: 100%; max-width: 100%; font-size: 10px; }
.flt-chip-row, .flt-basic-actions, .flt-pro-person-actions, .flt-pro-personalize-actions { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.flt-chip-row:empty { display: none; }
.flt-chip { display: inline-flex; align-items: center; gap: 3px; min-width: 0; padding: 2px 5px; border: 1px solid var(--flt-border); border-radius: 5px; background: var(--flt-surface); color: var(--flt-text); font-size: 10px; line-height: 1.2; }
.flt-chip-saved { border-style: dashed; color: var(--flt-muted); cursor: pointer; }
.flt-chip button { width: 16px; height: 16px; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; font: 13px/1 system-ui, sans-serif; }
.flt-chip button:hover { color: var(--flt-accent); }
.flt-nested-accordion { display: grid; gap: 4px; }
.flt-nested-panel { min-width: 0; overflow: hidden; border: 1px solid color-mix(in srgb, var(--flt-accent) 34%, var(--flt-border)); border-radius: 9px; background: var(--flt-background); }
.flt-nested-header { display: flex; align-items: center; justify-content: space-between; gap: 7px; width: 100%; min-height: 27px; padding: 4px 7px; border: 0; background: transparent; color: var(--flt-text); cursor: pointer; font: 750 10px/1.2 system-ui, sans-serif; text-align: left; }
.flt-nested-header:hover, .flt-nested-header[aria-expanded="true"] { background: color-mix(in srgb, var(--flt-accent) 10%, transparent); }
.flt-nested-body { margin: 0; padding: 5px; border: 0; border-top: 1px solid var(--flt-border); border-radius: 0; background: var(--flt-background); }
.flt-nested-body[hidden] { display: none; }
.flt-chip-row .flt-button, .flt-basic-actions > .flt-button, .flt-pro-person-actions .flt-button, .flt-pro-people-views .flt-button { min-height: var(--flt-control-height); padding: 4px 7px; font-size: 11px; }
.flt-basic-actions > .flt-field { flex: 1 1 140px; }
.flt-compact-action-row { display: flex; flex-wrap: wrap; gap: 5px; align-items: flex-end; }
.flt-compact-action-row > .flt-field { flex: 1 1 140px; margin-bottom: 0; }
.flt-compact-action-row > .flt-button { flex: 0 1 auto; }
.flt-help-anchor, .flt-has-tooltip { cursor: help; position: relative; }
.flt-help-anchor[data-flt-tip]::after, .flt-has-tooltip[data-flt-tip]::after {
  content: attr(data-flt-tip);
  position: absolute;
  z-index: 4;
  left: 8px;
  top: calc(100% + 5px);
  width: max-content;
  max-width: min(260px, calc(100vw - 32px));
  padding: 6px 8px;
  border: 1px solid var(--flt-border);
  border-radius: 7px;
  background: var(--flt-surface-raised);
  color: var(--flt-text);
  box-shadow: 0 8px 24px rgb(0 0 0 / 45%);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  overflow-wrap: anywhere;
  white-space: normal;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-2px);
  transition: opacity 120ms ease 180ms, transform 120ms ease 180ms;
}
.flt-help-anchor[data-flt-tip]:hover::after, .flt-help-anchor[data-flt-tip]:focus-visible::after,
.flt-has-tooltip[data-flt-tip]:hover::after, .flt-has-tooltip[data-flt-tip]:focus-visible::after {
  opacity: 1;
  transform: translateY(0);
}
.flt-button[aria-pressed="true"] { background: var(--flt-accent); color: var(--flt-accent-contrast); border-color: var(--flt-accent); }
.flt-basic-section, .flt-pro-personalize > section { margin: 5px 0; padding: 6px; border: 1px solid #2a2a31; border-radius: 7px; background: color-mix(in srgb, var(--flt-surface) 82%, transparent); }
.flt-panel .flt-basic-section.flt-nested-body { margin: 0; padding: 4px 6px; border: 0; border-top: 1px solid var(--flt-border); border-radius: 0; background: transparent; }
.flt-panel .flt-basic-section.flt-feature-content { margin: 0; padding: 0; border: 0; background: transparent; }
.flt-feature-content > .flt-basic-section-title { display: none; }
.flt-help-anchor[data-flt-tip]::after, .flt-has-tooltip[data-flt-tip]::after { display: none; }
.flt-help-tooltip { position: fixed; z-index: 2147483600; width: max-content; max-width: min(280px, calc(100vw - 16px)); padding: 6px 8px; border: 1px solid var(--flt-border); border-radius: 7px; background: var(--flt-surface-raised); color: var(--flt-text); box-shadow: var(--flt-shadow); font-size: 11px; line-height: 1.35; pointer-events: none; }
.flt-help-tooltip[hidden] { display: none; }
.flt-support-actions { display: flex; flex-wrap: wrap; gap: 4px; padding-top: 5px; }
.flt-diagnostics-panel { display: grid; gap: 5px; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--flt-border); }
.flt-diagnostics-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.flt-diagnostics-actions > .flt-button { width: 100%; }
.flt-diagnostics-panel > h3 { margin: 0; }
.flt-diagnostics-panel > p { margin: 0; }
.flt-inline-report { max-height: 160px; margin: 0; overflow: auto; overscroll-behavior: contain; padding: 7px; border: 1px solid #2b2b31; border-radius: 7px; background: #101014; color: #b8b8c0; box-shadow: inset 0 2px 6px rgb(0 0 0 / 40%); font: 9px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.flt-root .flt-header-version, .flt-root .flt-update-version { border-radius: 6px; }
.flt-feature-content.flt-basic-section { margin: 0; padding: 0; border: 0; border-radius: 0; background: transparent; }
.flt-basic-section-title, .flt-tool-body h2, .flt-tool-body h3 { margin: 1px 0 2px; color: var(--flt-accent-secondary, var(--flt-accent)); font-size: 8px; font-weight: 900; line-height: 1.2; letter-spacing: .08em; text-transform: uppercase; }
.flt-basic-subsection { margin: 7px 0 0; padding: 8px 0 0; border-top: 1px solid var(--flt-border); }
.flt-tool-body p { margin: 5px 0; font-size: 11px; color: var(--flt-muted); }
.flt-root [role="status"]:empty { display: none; }
.flt-basic-saved-term { display: flex; flex-wrap: wrap; gap: 5px; align-items: flex-start; padding: 3px 0; }
.flt-basic-saved-term > span { flex: 1 1 100%; min-width: 0; overflow-wrap: anywhere; }
.flt-basic-saved-term .flt-button { flex: 0 1 auto; padding: 3px 6px; font-size: 10px; }
.flt-basic-saved-terms { margin-top: 5px; }
.flt-tool-body dl { margin: 5px 0; }
.flt-tool-body dt { color: var(--flt-muted); font-size: 10px; }
.flt-tool-body dd { margin: 0 0 4px; }
.flt-shortcut-help { margin: 4px 0 8px; padding: 10px; border: 1px solid var(--flt-border); border-radius: 8px; background: var(--flt-surface); color: var(--flt-text); }
.flt-shortcut-help[hidden] { display: none !important; }
.flt-shortcut-help h3 { margin: 0 0 6px; font-size: 13px; }
.flt-shortcut-disclosure { margin: 0; padding: 6px 0; border-top: 1px solid var(--flt-border); }
.flt-shortcut-disclosure summary { cursor: pointer; font-size: 12px; font-weight: 700; }
.flt-shortcut-help p { margin: 0 0 8px; color: var(--flt-muted); font-size: 11px; line-height: 1.5; }
.flt-shortcut-help .flt-shortcut-list { grid-template-columns: minmax(0, 1fr); margin: 0; }
.flt-shortcut-help kbd { display: inline-block; padding: 2px 5px; border: 1px solid var(--flt-border); border-radius: 4px; background: var(--flt-background); color: var(--flt-text); font: 600 11px/1.4 ui-monospace, monospace; }
.flt-native-shortcuts { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--flt-border); }
.flt-native-shortcuts summary { cursor: pointer; font-size: 12px; }
.flt-native-shortcuts h4 { margin: 10px 0 4px; font-size: 11px; color: var(--flt-muted); }
.flt-native-shortcut-list { margin: 0; display: grid; gap: 4px; }
.flt-reference-list { display: grid; gap: 7px; margin: 8px 0; }
.flt-reference-list > div { min-width: 0; padding: 7px; border: 1px solid var(--flt-border); border-radius: 6px; }
.flt-reference-list dt { font-size: 12px; font-weight: 700; }
.flt-reference-list dd { margin: 3px 0 0; font-size: 11px; overflow-wrap: anywhere; }
.flt-reference-list a { color: var(--flt-accent); text-decoration: underline; }
.flt-glossary-results { max-height: 300px; overflow-y: auto; overscroll-behavior: contain; }
.flt-glossary-entry[hidden] { display: none !important; }
.flt-gender-options { max-height: 230px; overflow-y: auto; overscroll-behavior: contain; }
.flt-native-shortcut-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 11px; }
.flt-native-shortcut-row dt, .flt-native-shortcut-row dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.flt-shortcut-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
.flt-shortcut-row { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; min-width: 0; padding: 3px 5px; border: 1px solid var(--flt-border); border-radius: 5px; }
.flt-shortcut-row dt, .flt-shortcut-row dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.flt-shortcut-row dd { color: var(--flt-text); font-weight: 700; }
.flt-root[data-flt-product="basic"], .flt-launcher-button[data-flt-product="basic"] { --flt-accent: #d7dee8; --flt-accent-secondary: #343a46; --flt-focus: #d7dee8; }
.flt-root[data-flt-product="pro"], .flt-launcher-button[data-flt-product="pro"] { --flt-accent: #f4c95d; --flt-accent-secondary: #a92d32; --flt-focus: #f4c95d; }
.flt-root[data-flt-product="social"], .flt-launcher-button[data-flt-product="social"] { --flt-accent: #4f8ef7; --flt-accent-secondary: #22b8cf; --flt-focus: #4f8ef7; }
.flt-root[data-flt-product="vault"], .flt-launcher-button[data-flt-product="vault"] { --flt-accent: #45c878; --flt-accent-secondary: #168f8a; --flt-focus: #45c878; }
.flt-panel[data-flt-product] .flt-tool-panel:has(.flt-tool-header[aria-expanded="true"]) { border-left-color: var(--flt-accent); }
.flt-panel [data-flt-vault-action="true"], .flt-panel .flt-vault-batch-status { border-left: 3px solid var(--flt-accent); }
.flt-social-view, .flt-vault-view { display: grid; gap: 5px; }
.flt-social-filter-panel { margin: 4px 0 6px; padding: 6px; border: 1px solid var(--flt-border); border-radius: 7px; background: var(--flt-surface); }
.flt-social-event-mode { min-width: 170px; }
.flt-social-event-mode .flt-input { width: 100%; max-width: 100%; }
.flt-social-event-row, .flt-social-saved-row, .flt-vault-library-row, .flt-vault-save-row { display: grid; gap: 4px; }
.flt-social-event-detail { color: var(--flt-muted); font-size: 10px; }
.flt-vault-library-row > span, .flt-vault-save-row > span { overflow-wrap: anywhere; font-size: 11px; }
.flt-vault-view > h2 + p, .flt-social-view > h2 + p { padding-left: 6px; border-left: 2px solid var(--flt-accent); }
.flt-dialog-backdrop {
  position: fixed; inset: 0; z-index: var(--flt-z-dialog); display: grid; place-items: center;
  padding: 18px; background: rgb(0 0 0 / 62%);
}
.flt-dialog {
  width: min(440px, 100%); max-height: calc(100vh - 36px); overflow: auto;
  border: 1px solid var(--flt-border); border-radius: var(--flt-radius-large);
  background: var(--flt-background); color: var(--flt-text); box-shadow: var(--flt-shadow); padding: 18px;
}
.flt-dialog-title { margin: 0 0 8px; font-size: 18px; }
.flt-dialog-description { margin: 0; color: var(--flt-muted); white-space: pre-wrap; }
.flt-dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: stretch; gap: 6px; margin-top: 12px; }
.flt-dialog-actions > .flt-button, .flt-notice-actions > .flt-button, .flt-support-actions > .flt-button { min-height: var(--flt-control-height); }
.flt-notice {
  position: fixed; z-index: var(--flt-z-notice); right: 84px; top: 25%;
  width: min(340px, calc(100vw - 108px)); border: 1px solid var(--flt-border);
  border-radius: var(--flt-radius-large); background: var(--flt-background); box-shadow: var(--flt-shadow);
  padding: 14px;
}
.flt-notice[data-flt-priority="critical"], .flt-notice[data-flt-priority="high"] { border-color: var(--flt-warning); }
.flt-notice-title { margin: 0 0 5px; font-size: 16px; }
.flt-notice-message { margin: 0; color: var(--flt-muted); }
.flt-notice-list { margin: 10px 0 0; padding-inline-start: 20px; }
.flt-notice-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.flt-report { max-height: 50vh; overflow: auto; white-space: pre-wrap; word-break: break-word; color: var(--flt-muted); }
.flt-release-summary { margin-top: 12px; }
.flt-live-region { position: fixed; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.flt-presentation-indicator, .flt-card-chip {
  position: relative; display: inline-block; margin: 4px; padding: 1px 5px; border: 1px solid currentColor;
  border-radius: 5px; background: var(--flt-background); color: var(--flt-text);
  font: 600 9px/1.3 system-ui, sans-serif; cursor: help;
}
.flt-profile-card-host { position: relative !important; }
.flt-profile-card-chips { position: absolute; z-index: 3; inset: 5px 5px auto auto; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 3px; max-width: calc(100% - 10px); }
.flt-profile-card-chips .flt-button, .flt-profile-card-chips .flt-card-chip { height: auto; min-height: 0; margin: 0; padding: 2px 6px; border-radius: 5px; font-size: 9px; line-height: 1.2; }
.flt-card-chip[data-flt-tip]:hover::after, .flt-card-chip[data-flt-tip]:focus-visible::after, .flt-card-chip[aria-expanded="true"]::after {
  content: attr(data-flt-tip);
  position: absolute; z-index: 6; left: 0; top: calc(100% + 4px); width: max-content;
  max-width: min(240px, calc(100vw - 24px)); padding: 6px 8px; border: 1px solid var(--flt-border);
  border-radius: 7px; background: var(--flt-surface-raised); color: var(--flt-text);
  box-shadow: var(--flt-shadow); font: 500 11px/1.35 system-ui, sans-serif; white-space: normal;
  text-align: left; pointer-events: none;
}
.flt-state-highlighted { outline: 2px solid var(--flt-accent) !important; outline-offset: 2px; }
.flt-state-dimmed { opacity: .82; }
.flt-state-hidden { display: none !important; }
.flt-media-blurred { filter: blur(var(--flt-media-blur, 4px)); }
.flt-media-hidden { visibility: hidden !important; }
@media (max-width: 560px) {
  .flt-cluster { right: 8px; bottom: 8px; }
  .flt-panel { width: min(var(--flt-menu-width-full), calc(100vw - 24px)); border-radius: var(--flt-radius-medium); }
  .flt-panel .flt-input { width: 100%; max-width: 100%; }
  .flt-field-row { grid-template-columns: minmax(0, 1fr); }
  .flt-diagnostics-actions { grid-template-columns: minmax(0, 1fr); }
  .flt-notice { inset: auto 8px 76px 8px; width: auto; }
}
@media (max-width: 360px) {
  .flt-panel, .flt-update-notice { width: calc(100vw - 24px); }
}
@media (prefers-reduced-motion: reduce) {
  .flt-root *, .flt-root *::before, .flt-root *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    scroll-behavior: auto !important; transition-duration: .01ms !important;
  }
}
`;

export const MENU_WIDTHS = Object.freeze(['full', 'compact', 'narrow']);

export function applyMenuWidth(document, width) {
  let next;
  switch (width) {
    case 'compact':
    case 'narrow':
    case 'full':
      next = width;
      break;
    default:
      next = 'full';
      break;
  }
  document.documentElement.classList.toggle('flt-menu-width-compact', next === 'compact');
  document.documentElement.classList.toggle('flt-menu-width-narrow', next === 'narrow');
  return next;
}

export class ThemeEngine {
  #document;
  #overrides = new Map();
  #style;

  constructor({ document }) {
    if (!document?.createElement) throw new ContractError('Theme engine requires a document');
    this.#document = document;
  }

  mount() {
    if (this.#style?.isConnected) return this.#style;
    const existing = this.#document.getElementById('flt-core-theme');
    if (existing) {
      this.#style = existing;
      return existing;
    }
    const style = this.#document.createElement('style');
    style.id = 'flt-core-theme';
    style.dataset.fltOwner = 'core';
    style.textContent = BASE_CSS;
    (this.#document.head ?? this.#document.documentElement).append(style);
    this.#style = style;
    return style;
  }

  setTokens(tokens) {
    if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
      throw new ContractError('Theme token overrides must be an object');
    }
    for (const [name, value] of Object.entries(tokens)) {
      if (
        !THEME_TOKENS.includes(name) ||
        typeof value !== 'string' ||
        value.trim().length === 0 ||
        value.length > 200 ||
        /[;{}]|url\s*\(/i.test(value)
      ) {
        throw new ContractError('Unknown or invalid Core theme token', { name });
      }
      this.#overrides.set(name, value.trim());
      this.#document.documentElement.style.setProperty(`--flt-${name}`, value.trim());
    }
  }

  resetTokens() {
    for (const name of this.#overrides.keys()) {
      this.#document.documentElement.style.removeProperty(`--flt-${name}`);
    }
    this.#overrides.clear();
  }

  destroy() {
    this.resetTokens();
    this.#style?.remove();
    this.#style = undefined;
  }
}
