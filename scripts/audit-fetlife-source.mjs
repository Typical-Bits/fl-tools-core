import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import process from 'node:process';
import { JSDOM } from 'jsdom';
import { detectRoute } from '../src/fetlife/routes.js';
import { CANDIDATE_ROOT_QUERY } from '../src/fetlife/selectors.js';
import { FetLifeService } from '../src/fetlife/service.js';

const entityRouteKinds = new Set(['content', 'event', 'group', 'profile']);

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function sortedObject(map, limit = 20) {
  return Object.fromEntries([...map].sort((left, right) => right[1] - left[1]).slice(0, limit));
}

function safeSignature(element) {
  const attributes = [...element.attributes]
    .map(({ name }) => name)
    .filter((name) => name === 'role' || name.startsWith('data-'))
    .sort();
  return `${element.tagName.toLowerCase()}${attributes.map((name) => `[${name}]`).join('')}`;
}

function routeFamily(href, baseUrl) {
  const kind = detectRoute(href, baseUrl).kind;
  return entityRouteKinds.has(kind) ? kind : null;
}

function pathShape(href, baseUrl) {
  try {
    const preserved = new Set([
      'events',
      'groups',
      'home',
      'pictures',
      'posts',
      'statuses',
      'users',
      'videos',
      'writings',
    ]);
    const path = new URL(href, baseUrl).pathname;
    return path
      .split('/')
      .map((segment) => {
        if (!segment || preserved.has(segment)) return segment;
        if (/^\d+$/.test(segment)) return ':number';
        if (/^[a-z0-9]{8,}$/i.test(segment)) return ':opaque';
        return ':slug';
      })
      .join('/');
  } catch {
    return null;
  }
}

function capturedUrl(file) {
  const routes = new Map([
    ['view-source_https___fetlife.com.html', '/'],
    ['view-source_https___fetlife.com_TypicalBits.html', '/TypicalBits'],
    ['view-source_https___fetlife.com_events_near.html', '/events/near'],
    ['view-source_https___fetlife.com_explore_fresh-and-pervy.html', '/explore/fresh-and-pervy'],
    ['view-source_https___fetlife.com_fetishes.html', '/fetishes'],
    ['view-source_https___fetlife.com_groups_source=main_nav.html', '/groups?source=main_nav'],
    ['view-source_https___fetlife.com_home.html', '/home'],
    ['view-source_https___fetlife.com_kinktionary.html', '/kinktionary'],
    ['view-source_https___fetlife.com_p.html', '/p'],
    ['view-source_https___fetlife.com_requests.html', '/requests'],
    ['view-source_https___fetlife.com_writings.html', '/writings'],
  ]);
  return new URL(routes.get(file) ?? '/', 'https://fetlife.com/').href;
}

for (const path of process.argv.slice(2)) {
  const html = await readFile(path, 'utf8');
  const file = basename(path);
  const dom = new JSDOM(html, { url: capturedUrl(file) });
  const { document } = dom.window;
  const dataAttributes = new Map();
  const linkedStructures = new Map();
  const routeLinks = new Map();
  const articleHrefShapes = new Map();
  const articleIdentityAttributes = new Map();
  const clickableHrefShapes = new Map();
  const observedCandidates = new Map();
  let parseErrors = 0;

  for (const element of document.querySelectorAll('*')) {
    for (const { name } of element.attributes) {
      if (name.startsWith('data-')) increment(dataAttributes, name);
    }
  }

  for (const anchor of document.querySelectorAll('a[href]')) {
    const family = routeFamily(anchor.getAttribute('href'), document.URL);
    if (!family) continue;
    increment(routeLinks, family);
    let cursor = anchor;
    const chain = [];
    for (let depth = 0; cursor && depth < 4; depth += 1, cursor = cursor.parentElement) {
      chain.push(safeSignature(cursor));
    }
    increment(linkedStructures, `${family}:${chain.join('>')}`);
  }

  for (const article of document.querySelectorAll('article')) {
    for (const { name, value } of article.attributes) {
      if (name === 'id' || name.startsWith('data-story-')) {
        const shape = name === 'data-story-uid' ? value.split(':')[0] : name;
        increment(articleIdentityAttributes, `${name}:${shape}`);
      }
    }
    for (const anchor of article.querySelectorAll('a[href]')) {
      const shape = pathShape(anchor.getAttribute('href'), document.URL);
      if (shape) increment(articleHrefShapes, shape);
    }
  }

  for (const element of document.querySelectorAll('[data-clickable-url-value]')) {
    const shape = pathShape(element.getAttribute('data-clickable-url-value'), document.URL);
    if (shape) increment(clickableHrefShapes, shape);
  }

  const fetlife = new FetLifeService({ idFactory: () => 'redacted-transient' });
  const route = fetlife.detectRoute(document.URL);
  for (const element of document.querySelectorAll(CANDIDATE_ROOT_QUERY)) {
    try {
      const candidate = fetlife.createCandidate(element, route);
      if (!candidate) continue;
      increment(
        observedCandidates,
        [
          candidate.kind,
          candidate.confidence,
          candidate.parsed.identity?.strategy ?? 'none',
          candidate.safeFor.destructive ? 'destructive-ok' : 'preserve-native',
        ].join(':'),
      );
    } catch {
      parseErrors += 1;
    }
  }

  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
  const canonicalFamily = canonical ? routeFamily(canonical, document.URL) : null;
  const summary = {
    file,
    canonicalFamily,
    counts: {
      article: document.querySelectorAll('article').length,
      dataContentId: document.querySelectorAll('[data-content-id]').length,
      dataEventId: document.querySelectorAll('[data-event-id]').length,
      dataGroupId: document.querySelectorAll('[data-group-id]').length,
      dataUserId: document.querySelectorAll('[data-user-id]').length,
      main: document.querySelectorAll('main').length,
      roleFeed: document.querySelectorAll('[role="feed"]').length,
    },
    articleHrefShapes: sortedObject(articleHrefShapes),
    articleIdentityAttributes: sortedObject(articleIdentityAttributes),
    clickableHrefShapes: sortedObject(clickableHrefShapes),
    dataAttributes: sortedObject(dataAttributes),
    routeLinks: sortedObject(routeLinks),
    linkedStructures: sortedObject(linkedStructures, 12),
    observedCandidates: sortedObject(observedCandidates),
    parseErrors,
    routeKind: route.kind,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  dom.window.close();
}
