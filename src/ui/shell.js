import { ContractError } from '../errors.js';
import { applyChromeContract, CHROME_CONTRACT } from './chrome-contract.js';
import { attachHelp, CONTROL_HELP } from './help.js';
import { dockIsLeft, ensureUpdateCluster, launcherSize } from './launcher.js';
import { applyMenuWidth } from './theme.js';
import { nativeShortcutHelp } from './shortcut-help.js';
import { terminologyHelp } from './terminology-help.js';

const VIEWPORT_EDGE = 8;

export class ProductShell {
  #activeView;
  #document;
  #element;
  #headerItems;
  #layoutFrame;
  #zeroHeightRetry = false;
  #navButtons = new Map();
  #navigationAliases = new Map();
  #cluster;
  #getChangelog;
  #notice;
  #noticeTimer;
  #productName;
  #releaseUrl;
  #returnFocus;
  #version;
  #sections = new Map();
  #views = new Map();
  #support = new Map();
  #layoutListener;
  #shortcutFooter;
  #shortcutHelp;
  #shortcutButton;
  #topContent;

  constructor({
    document,
    productId,
    productName,
    version,
    iconUrl,
    headerItems,
    navigation,
    footer = {},
    onDiagnostics,
    shortcutFooter,
    topContent,
  }) {
    if (!document?.createElement || !/^[a-z][a-z0-9-]*$/.test(productId ?? '') || !productName) {
      throw new ContractError('Product shell identity is invalid');
    }
    if (!Array.isArray(navigation) || navigation.length === 0) {
      throw new ContractError('Product shell navigation is required');
    }
    this.#document = document;
    this.#productName = productName;
    this.#version = version;
    this.#getChangelog =
      typeof footer.getChangelog === 'function'
        ? footer.getChangelog
        : () => footer.changelog ?? null;
    this.#releaseUrl = footer.releaseUrl ?? '';
    const panel = document.createElement('aside');
    panel.addEventListener('toggle', () => this.#scheduleLayout(), true);
    panel.className = 'flt-root flt-panel';
    panel.dataset.fltProduct = productId;
    panel.dataset.fltVersion = version;
    panel.dataset.fltLayout = 'product-accordion';
    panel.dataset.fltShell = 'product-dock';
    applyChromeContract(panel);
    panel.hidden = true;
    const header = document.createElement('header');
    header.className = 'flt-header';
    const top = document.createElement('div');
    top.className = 'flt-menu-head';
    const brand = document.createElement('div');
    brand.className = 'flt-header-brand';
    if (iconUrl) {
      const icon = document.createElement('img');
      icon.className = 'flt-header-icon';
      icon.alt = '';
      icon.src = iconUrl;
      brand.append(icon);
    }
    const copy = document.createElement('div');
    copy.className = 'flt-header-copy';
    const titleRow = document.createElement('div');
    titleRow.className = 'flt-header-title-row';
    const title = document.createElement('h2');
    title.className = 'flt-header-title';
    title.id = `flt-${productId}-title`;
    title.textContent = productName;
    const versionButton = document.createElement('button');
    versionButton.className = 'flt-header-version';
    versionButton.type = 'button';
    versionButton.textContent = `v${version}`;
    versionButton.title = 'View Changelog';
    versionButton.setAttribute('aria-label', `View ${productName} v${version} Changelog`);
    versionButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.showChangelog({ version });
    });
    titleRow.append(title, versionButton);
    this.#headerItems = document.createElement('div');
    this.#headerItems.className = 'flt-header-items';
    copy.append(titleRow, this.#headerItems);
    brand.append(copy);
    const close = document.createElement('button');
    close.className = 'flt-icon-button flt-header-close';
    close.type = 'button';
    close.setAttribute('aria-label', `Close ${productName}`);
    close.textContent = '×';
    close.addEventListener('click', () => this.close());
    top.append(brand, close);
    const divider = document.createElement('div');
    divider.className = 'flt-header-divider';
    this.#notice = this.#buildNotice();
    this.#notice.dataset.fltProduct = productId;
    header.append(top, divider);
    this.setHeaderItems(headerItems ?? [productName]);
    const body = document.createElement('main');
    body.className = 'flt-panel-body';
    navigation.forEach((entry, index) => {
      if (
        !/^[a-z][a-z0-9-]*$/.test(entry?.id ?? '') ||
        !entry?.label ||
        this.#views.has(entry.id)
      ) {
        throw new ContractError('Every shell destination requires a unique id and label');
      }
      const section = document.createElement('section');
      section.className = 'flt-tool-panel';
      const button = document.createElement('button');
      button.className = 'flt-tool-header';
      button.type = 'button';
      button.id = `flt-${productId}-accordion-${entry.id}`;
      button.setAttribute('aria-expanded', 'false');
      attachHelp(button, entry.description ?? CONTROL_HELP[entry.label]);
      if (entry.description) {
        button.classList.add('flt-has-tooltip');
        button.dataset.fltTip = entry.description;
        button.setAttribute('aria-description', entry.description);
      }
      const label = document.createElement('span');
      label.className = 'flt-tool-title';
      label.textContent = entry.label;
      const chevron = document.createElement('span');
      chevron.className = 'flt-tool-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '▸';
      button.append(label, chevron);
      const view = document.createElement('section');
      view.className = 'flt-tool-body flt-tool-hidden';
      view.dataset.fltView = entry.id;
      view.id = `flt-${productId}-view-${entry.id}`;
      view.setAttribute('role', 'region');
      view.setAttribute('aria-labelledby', button.id);
      if (entry.content) view.append(entry.content);
      if (onDiagnostics && (entry.id === 'diagnostics' || entry.aliases?.includes('diagnostics'))) {
        const support = document.createElement('div');
        support.className = 'flt-diagnostics-panel';
        support.setAttribute('aria-live', 'polite');
        support.textContent = 'Loading page and plugin diagnostics…';
        this.#support.set(entry.id, support);
        view.append(support);
        void onDiagnostics(support);
      }
      button.setAttribute('aria-controls', view.id);
      button.addEventListener('click', () => this.#toggleView(entry.id));
      button.addEventListener('keydown', (event) => this.#navigateAccordions(event, entry.id));
      section.append(button, view);
      body.append(section);
      this.#navButtons.set(entry.id, button);
      this.#sections.set(entry.id, section);
      this.#views.set(entry.id, view);
      for (const alias of entry.aliases ?? []) {
        if (!/^[a-z][a-z0-9-]*$/.test(alias) || this.#navigationAliases.has(alias)) {
          throw new ContractError('Every shell destination alias must be unique');
        }
        this.#navigationAliases.set(alias, entry.id);
      }
      if (index === 0) this.#activeView = entry.id;
    });
    panel.append(header);
    if (topContent) this.setTopContent(topContent, { panel });
    panel.append(body);
    panel.setAttribute('aria-labelledby', title.id);
    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (this.#shortcutHelp && !this.#shortcutHelp.hidden) {
        event.preventDefault();
        event.stopPropagation();
        this.#setShortcutHelpOpen(false);
        this.#shortcutButton.focus();
      } else this.close();
    });
    this.#element = panel;
    this.#attachToCluster();
    this.#syncNoticeChrome();
    if (shortcutFooter) this.setShortcutFooter(shortcutFooter);
    this.#layoutListener = () => this.#scheduleLayout();
    document.defaultView.addEventListener('flt:launcher-moved', this.#layoutListener);
    document.defaultView.addEventListener('resize', this.#layoutListener);
  }

  get element() {
    return this.#element;
  }

  get activeView() {
    return this.#activeView;
  }

  setShortcutFooter(content) {
    if (!this.#shortcutFooter) {
      const document = this.#document;
      const id = `flt-${this.#element.dataset.fltProduct}-shortcut-help`;
      this.#shortcutButton = document.createElement('button');
      this.#shortcutButton.className = 'flt-icon-button flt-header-help';
      this.#shortcutButton.type = 'button';
      const book = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      book.setAttribute('viewBox', '0 0 24 24');
      book.setAttribute('width', '18');
      book.setAttribute('height', '18');
      book.setAttribute('fill', 'none');
      book.setAttribute('stroke', 'currentColor');
      book.setAttribute('stroke-width', '1.75');
      book.setAttribute('stroke-linecap', 'round');
      book.setAttribute('stroke-linejoin', 'round');
      book.setAttribute('aria-hidden', 'true');
      book.setAttribute('focusable', 'false');
      const pages = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pages.setAttribute(
        'd',
        'M12 5.5C9 3.5 5.5 3.5 2 4.5v15c3.5-1 7-1 10 1 3-2 6.5-2 10-1v-15c-3.5-1-7-1-10 1Zm0 0v15',
      );
      book.append(pages);
      this.#shortcutButton.append(book);
      this.#shortcutButton.title = 'Keyboard shortcuts';
      this.#shortcutButton.setAttribute('aria-label', 'Keyboard shortcuts');
      this.#shortcutButton.setAttribute('aria-controls', id);
      this.#shortcutButton.setAttribute('aria-expanded', 'false');
      this.#shortcutButton.addEventListener('click', () =>
        this.#setShortcutHelpOpen(this.#shortcutHelp.hidden),
      );
      const head = this.#element.querySelector('.flt-menu-head');
      head.classList.add('flt-menu-head-with-help');
      head.insertBefore(this.#shortcutButton, head.querySelector('.flt-header-close'));
      this.#shortcutHelp = document.createElement('section');
      this.#shortcutHelp.className = 'flt-shortcut-help';
      this.#shortcutHelp.id = id;
      this.#shortcutHelp.hidden = true;
      this.#shortcutHelp.setAttribute('aria-labelledby', `${id}-title`);
      const heading = document.createElement('h3');
      heading.id = `${id}-title`;
      heading.textContent = 'Keyboard shortcuts';
      heading.classList.add('flt-help-anchor');
      heading.dataset.fltTip =
        'FL Tools keys work outside text fields and interactive controls. Alt+Shift is used only for conflicts. FetLife shortcuts stay unchanged.';
      heading.setAttribute('aria-description', heading.dataset.fltTip);
      heading.tabIndex = 0;
      const productShortcuts = document.createElement('details');
      productShortcuts.className = 'flt-shortcut-disclosure';
      const productSummary = document.createElement('summary');
      productSummary.textContent = 'FL Tools shortcuts';
      this.#shortcutFooter = document.createElement('div');
      productShortcuts.append(productSummary, this.#shortcutFooter);
      const nativeHelp = nativeShortcutHelp(document);
      nativeHelp.addEventListener('toggle', () => this.#scheduleLayout());
      productShortcuts.addEventListener('toggle', () => this.#scheduleLayout());
      this.#shortcutHelp.append(heading, productShortcuts, nativeHelp);
      this.#shortcutHelp.append(terminologyHelp(document, () => this.#scheduleLayout()));
      this.#element.querySelector('.flt-panel-body').prepend(this.#shortcutHelp);
    }
    this.#shortcutFooter.replaceChildren(content);
    this.#scheduleLayout();
  }

  #setShortcutHelpOpen(open) {
    if (!this.#shortcutHelp) return;
    this.#shortcutHelp.hidden = !open;
    this.#shortcutButton.setAttribute('aria-expanded', String(open));
    this.#scheduleLayout();
  }

  setTopContent(content, { panel = this.#element } = {}) {
    if (!this.#topContent) {
      this.#topContent = this.#document.createElement('div');
      this.#topContent.className = 'flt-top-content';
      panel.insertBefore(this.#topContent, panel.querySelector('.flt-panel-body'));
    }
    this.#topContent.replaceChildren(content);
    if (this.#element) this.#scheduleLayout();
  }

  getView(id) {
    return this.#views.get(this.#resolveViewId(id));
  }

  replaceViewContent(id, content) {
    const resolvedId = this.#resolveViewId(id);
    const view = this.#views.get(resolvedId);
    if (!view) throw new ContractError('Unknown shell destination', { id });
    const productContent = [...view.querySelectorAll('[data-flt-product-view-content]')].find(
      (candidate) => candidate.dataset.fltProductViewContent === resolvedId,
    );
    if (productContent) {
      productContent.replaceChildren();
      if (content) productContent.append(content);
      this.#scheduleLayout();
      return;
    }
    view.replaceChildren();
    if (content) view.append(content);
    if (this.#support.has(resolvedId)) view.append(this.#support.get(resolvedId));
    this.#scheduleLayout();
  }

  showChangelog({ version } = {}) {
    const release = this.#getChangelog?.() ?? null;
    const details = Array.isArray(release?.summary) ? release.summary : [];
    this.showUpdateNotice({
      details,
      kicker: 'Current Version',
      placement: 'menu',
      releaseUrl: this.#releaseUrl,
      text: `What's new in v${version ?? this.#version ?? release?.version ?? ''}.`,
      title: `${this.#productName} Changelog`,
      version: version ?? this.#version ?? release?.version,
    });
  }

  showUpdateNotice({
    actionLabel = 'Install Update',
    actionUrl = '',
    details = [],
    kicker = "What's New",
    onAction,
    placement = 'dock',
    releaseUrl = this.#releaseUrl,
    text = '',
    title,
    version = '',
  }) {
    if (!title) throw new ContractError('Update notice title is required');
    const noticePlacement = placement === 'menu' ? 'menu' : 'progress';
    this.#placeUpdateNotice(noticePlacement);
    const notice = this.#notice;
    this.#syncNoticeChrome();
    notice.querySelector('.flt-update-kicker').textContent = kicker;
    notice.querySelector('.flt-update-title').textContent = title;
    notice.querySelector('.flt-update-version').textContent = version ? `v${version}` : '';
    notice.querySelector('.flt-update-text').textContent = text;
    const list = notice.querySelector('.flt-update-list');
    list.replaceChildren();
    for (const detail of details.slice(0, 4)) {
      const item = this.#document.createElement('li');
      item.textContent = String(detail);
      list.append(item);
    }
    list.hidden = list.childElementCount === 0;
    const release = notice.querySelector('.flt-update-release');
    release.hidden = !releaseUrl;
    release.onclick = releaseUrl
      ? () => this.#document.defaultView.open(releaseUrl, '_blank', 'noopener')
      : null;
    const action = notice.querySelector('.flt-update-action');
    const hasAction = typeof onAction === 'function';
    action.hidden = !hasAction;
    action.textContent = actionLabel;
    if (hasAction && actionUrl) {
      action.href = actionUrl;
      action.target = '_blank';
      action.rel = 'noopener noreferrer';
    } else {
      action.removeAttribute('href');
      action.removeAttribute('target');
      action.removeAttribute('rel');
    }
    action.onclick = hasAction
      ? (event) => {
          if (!actionUrl) event.preventDefault();
          onAction(event);
        }
      : null;
    notice.hidden = false;
    this.#document.defaultView.clearTimeout(this.#noticeTimer);
    this.#noticeTimer = this.#document.defaultView.setTimeout(() => {
      if (!notice.hidden) this.hideUpdateNotice();
    }, CHROME_CONTRACT.notices.durationMs);
    this.#scheduleLayout();
  }

  hideUpdateNotice() {
    this.#document.defaultView.clearTimeout(this.#noticeTimer);
    this.#noticeTimer = undefined;
    this.#notice.hidden = true;
    this.#scheduleLayout();
  }

  setChrome({ contrast, menuWidth, themeSkin } = {}) {
    if (contrast !== undefined) {
      this.#element.dataset.fltContrast = contrast ? 'true' : 'false';
    }
    if (menuWidth !== undefined) {
      const width = applyMenuWidth(this.#document, menuWidth);
      if (width === 'full') delete this.#element.dataset.fltMenuWidth;
      else this.#element.dataset.fltMenuWidth = width;
    }
    if (themeSkin !== undefined) {
      if (themeSkin === 'pride') this.#element.dataset.fltThemeSkin = 'pride';
      else delete this.#element.dataset.fltThemeSkin;
    }
    this.#syncClusterChrome();
    this.#syncNoticeChrome();
  }

  setHeaderItems(items) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 3) {
      throw new ContractError('Shell header requires one to three meaningful items');
    }
    this.#headerItems.replaceChildren();
    const node = this.#document.createElement('span');
    node.className = 'flt-header-item';
    node.textContent = items.map(String).join(' · ');
    this.#headerItems.append(node);
  }

  setView(id, { focus = false } = {}) {
    const resolvedId = this.#resolveViewId(id);
    if (!this.#views.has(resolvedId)) throw new ContractError('Unknown shell destination', { id });
    this.#activeView = resolvedId;
    for (const [viewId, view] of this.#views) {
      const active = viewId === resolvedId;
      view.classList.toggle('flt-tool-hidden', !active);
      const button = this.#navButtons.get(viewId);
      button.setAttribute('aria-expanded', String(active));
      button.querySelector('.flt-tool-chevron').textContent = active ? '▾' : '▸';
    }
    const activeButton = this.#navButtons.get(resolvedId);
    this.#markLastOpened(resolvedId);
    if (typeof activeButton.scrollIntoView === 'function') {
      activeButton.scrollIntoView({ block: 'nearest' });
    }
    if (focus) activeButton.focus();
    this.#scheduleLayout();
  }

  ensureMounted() {
    if (!this.#element || !this.#document.body) return;
    if (
      this.#cluster?.isConnected &&
      this.#element.parentElement === this.#cluster &&
      this.#notice.isConnected
    ) {
      return;
    }
    this.#attachToCluster();
  }

  open({ trigger } = {}) {
    this.ensureMounted();
    this.#returnFocus = trigger ?? this.#document.activeElement;
    this.#element.hidden = false;
    this.#navButtons.get(this.#activeView)?.focus();
    this.#scheduleLayout();
  }

  toggle({ trigger } = {}) {
    if (this.#element.hidden) this.open({ trigger });
    else this.close();
  }

  close() {
    if (this.#element.hidden) return;
    this.#setShortcutHelpOpen(false);
    if (this.#noticePlacement() === 'menu') this.hideUpdateNotice();
    this.#element.hidden = true;
    if (this.#returnFocus?.isConnected && typeof this.#returnFocus.focus === 'function') {
      this.#returnFocus.focus();
    }
    this.#returnFocus = undefined;
    this.#scheduleLayout();
  }

  destroy() {
    this.#document.defaultView.removeEventListener('flt:launcher-moved', this.#layoutListener);
    this.#document.defaultView.removeEventListener('resize', this.#layoutListener);
    this.#document.defaultView.clearTimeout(this.#noticeTimer);
    if (this.#layoutFrame) {
      const view = this.#document.defaultView;
      if (typeof view.cancelAnimationFrame === 'function')
        view.cancelAnimationFrame(this.#layoutFrame);
      else view.clearTimeout(this.#layoutFrame);
    }
    this.#notice.remove();
    this.#element.remove();
    if (
      this.#cluster &&
      !this.#cluster.querySelector('.flt-panel') &&
      !this.#cluster.querySelector('.flt-launcher')
    ) {
      this.#cluster.remove();
    }
    this.#views.clear();
    this.#navButtons.clear();
    this.#sections.clear();
    this.#navigationAliases.clear();
  }

  #buildNotice() {
    const notice = this.#document.createElement('div');
    notice.className = 'flt-root flt-update-notice';
    notice.hidden = true;
    const dismiss = this.#document.createElement('button');
    dismiss.className = 'flt-update-dismiss';
    dismiss.type = 'button';
    dismiss.setAttribute('aria-label', 'Dismiss Update Notice');
    dismiss.textContent = '×';
    dismiss.addEventListener('click', () => this.hideUpdateNotice());
    const head = this.#document.createElement('div');
    head.className = 'flt-update-head';
    const heading = this.#document.createElement('div');
    heading.className = 'flt-update-heading';
    const kicker = this.#document.createElement('div');
    kicker.className = 'flt-update-kicker';
    const title = this.#document.createElement('div');
    title.className = 'flt-update-title';
    heading.append(kicker, title);
    const version = this.#document.createElement('div');
    version.className = 'flt-update-version';
    head.append(heading, version);
    const message = this.#document.createElement('div');
    message.className = 'flt-update-text';
    const list = this.#document.createElement('ul');
    list.className = 'flt-update-list';
    const actions = this.#document.createElement('div');
    actions.className = 'flt-update-actions';
    const release = this.#document.createElement('button');
    release.className = 'flt-update-release';
    release.type = 'button';
    release.textContent = 'GitHub Release';
    const action = this.#document.createElement('a');
    action.className = 'flt-update-action';
    action.hidden = true;
    actions.append(release, action);
    notice.append(dismiss, head, message, list, actions);
    return notice;
  }

  #toggleView(id) {
    const view = this.#views.get(id);
    if (!view) throw new ContractError('Unknown shell destination', { id });
    if (!view.classList.contains('flt-tool-hidden')) {
      view.classList.add('flt-tool-hidden');
      const button = this.#navButtons.get(id);
      button.setAttribute('aria-expanded', 'false');
      button.querySelector('.flt-tool-chevron').textContent = '▸';
      this.#markLastOpened(id);
      this.#scheduleLayout();
      return;
    }
    this.setView(id);
  }

  #markLastOpened(id) {
    for (const [viewId, button] of this.#navButtons) {
      button.classList.toggle('last-opened', viewId === id);
    }
  }

  #navigateAccordions(event, currentId) {
    const ids = [...this.#views.keys()].filter((id) => !this.#sections.get(id)?.hidden);
    const index = ids.indexOf(currentId);
    let next;
    if (event.key === 'ArrowDown') next = ids[(index + 1) % ids.length];
    if (event.key === 'ArrowUp') next = ids[(index - 1 + ids.length) % ids.length];
    if (event.key === 'Home') next = ids[0];
    if (event.key === 'End') next = ids.at(-1);
    if (!next) return;
    event.preventDefault();
    this.#navButtons.get(next).focus();
  }

  #resolveViewId(id) {
    return this.#navigationAliases.get(id) ?? id;
  }

  #noticePlacement() {
    return this.#notice.dataset.fltPlacement === 'menu' ? 'menu' : 'dock';
  }

  #progressStack() {
    return this.#cluster?.querySelector('.flt-progress-stack') ?? null;
  }

  #attachToCluster() {
    const { cluster, progressStack } = ensureUpdateCluster(this.#document);
    this.#cluster = cluster;
    if (this.#element.parentElement !== cluster) {
      cluster.insertBefore(this.#element, progressStack);
    }
    if (!cluster.isConnected) this.#document.body.append(cluster);
    this.#syncClusterChrome();
    this.#placeUpdateNotice(this.#noticePlacement() === 'menu' ? 'menu' : 'progress');
  }

  #syncClusterChrome() {
    if (!this.#cluster) return;
    const width = this.#element.dataset.fltMenuWidth || 'full';
    this.#cluster.dataset.fltMenuWidth = width;
    if (this.#element.dataset.fltThemeSkin) {
      this.#cluster.dataset.fltThemeSkin = this.#element.dataset.fltThemeSkin;
    } else {
      delete this.#cluster.dataset.fltThemeSkin;
    }
  }

  #placeUpdateNotice(placement = 'progress') {
    const notice = this.#notice;
    const progressStack = this.#progressStack();
    if (!notice || !progressStack) return;

    notice.dataset.fltPlacement = placement === 'menu' ? 'menu' : 'dock';
    this.#syncClusterChrome();
    if (notice.dataset.fltPlacement === 'dock') {
      if (notice.parentElement !== progressStack || progressStack.firstElementChild !== notice) {
        progressStack.prepend(notice);
      }
    } else if (notice.parentElement !== this.#cluster) {
      this.#cluster.appendChild(notice);
    }
  }

  #positionMenuUpdateNotice(openUp) {
    const notice = this.#notice;
    const progressStack = this.#progressStack();
    if (
      !notice ||
      !progressStack ||
      notice.hidden ||
      notice.dataset.fltPlacement !== 'menu' ||
      notice.parentElement !== this.#cluster
    ) {
      return;
    }

    if (openUp) {
      if (notice.nextElementSibling !== this.#element) {
        this.#cluster.insertBefore(notice, this.#element);
      }
    } else if (notice.nextElementSibling !== progressStack) {
      this.#cluster.insertBefore(notice, progressStack);
    }
  }

  #syncNoticeChrome() {
    this.#notice.dataset.fltProduct = this.#element.dataset.fltProduct;
    if (this.#element.dataset.fltThemeSkin) {
      this.#notice.dataset.fltThemeSkin = this.#element.dataset.fltThemeSkin;
    } else {
      delete this.#notice.dataset.fltThemeSkin;
    }
    if (this.#element.dataset.fltMenuWidth) {
      this.#notice.dataset.fltMenuWidth = this.#element.dataset.fltMenuWidth;
    } else {
      delete this.#notice.dataset.fltMenuWidth;
    }
  }

  #launcherOrigin() {
    try {
      const saved = JSON.parse(
        this.#document.defaultView.localStorage.getItem('flt-launcher-position'),
      );
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return saved;
    } catch {
      /* Optional persistence. */
    }
    return null;
  }

  #scheduleLayout() {
    const hasLauncher = Boolean(this.#cluster?.querySelector('.flt-launcher'));
    if ((this.#element.hidden && this.#notice.hidden && !hasLauncher) || this.#layoutFrame) return;
    const view = this.#document.defaultView;
    const schedule =
      typeof view.requestAnimationFrame === 'function'
        ? view.requestAnimationFrame.bind(view)
        : (callback) => view.setTimeout(callback, 0);
    this.#layoutFrame = schedule(() => {
      this.#layoutFrame = undefined;
      this.#layoutChrome();
    });
  }

  #layoutChrome() {
    const cluster = this.#cluster;
    const dock = this.#element;
    const progressStack = this.#progressStack();
    const view = this.#document.defaultView;
    if (!cluster || !progressStack) return;

    const otherOpen = [...cluster.querySelectorAll('.flt-panel')].some(
      (panel) => panel !== dock && !panel.hidden,
    );
    if (dock.hidden && otherOpen) return;

    const badgeRow = cluster.querySelector('.flt-launcher');
    const badge = launcherSize(badgeRow ?? progressStack);
    const rowHeight = Math.max(badge.height, progressStack.offsetHeight || 0, 48);
    const railOpen = !dock.hidden;
    const notice = this.#notice;
    const menuNoticeVisible = Boolean(
      notice && !notice.hidden && notice.dataset.fltPlacement === 'menu',
    );
    const noticeHeight = menuNoticeVisible ? notice.offsetHeight || notice.scrollHeight || 0 : 0;
    const noticeGap = menuNoticeVisible && noticeHeight ? CHROME_CONTRACT.notices.gapPx : 0;
    const chrome = rowHeight + noticeHeight + noticeGap + 32;
    dock.style.maxHeight = railOpen ? `${Math.max(160, view.innerHeight - chrome)}px` : '';
    dock.style.overflowY = railOpen ? 'auto' : '';

    const measuredMenu = railOpen ? dock.offsetHeight || dock.clientHeight || 0 : 0;
    if (railOpen && measuredMenu === 0 && !this.#zeroHeightRetry) {
      this.#zeroHeightRetry = true;
      this.#scheduleLayout();
    } else {
      this.#zeroHeightRetry = false;
    }
    const menuHeight = measuredMenu;
    const gap = railOpen ? 8 : 0;
    const menuBlockHeight = menuHeight + noticeHeight + noticeGap;

    const saved = this.#launcherOrigin();
    const clusterTop = saved ? saved.y : view.innerHeight - rowHeight - 12;
    if (!saved) {
      const origin = clusterTop;
      const anchor = origin <= (view.innerHeight - rowHeight) / 2 ? 'top' : 'bottom';
      cluster.dataset.fltLauncherAnchor = anchor;
    }

    const spaceBelow = view.innerHeight - clusterTop - rowHeight - 8;
    const spaceAbove = clusterTop - 8;
    const openUp =
      railOpen && menuHeight > 0 && spaceBelow < menuBlockHeight + 12 && spaceAbove >= spaceBelow;

    cluster.classList.toggle('open-up', openUp);
    cluster.style.zIndex = railOpen ? '2147483647' : '2147483600';
    this.#positionMenuUpdateNotice(openUp);

    const clusterHeight = rowHeight + gap + (railOpen ? menuHeight : 0) + noticeHeight + noticeGap;
    let top = openUp ? clusterTop - menuHeight - gap - noticeHeight - noticeGap : clusterTop;
    top = Math.max(
      VIEWPORT_EDGE,
      Math.min(view.innerHeight - Math.max(clusterHeight, rowHeight) - VIEWPORT_EDGE, top),
    );
    cluster.style.top = `${top}px`;
    cluster.style.bottom = 'auto';

    const leftDock = dockIsLeft(this.#document);
    const menuWidth = railOpen ? dock.offsetWidth || dock.clientWidth || 0 : 0;
    const noticeWidth = menuNoticeVisible ? notice.offsetWidth || notice.clientWidth || 0 : 0;
    const progressWidth = progressStack.offsetWidth || progressStack.clientWidth || 0;
    const clusterWidth = Math.max(badge.width, menuWidth, noticeWidth, progressWidth);
    const maximumInset = Math.max(VIEWPORT_EDGE, view.innerWidth - clusterWidth - VIEWPORT_EDGE);
    const clampInset = (value) => Math.max(VIEWPORT_EDGE, Math.min(maximumInset, value));
    if (saved) {
      if (leftDock) {
        cluster.style.left = `${clampInset(saved.x)}px`;
        cluster.style.right = 'auto';
      } else {
        cluster.style.left = 'auto';
        cluster.style.right = `${clampInset(view.innerWidth - (saved.x + badge.width))}px`;
      }
    } else if (leftDock) {
      cluster.style.left = `${clampInset(12)}px`;
      cluster.style.right = 'auto';
    } else {
      cluster.style.right = `${clampInset(12)}px`;
      cluster.style.removeProperty('left');
    }
  }
}
