import { compareScriptVersions, parseUserscriptVersion } from '../platform/updates.js';
import { CHROME_CONTRACT } from './chrome-contract.js';

const UPDATE_CHECK_INTERVAL_MS = CHROME_CONTRACT.updates.intervalMs;
const UPDATE_CHECK_LEASE_MS = 30_000;
const UPDATE_RETURN_DELAY_MS = 3_000;
const UPDATE_RELOAD_FALLBACK_MS = 45_000;
const UPDATE_RELOAD_PENDING_TTL_MS = 2 * 60 * 1000;

function withQuery(url, params) {
  const separator = url.includes('?') ? '&' : '?';
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `${url}${separator}${query}`;
}

function cacheBustedInstallUrl(installUrl, version) {
  return withQuery(installUrl, { v: version });
}

export class UpdateLifecycle {
  #announcedVersion = '';
  #changelog;
  #checkTimer;
  #destroyed = false;
  #document;
  #fallbackTimer;
  #installUrl;
  #launcher;
  #listeners;
  #productId;
  #productName;
  #reloadTimer;
  #releaseUrl;
  #shell;
  #updateUrl;
  #version;
  #view;

  constructor({
    document,
    launcher,
    shell,
    productId,
    productName,
    version,
    changelog,
    releaseUrl = '',
    installUrl = '',
    updateUrl = '',
  }) {
    this.#document = document;
    this.#launcher = launcher;
    this.#shell = shell;
    this.#productId = productId;
    this.#productName = productName;
    this.#version = version;
    this.#changelog = changelog;
    this.#releaseUrl = releaseUrl;
    this.#installUrl = installUrl;
    this.#updateUrl = updateUrl || installUrl;
    this.#view = document.defaultView;
  }

