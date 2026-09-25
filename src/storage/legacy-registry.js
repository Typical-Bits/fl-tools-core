const NAMESPACED_LAYOUT = Object.freeze({
  basic: ['seen', 'presets', 'filters', 'display', 'kinks', 'terms', 'blocks'],
  core: ['settings', 'metadata'],
  pro: [
    'notes',
    'mutes',
    'snoozes',
    'pins',
    'visits',
    'watches',
    'highlighter',
    'whitelist',
    'compare',
    'paranoid',
    'shortcuts',
    'limits',
  ],
  studio: [
    'workspaces',
    'timeline',
    'audit',
    'secure_notes',
    'vault',
    'history',
    'undo',
    'facts',
    'rules',
    'followers',
  ],
  vault: ['profiles', 'media', 'jobs', 'settings', 'index', 'diagnostics'],
});

const REGISTERED_LOCAL_KEYS = [
  'fl_perf_settings',
  'fl_settings_schema_version',
  'fl_seen_today',
  'fl_filter_presets',
  'fl_profile_filter_settings',
  'fl_profile_filter_settings_v3',
  'fl_profile_filter_settings_v2',
  'fl_display_settings',
  'fl_own_kinks',
  'fl_term_library',
  'fl_block_reasons',
  'fl_nick_notes',
  'fl_feed_mutes',
  'fl_snooze',
  'fl_profile_pins',
  'fl_visit_log',
  'fl_profile_watches',
  'fl_card_highlighter_settings',
  'fl_whitelist',
  'fl_profile_snapshots',
  'fl_paranoid',
  'fl_tools_pro_shortcuts',
  'fl_limit_history',
  'fl_tools_studio_workspaces',
  'fl_studio_timeline',
  'fl_studio_audit',
  'fl_studio_vault',
  'fl_studio_history',
  'fl_studio_undo',
  'fl_studio_profile_facts',
  'fl_studio_rules',
  'fl_studio_follower_counts',
  'fl_studio_watches',
  'fl_tools_basic_shortcuts',
  'fl_tools_basic_update_check',
  'fl_tools_grid_anchor_top_v3',
  'fl_tools_pro_update_check',
  'fl_dock_top',
  'fl_settings_launcher_top',
  'fl_panel_collapsed',
  'fl_dock_open_panel',
  'fl_last_place',
  'fl_skip_block_prompt',
  'fl_filter_preset',
  'fl_pro_start_min_v',
  'fl_pro_theme_settings',
  'fl_crypto_vault_enabled',
  'fl_crypto_vault_salt',
  'fl_crypto_vault_verifier',
  'fl_vault_launcher_top',
  'fl_tools_vault_records',
  'fl_tools_vault_records_schedule',
  'fl_tools_vault_records_visited',
  'fl_tools_vault_records_sync',
  'fl_tools_vault_records_limit',
  'fl_tools_vault_records_auto_offload',
  'fl_tools_vault_records_queue',
  'fl_tools_vault_records_theme_settings',
  'fl_tools_vault_records_scope',
];

const SESSION_KEYS = [
  'fl_private_session',
  'fl_tools_claim',
  'fl_home_scroll_map',
  'fl_markup_warn_session',
  'fl_read_stories_session',
  'fl_limit_hit_session',
  'fl_similar_seed',
  'fl_vault_session',
  'fls_vault_pass',
  'fls_vault_unlocked',
];

const namespaced = Object.entries(NAMESPACED_LAYOUT).flatMap(([scope, slots]) =>
  slots.map((slot) => `fl.${scope}.${slot}`),
);

export const LEGACY_LOCAL_KEYS = Object.freeze(
  [...new Set([...REGISTERED_LOCAL_KEYS, ...namespaced])].sort(),
);
export const LEGACY_SESSION_KEYS = Object.freeze([...SESSION_KEYS].sort());

// This is a constrained legacy namespace: the suffix is an encoded FetLife profile URL.
export function isLegacyDynamicLocalKey(key) {
  const prefix = 'fl_tools_vault_records_profile_schedule_';
  if (!key.startsWith(prefix)) return false;
  const encoded = key.slice(prefix.length);
  if (!encoded || encoded.length > 2048) return false;
  try {
    const url = new URL(decodeURIComponent(encoded));
    return (
      url.protocol === 'https:' &&
      url.hostname === 'fetlife.com' &&
      /^\/[^/]+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
