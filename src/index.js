export { CrossTabCoordinator, CROSS_TAB_PROTOCOL } from './cross-tab/coordinator.js';
export { EventBus } from './events/event-bus.js';
export { GENDER_REFERENCE } from './fetlife/terminology.js';
export { classifyFeedActivity, FEED_ACTIVITY_CATEGORIES } from './fetlife/feed-activity.js';
export {
  CompatibilityError,
  ContractError,
  CoreError,
  LifecycleError,
  SchedulerError,
  StorageConflictError,
  StorageError,
} from './errors.js';
export { ComponentRegistry } from './registries/component-registry.js';
export { ActionRegistry } from './registries/action-registry.js';
export { ProductRegistry } from './registries/product-registry.js';
export { classifyElement, candidateSafety } from './fetlife/classify.js';
export { ENTITY_TYPES, IdentityResolver, detectUrlType } from './fetlife/identity.js';
export { PARSERS, parseCandidate } from './fetlife/parsers/index.js';
export { PAGE_NAVIGATION_EVENTS, RouteMonitor } from './fetlife/route-monitor.js';
export { ROUTE_KINDS, detectRoute } from './fetlife/routes.js';
export { CURRENT_ACCOUNT_ATTRIBUTE, SELECTORS } from './fetlife/selectors.js';
export { FetLifeService } from './fetlife/service.js';
export { canonicalizeFetLifeUrl, isFetLifeUrl } from './fetlife/url.js';
export { Scanner } from './scanner/scanner.js';
export { PRIORITIES, Scheduler } from './scheduler/scheduler.js';
export { CoreRuntime, RUNTIME_STATES } from './runtime/core-runtime.js';
export { EditionOwnership } from './runtime/edition-ownership.js';
export { ErrorBoundary } from './runtime/error-boundary.js';
export { CORE_BRAND, installCore } from './runtime/install-global.js';
export { Lifecycle, LIFECYCLE_STATES } from './runtime/lifecycle.js';
export {
  DIAGNOSTIC_CATEGORIES,
  DIAGNOSTIC_RESULTS,
  DIAGNOSTIC_SEVERITIES,
  DiagnosticsService,
  redactDiagnosticValue,
} from './platform/diagnostics.js';
export { HEALTH_STATES, HealthMonitor } from './platform/health.js';
export { RuntimeMetrics } from './platform/runtime-metrics.js';
export { NOTIFICATION_PRIORITIES, NotificationCenter } from './platform/notifications.js';
export {
  RELEASE_CHANNELS,
  UpdateManager,
  compareScriptVersions,
  parseUserscriptVersion,
} from './platform/updates.js';
export { AccountScope, deriveAccountIdentity } from './storage/account-scope.js';
export {
  ACCOUNT_STORES,
  BROWSE_SETTINGS_KEY,
  DATABASE_NAME,
  DATABASE_VERSION,
  STORE_NAMES,
} from './storage/constants.js';
export { StorageDatabase } from './storage/database.js';
export { LegacyCleanup } from './storage/legacy-cleanup.js';
export {
  isLegacyDynamicLocalKey,
  LEGACY_LOCAL_KEYS,
  LEGACY_SESSION_KEYS,
} from './storage/legacy-registry.js';
export { StorageLease } from './storage/lease.js';
export {
  BROWSE_DEFAULTS,
  isValidBrowseOverrides,
  mergeBrowseSettings,
  validateRecord,
} from './storage/schema.js';
export { CoreStorage } from './storage/service.js';
export { AccessibleAnnouncer } from './ui/announcer.js';
export { ControlFactory } from './ui/controls.js';
export { CoreUI } from './ui/core-ui.js';
export {
  applyChromeContract,
  CHROME_CONTRACT,
  CHROME_CONTRACT_VERSION,
} from './ui/chrome-contract.js';
export { DialogManager } from './ui/dialog.js';
export {
  clampLauncherOrigin,
  dockIsLeft,
  ensureUpdateCluster,
  LauncherManager,
  launcherSize,
} from './ui/launcher.js';
export { NotificationSurface } from './ui/notification-surface.js';
export {
  CARD_STATES,
  MEDIA_STATES,
  PRESENTATION_PRIORITIES,
  PresentationPolicy,
} from './ui/presentation.js';
export { ProductShell } from './ui/shell.js';
export { UpdateLifecycle } from './ui/update-lifecycle.js';
export { applyMenuWidth, MENU_WIDTHS, THEME_TOKENS, ThemeEngine, UI_Z_INDEX } from './ui/theme.js';
export { attachHelp, CONTROL_HELP } from './ui/help.js';
export { displayCalendarDate, parseCalendarDate } from './ui/calendar-date.js';
