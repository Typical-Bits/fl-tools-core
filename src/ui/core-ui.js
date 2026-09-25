import { SharedPreferences } from './shared-preferences.js';
import { ContractError } from '../errors.js';
import { PAGE_NAVIGATION_EVENTS } from '../fetlife/route-monitor.js';
import { AccessibleAnnouncer } from './announcer.js';
import { ControlFactory } from './controls.js';
import { DialogManager } from './dialog.js';
import { LauncherManager } from './launcher.js';
import { NotificationSurface } from './notification-surface.js';
import { PresentationPolicy } from './presentation.js';
import { ProductShell } from './shell.js';
import { ThemeEngine } from './theme.js';
import { attachHelp, HelpTooltips } from './help.js';
import { UpdateLifecycle } from './update-lifecycle.js';

export class CoreUI {
  #document;
  #shells = new Set();
  #started = false;
  #survivalAbort;
  #survivalObserver;
  #version;
  #diagnostics;
  #health;
  #updates;
  #notificationCenter;
  #help;
  #onDocumentPointerDown = (event) => {
    const target = event.target;
    if (!target || [...this.#shells].some((shell) => shell.element.contains(target))) return;
    if (target.closest?.('.flt-launcher, .flt-dialog, .flt-update-notice')) return;
    for (const shell of this.#shells) shell.close();
  };

  constructor({ document, idFactory, version, diagnostics, health, notifications, updates }) {
    if (!document?.createElement || !version)
      throw new ContractError('Core UI dependencies are required');
    this.#document = document;
    this.#version = version;
    this.controls = new ControlFactory({ document, idFactory });
    this.dialogs = new DialogManager({ controls: this.controls, document, idFactory });
    this.launcher = new LauncherManager({ document });
    this.presentation = new PresentationPolicy({ document });
    this.announcer = new AccessibleAnnouncer({ document });
    this.theme = new ThemeEngine({ document });
    this.#help = new HelpTooltips(document);
    this.#diagnostics = diagnostics;
    this.#health = health;
    this.preferences = new SharedPreferences({
      document,
      controls: this.controls,
      apply: (value) => {
        for (const shell of this.#shells) shell.setChrome(value);
        this.notifications?.setEnabled(value.notifications);
      },
    });
    this.#updates = updates;
    this.#notificationCenter = notifications;
    this.notifications = notifications
      ? new NotificationSurface({
          announcer: this.announcer,
          controls: this.controls,
          document,
          notifications,
        })
      : null;
  }

  start() {
    if (this.#started) return;
    this.theme.mount();
    this.#help.start();
    this.announcer.mount();
    this.notifications?.mount();
    this.preferences.apply();
    this.#watchSurvival();
    this.#started = true;
  }

  restoreChrome() {
    if (!this.#started) return;
    this.theme.mount();
    this.announcer.mount();
    this.#help.ensureMounted();
    for (const shell of this.#shells) shell.ensureMounted();
  }

  #watchSurvival() {
    const document = this.#document;
    const view = document.defaultView;
    const restore = () => this.restoreChrome();
    const Observer = view?.MutationObserver;
    if (Observer) {
      this.#survivalObserver = new Observer(restore);
      this.#survivalObserver.observe(document, { childList: true, subtree: true });
    }
    if (!view?.addEventListener) return;
    this.#survivalAbort = new view.AbortController();
    const options = { signal: this.#survivalAbort.signal };
    document.addEventListener('pointerdown', this.#onDocumentPointerDown, options);
    for (const type of PAGE_NAVIGATION_EVENTS) {
      view.addEventListener(type, restore, options);
      document.addEventListener(type, restore, options);
    }
  }

  createShell(options) {
    if (!this.#started) throw new ContractError('Core UI is not started');
    const footer = {
      getChangelog: () => options.changelog ?? this.#updates?.whatsNew(options.productId) ?? null,
      releaseUrl: options.releaseUrl ?? '',
      ...(options.footer ?? {}),
    };
    const version = options.version ?? this.#version;
    const preferences = this.preferences.mount();
    const supplied = options.navigation.map((entry) => ({ ...entry }));
    const appearance = supplied.find((entry) => entry.id === 'appearance');
    const diagnostics = supplied.find((entry) => entry.id === 'diagnostics');
    const system = supplied.find((entry) => entry.id === 'system');
    const combine = (id, contents, shared = []) => {
      const root = this.#document.createElement('div');
      root.className = 'flt-control-stack';
      const productContent = this.#document.createElement('div');
      productContent.className = 'flt-control-stack';
      productContent.dataset.fltProductViewContent = id;
      for (const content of contents) if (content) productContent.append(content);
      root.append(productContent);
      for (const content of shared) if (content) root.append(content);
      return root;
    };
    const navigation = supplied.filter(
      (entry) => !['appearance', 'diagnostics', 'system'].includes(entry.id),
    );
    navigation.push({
      ...appearance,
      content: combine('appearance', [appearance?.content], [preferences.element]),
      description:
        appearance?.description ??
        'Adjust how FL Tools menus look and behave on this browser and site.',
      id: 'appearance',
      label: 'Appearance',
    });
    navigation.push({
      ...system,
      aliases: [
        ...new Set([
          ...(system?.aliases ?? []),
          ...(diagnostics?.aliases ?? []),
          'diagnostics',
          'settings',
        ]),
      ],
      content: combine('system', [system?.content, diagnostics?.content]),
      description:
        system?.description ??
        'Review page and plugin health, export diagnostics, and use product maintenance actions.',
      id: 'system',
      label: 'System',
    });
    const shell = new ProductShell({
      ...options,
      navigation,
      document: this.#document,
      footer,
      onDiagnostics: this.#diagnostics
        ? (container) => this.mountDiagnostics(container)
        : undefined,
      version,
    });
    this.#shells.add(shell);
    this.preferences.apply();
    const lifecycle =
      options.installUrl || options.updateUrl
        ? new UpdateLifecycle({
            changelog: footer.getChangelog,
            document: this.#document,
            installUrl: options.installUrl ?? options.updateUrl,
            launcher: this.launcher,
            productId: options.productId,
            productName: options.productName,
            releaseUrl: footer.releaseUrl,
            shell,
            updateUrl: options.updateUrl ?? options.installUrl,
            version,
          })
        : null;
    lifecycle?.start();
    const open = shell.open.bind(shell);
    const close = shell.close.bind(shell);
    shell.open = (openOptions) => {
      for (const other of this.#shells) {
        if (other !== shell) other.close();
      }
      open(openOptions);
      if (this.launcher.has(options.productId)) this.launcher.setActive(options.productId);
    };
    shell.close = () => {
      close();
      if ([...this.#shells].every((candidate) => candidate.element.hidden)) {
        this.launcher.setActive(null);
      }
    };
    const destroy = shell.destroy.bind(shell);
    shell.destroy = () => {
      preferences.destroy();
      lifecycle?.destroy();
      this.#shells.delete(shell);
      destroy();
    };
    return shell;
  }

  notify(item) {
    if (!this.#notificationCenter?.upsert) return null;
    return this.#notificationCenter.upsert(item);
  }

  dismissNotification(id) {
    return this.#notificationCenter?.dismiss(id) ?? false;
  }

  async mountDiagnostics(container, { detailed = false } = {}) {
    if (!container?.replaceChildren || !this.#diagnostics)
      throw new ContractError('Diagnostics is unavailable');
    const doc = this.#document;
    const heading = doc.createElement('h3');
    heading.textContent = 'Diagnostics';
    heading.classList.add('flt-help-anchor');
    heading.tabIndex = 0;
    attachHelp(
      heading,
      'Page, technical, console and plugin status. Review before sharing. Nothing is sent automatically. Reset clears only diagnostic session records; saved settings and data are preserved.',
    );
    const reportView = doc.createElement('pre');
    reportView.className = 'flt-report flt-inline-report';
    reportView.hidden = !detailed;
    reportView.tabIndex = 0;
    reportView.setAttribute('role', 'region');
    reportView.setAttribute('aria-label', 'Page, technical, console and plugin diagnostics');
    const status = doc.createElement('p');
    status.setAttribute('role', 'status');
    const actions = doc.createElement('div');
    actions.className = 'flt-diagnostics-actions';
    let lastReport;
    const snapshot = async () => {
      const selfTests = await this.#diagnostics.runSelfTests();
      lastReport = this.#diagnostics.report({ detailed: true, selfTests });
      reportView.textContent = JSON.stringify(lastReport, null, 2);
      return lastReport;
    };
    const action = (label, success, run) => {
      const button = this.controls.button({
        label,
        onClick: async () => {
          button.disabled = true;
          try {
            await run();
            status.textContent = success;
          } catch {
            status.textContent = label + ' failed. Please try again.';
          } finally {
            button.disabled = false;
          }
        },
      });
      actions.append(button);
      return button;
    };
    const toggle = action('Show Diagnostics', '', async () => {
      if (reportView.hidden) await snapshot();
      reportView.hidden = !reportView.hidden;
      toggle.textContent = reportView.hidden ? 'Show Diagnostics' : 'Hide Diagnostics';
      toggle.setAttribute('aria-expanded', String(!reportView.hidden));
    });
    toggle.textContent = detailed ? 'Hide Diagnostics' : 'Show Diagnostics';
    toggle.setAttribute('aria-expanded', String(detailed));
    action('Copy Diagnostics', 'Diagnostics Copied', async () => {
      const report = await snapshot();
      const clipboard = doc.defaultView?.navigator?.clipboard;
      if (typeof clipboard?.writeText !== 'function')
        throw new ContractError('Clipboard unavailable');
      await clipboard.writeText(JSON.stringify(report, null, 2));
    });
    action('Clear Activity Log', 'Activity Cleared', async () => {
      this.#diagnostics.clearActivity();
      await snapshot();
    });
    action('Refresh State', 'State Refreshed', snapshot);
    action('Reset Session State', 'Session Reset', async () => {
      this.#diagnostics.resetSession();
      await snapshot();
    });
    action('Export JSON', 'Diagnostics Exported', async () => {
      const report = await snapshot();
      const view = doc.defaultView;
      const blob = new view.Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = view.URL.createObjectURL(blob);
      const link = doc.createElement('a');
      link.href = url;
      link.download =
        'fl-tools-diagnostics-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      doc.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        view.setTimeout(() => view.URL.revokeObjectURL(url), 1000);
      }
    });
    container.replaceChildren(heading, actions, status, reportView);
    if (detailed) {
      try {
        await snapshot();
      } catch {
        status.textContent = 'Diagnostics could not be loaded. Use Refresh State to retry.';
      }
    }
    return {
      snapshot,
      get report() {
        return lastReport;
      },
    };
  }

  async openDiagnostics({ detailed = false } = {}) {
    const content = this.#document.createElement('div');
    const panel = await this.mountDiagnostics(content, { detailed });
    const dialog = this.dialogs.open({
      actions: [{ autofocus: true, label: 'Close', value: 'close' }],
      content,
      description: 'Local FL Tools diagnostics.',
      title: 'FL Tools Diagnostics',
    });
    await dialog.result;
    return panel.report;
  }

  async openWhatsNew(productId) {
    const release = this.#updates?.whatsNew(productId);
    const content = this.#document.createElement('div');
    content.className = 'flt-release-summary';
    if (release) {
      const list = this.#document.createElement('ul');
      for (const bullet of release.summary) {
        const item = this.#document.createElement('li');
        item.textContent = bullet;
        list.append(item);
      }
      content.append(list);
    } else {
      content.textContent = 'No installed release summary is available yet.';
    }
    return this.dialogs.open({
      actions: [{ autofocus: true, label: 'Close', value: true }],
      content,
      description: release ? `Version ${release.version} (${release.channel})` : '',
      title: "What's New",
    }).result;
  }

  openAbout({ productName, version }) {
    const health = this.#health?.snapshot();
    return this.dialogs.open({
      actions: [{ autofocus: true, label: 'Close', value: true }],
      description: `${productName} v${version ?? this.#version}\nCore v${this.#version}\nHealth: ${health?.state ?? 'Unavailable'}`,
      title: 'Version and health',
    }).result;
  }

  async confirmLegacyCleanup(cleanup, detection) {
    if (!cleanup?.confirmAndDelete || !detection?.confirmationToken) {
      throw new ContractError('Legacy cleanup confirmation requires a detection result');
    }
    if (!detection.found) return Object.freeze({ status: 'NOT_NEEDED' });
    const count = detection.local.length + detection.session.length;
    const confirmed = await this.dialogs.confirm({
      confirmLabel: 'Delete legacy FL Tools data',
      description:
        `${count} recognized legacy storage ${count === 1 ? 'entry is' : 'entries are'} incompatible with this release. ` +
        'Only the listed FL Tools legacy entries will be deleted. This cannot be undone.',
      destructive: true,
      title: 'Start clean with FL Tools?',
    });
    if (!confirmed) return Object.freeze({ status: 'CANCELLED' });
    const result = await cleanup.confirmAndDelete(detection.confirmationToken);
    this.announcer.announce('Legacy FL Tools data was deleted and verified.');
    return Object.freeze({ ...result, status: 'COMPLETE' });
  }

  stop() {
    if (!this.#started) return;
    this.#survivalObserver?.disconnect();
    this.#survivalObserver = undefined;
    this.#survivalAbort?.abort();
    this.#survivalAbort = undefined;
    this.dialogs.destroy();
    this.#help.stop();
    this.notifications?.destroy();
    for (const shell of [...this.#shells]) shell.destroy();
    this.#shells.clear();
    this.presentation.destroy();
    this.launcher.destroy();
    this.announcer.destroy();
    this.preferences.stop();
    this.theme.destroy();
    this.#started = false;
  }
}