  start() {
    this.#bindReloadWatchers();
    this.#checkVersionNotice();
    if (this.#updateUrl) {
      void this.#scheduleUpdateCheck();
      this.#checkTimer = this.#view.setInterval(() => {
        if (!this.#destroyed) void this.#scheduleUpdateCheck();
      }, UPDATE_CHECK_INTERVAL_MS);
    }
    this.#resumeReloadPending();
  }

  destroy() {
    this.#destroyed = true;
    this.#view.clearTimeout(this.#reloadTimer);
    this.#view.clearTimeout(this.#fallbackTimer);
    this.#view.clearInterval(this.#checkTimer);
    this.#listeners?.abort();
    this.#launcher.setUpdateAvailable(this.#productId, null);
  }

  #bindReloadWatchers() {
    const abort = new this.#view.AbortController();
    this.#listeners = abort;
    const options = { signal: abort.signal };
    this.#view.addEventListener('blur', () => this.#markInstallerLeft('blur'), options);
    this.#view.addEventListener('focus', () => this.#handleInstallerReturn('focus'), options);
    this.#document.addEventListener(
      'visibilitychange',
      () => {
        if (this.#document.visibilityState === 'hidden') this.#markInstallerLeft('hidden');
        else this.#handleInstallerReturn('visible');
      },
      options,
    );
    this.#view.addEventListener('pagehide', () => this.#markInstallerLeft('pagehide'), options);
  }

  #changelogDetails() {
    const release = typeof this.#changelog === 'function' ? this.#changelog() : this.#changelog;
    return Array.isArray(release?.summary) ? release.summary.slice(0, 4) : [];
  }

  #checkVersionNotice() {
    const state = this.#loadUpdateState();
    if (
      state.availableVersion &&
      compareScriptVersions(state.availableVersion, this.#version) <= 0
    ) {
      state.availableVersion = '';
      state.availableAt = 0;
      this.#saveUpdateState(state);
    }
    this.#clearAvailableIndicator();
    const previous = this.#read(this.#lastVersionKey());
    if (previous && previous !== this.#version) {
      this.#shell.showUpdateNotice({
        details: this.#changelogDetails(),
        kicker: 'Update Complete',
        placement: 'dock',
        releaseUrl: this.#releaseUrl,
        text: `Updated from v${previous} to v${this.#version}.`,
        title: `${this.#productName} Updated`,
        version: this.#version,
      });
    }
    this.#write(this.#lastVersionKey(), this.#version);
    this.#checkCachedUpdateNotice();
  }

  #checkCachedUpdateNotice() {
    const state = this.#loadUpdateState();
    const available = String(state.availableVersion || '');
    if (available && compareScriptVersions(available, this.#version) > 0) {
      this.#markUpdateAvailable(available);
      return true;
    }
    if (available && compareScriptVersions(available, this.#version) <= 0) {
      state.availableVersion = '';
      state.availableAt = 0;
      this.#saveUpdateState(state);
    }
    this.#clearAvailableIndicator();
    return false;
  }

  async #scheduleUpdateCheck(force = false) {
    const now = Date.now();
    const state = this.#loadUpdateState();
    if (
      state.availableVersion &&
      compareScriptVersions(state.availableVersion, this.#version) <= 0
    ) {
      state.availableVersion = '';
      state.availableAt = 0;
    }
    if (
      state.lastRemoteVersion &&
      compareScriptVersions(state.lastRemoteVersion, this.#version) <= 0
    ) {
      state.availableVersion = '';
      state.availableAt = 0;
    }
    state.checkedForVersion = this.#version;
    this.#saveUpdateState(state);
    if (!force && Number(state.checkLeaseUntil || 0) > now) {
      this.#checkCachedUpdateNotice();
      return;
    }
    if (
      !force &&
      state.checkedForVersion === this.#version &&
      now - Number(state.lastCheckAt || 0) < UPDATE_CHECK_INTERVAL_MS &&
      state.lastCheckAt
    ) {
      this.#checkCachedUpdateNotice();
      return;
    }
    state.lastCheckAt = now;
    state.checkLeaseUntil = now + UPDATE_CHECK_LEASE_MS;
    state.lastError = '';
    this.#saveUpdateState(state);
    const cacheBucket = Math.floor(now / UPDATE_CHECK_INTERVAL_MS);
    const checkUrl = withQuery(this.#updateUrl, {
      flt_check: this.#version,
      t: String(cacheBucket),
    });
    try {
      const remote = await this.#requestText(checkUrl);
      if (this.#destroyed) return;
      const nextState = this.#loadUpdateState();
      const remoteVersion = parseUserscriptVersion(remote.text);
      nextState.checkedForVersion = this.#version;
      nextState.lastCheckAt = Date.now();
      nextState.lastHttpStatus = remote.status;
      nextState.lastRemoteVersion = remoteVersion;
      nextState.checkLeaseUntil = 0;
      nextState.lastError = '';
      if (remoteVersion && compareScriptVersions(remoteVersion, this.#version) > 0) {
        nextState.availableVersion = remoteVersion;
        nextState.availableAt = Date.now();
        this.#saveUpdateState(nextState);
        this.#markUpdateAvailable(remoteVersion);
        return;
      }
      if (remoteVersion && compareScriptVersions(remoteVersion, this.#version) <= 0) {
        nextState.availableVersion = '';
        nextState.availableAt = 0;
        this.#clearAvailableIndicator();
      }
      this.#saveUpdateState(nextState);
    } catch (error) {
      if (this.#destroyed) return;
      const nextState = this.#loadUpdateState();
      nextState.lastError = error instanceof Error ? error.message : 'Update check failed';
      nextState.checkLeaseUntil = 0;
      nextState.lastCheckAt = Date.now();
      this.#saveUpdateState(nextState);
    }
  }

  #markUpdateAvailable(version) {
    if (!version || compareScriptVersions(version, this.#version) <= 0) return;
    const alreadyAnnounced = this.#announcedVersion === version;
    this.#launcher.setUpdateAvailable(this.#productId, version);
    if (alreadyAnnounced) return;
    this.#announcedVersion = version;
    this.#shell.showUpdateNotice({
      actionLabel: 'Install Update',
      actionUrl: cacheBustedInstallUrl(this.#installUrl || this.#updateUrl, this.#version),
      details: [
        `A newer ${this.#productName} build is available.`,
        'Install the latest userscript to get the newest fixes and improvements.',
        'After reinstalling, return to FetLife and FL Tools will refresh this page automatically.',
      ],
      kicker: 'Update Available',
      onAction: () => this.#beginUpdateInstall(version),
      placement: 'dock',
      releaseUrl: this.#releaseUrl,
      text: `v${version} is ready to install.`,
      title: `New ${this.#productName} Version Available`,
      version,
    });
  }

  #clearAvailableIndicator() {
    this.#announcedVersion = '';
    this.#launcher.setUpdateAvailable(this.#productId, null);
  }

  #beginUpdateInstall(targetVersion) {
    if (!targetVersion || compareScriptVersions(targetVersion, this.#version) <= 0) return false;
    const now = Date.now();
    this.#view.clearTimeout(this.#reloadTimer);
    this.#view.clearTimeout(this.#fallbackTimer);
    this.#write(
      this.#reloadKey(),
      JSON.stringify({
        expiresAt: now + UPDATE_RELOAD_PENDING_TTL_MS,
        fallbackAt: now + UPDATE_RELOAD_FALLBACK_MS,
        sourceVersion: this.#version,
        startedAt: now,
        targetVersion,
      }),
    );
    this.#scheduleReloadFallback();
    return true;
  }

  #resumeReloadPending() {
    if (!this.#validReloadState()) return;
    this.#scheduleReloadFallback();
    this.#enforceReloadPending(Date.now());
  }

  #validReloadState(now = Date.now()) {
    const state = this.#readJson(this.#reloadKey());
    if (!state?.startedAt || !state?.targetVersion) return null;
    if (Number(state.expiresAt || 0) <= now) {
      this.#clearReloadState();
      return null;
    }
    if (compareScriptVersions(this.#version, state.targetVersion) >= 0) {
      this.#clearReloadState();
      return null;
    }
    return state;
  }

  #clearReloadState() {
    this.#view.clearTimeout(this.#reloadTimer);
    this.#view.clearTimeout(this.#fallbackTimer);
    try {
      this.#view.localStorage.removeItem(this.#reloadKey());
    } catch {
      /* Optional persistence. */
    }
  }

  #scheduleReload(delayMs = UPDATE_RETURN_DELAY_MS) {
    const state = this.#validReloadState();
    if (!state) return false;
    const reloadAt = Date.now() + Math.max(0, delayMs);
    if (Number(state.reloadAt || 0) && Number(state.reloadAt) <= reloadAt) return true;
    state.reloadAt = reloadAt;
    this.#write(this.#reloadKey(), JSON.stringify(state));
    this.#view.clearTimeout(this.#reloadTimer);
    this.#reloadTimer = this.#view.setTimeout(
      () => {
        if (!this.#validReloadState()) return;
        this.#clearReloadState();
        this.#view.location.reload();
      },
      Math.max(0, reloadAt - Date.now()),
    );
    return true;
  }

  #scheduleReloadFallback() {
    const state = this.#validReloadState();
    if (!state) return;
    this.#view.clearTimeout(this.#fallbackTimer);
    const delay = Math.max(0, Number(state.fallbackAt || 0) - Date.now());
    this.#fallbackTimer = this.#view.setTimeout(
      () => this.#enforceReloadPending(Date.now()),
      delay + 20,
    );
  }

  #enforceReloadPending(now = Date.now()) {
    const state = this.#validReloadState(now);
    if (!state) return false;
    if (Number(state.reloadAt || 0) && Number(state.reloadAt) <= now) {
      this.#clearReloadState();
      this.#view.location.reload();
      return true;
    }
    if (this.#document.visibilityState === 'visible') {
      return this.#scheduleReload(UPDATE_RETURN_DELAY_MS);
    }
    return false;
  }

  #markInstallerLeft(reason) {
    const state = this.#validReloadState();
    if (!state || state.leftAt) return false;
    state.leftAt = Date.now();
    state.leftReason = reason;
    this.#write(this.#reloadKey(), JSON.stringify(state));
    return true;
  }

  #handleInstallerReturn() {
    const state = this.#validReloadState();
    if (!state) return false;
    if (state.leftAt) return this.#scheduleReload(UPDATE_RETURN_DELAY_MS);
    return this.#enforceReloadPending(Date.now());
  }

  async #requestText(url) {
    const gm = this.#view.GM?.xmlHttpRequest ?? this.#view.GM_xmlhttpRequest;
    if (typeof gm === 'function') {
      return new this.#view.Promise((resolve, reject) => {
        gm({
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          method: 'GET',
          onerror: (response) =>
            reject(
              new Error(
                `Update check network error${response?.status ? ` (${response.status})` : ''}`,
              ),
            ),
          onload: (response) =>
            resolve({
              status: Number(response.status || 0),
              text: String(response.responseText || ''),
            }),
          ontimeout: () => reject(new Error('Update check timed out')),
          timeout: 12_000,
          url,
        });
      });
    }
    const controller = new this.#view.AbortController();
    const timer = this.#view.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await this.#view.fetch(url, {
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        signal: controller.signal,
      });
      return {
        status: Number(response.status || 0),
        text: await response.text(),
      };
    } finally {
      this.#view.clearTimeout(timer);
    }
  }

  #loadUpdateState() {
    const parsed = this.#readJson(this.#updateStateKey());
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }

  #saveUpdateState(state) {
    this.#write(this.#updateStateKey(), JSON.stringify(state || {}));
  }

  #readJson(key) {
    try {
      return JSON.parse(this.#view.localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  }

  #read(key) {
    try {
      return this.#view.localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  }

  #write(key, value) {
    try {
      this.#view.localStorage.setItem(key, value);
    } catch {
      /* Optional persistence. */
    }
  }

  #lastVersionKey() {
    return `flt:${this.#productId}:last-version`;
  }

  #updateStateKey() {
    return `flt:${this.#productId}:update-state`;
  }

  #reloadKey() {
    return `flt:${this.#productId}:update-reload`;
  }
}
