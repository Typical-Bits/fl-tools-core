import { compare, valid } from 'semver';
import { ContractError } from '../errors.js';

export const RELEASE_CHANNELS = Object.freeze(['stable', 'beta']);

export function parseUserscriptVersion(source) {
  return String(source ?? '').match(/^\/\/ @version\s+(\S+)/m)?.[1] ?? '';
}

export function compareScriptVersions(left, right) {
  if (valid(left) && valid(right)) return compare(left, right);
  const leftParts = String(left)
    .split(/[.-]/u)
    .map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = String(right)
    .split(/[.-]/u)
    .map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff) return diff;
  }
  return 0;
}

function normalizeRelease(productId, release) {
  if (
    !release ||
    !valid(release.version) ||
    !RELEASE_CHANNELS.includes(release.channel) ||
    !Array.isArray(release.summary) ||
    release.summary.length < 1 ||
    release.summary.length > 4
  ) {
    throw new ContractError('Update provider returned invalid release metadata', { productId });
  }
  return Object.freeze({
    channel: release.channel,
    productId,
    summary: Object.freeze(release.summary.map(String)),
    version: release.version,
  });
}

export class UpdateManager {
  #installed = new Map();
  #notifications;
  #providers = new Map();

  constructor({ notifications }) {
    if (!notifications?.upsert) throw new ContractError('Update manager requires notifications');
    this.#notifications = notifications;
  }

  registerProduct({ productId, name, version, channel, provider }) {
    if (
      !/^[a-z][a-z0-9-]*$/.test(productId ?? '') ||
      !name ||
      !valid(version) ||
      !RELEASE_CHANNELS.includes(channel) ||
      typeof provider?.getLatest !== 'function'
    ) {
      throw new ContractError('Product update registration is invalid');
    }
    if (this.#providers.has(productId))
      throw new ContractError('Update provider already registered');
    this.#providers.set(productId, { channel, name, provider, version });
    return () => this.#providers.delete(productId);
  }

  async check(productId, { signal } = {}) {
    const entry = this.#providers.get(productId);
    if (!entry) throw new ContractError('Unknown product update provider', { productId });
    const candidate = await entry.provider.getLatest({
      channel: entry.channel,
      currentVersion: entry.version,
      signal,
    });
    if (!candidate) return Object.freeze({ status: 'CURRENT' });
    const release = normalizeRelease(productId, candidate);
    if (release.channel !== entry.channel) {
      throw new ContractError('Update provider crossed the selected release channel');
    }
    if (compare(release.version, entry.version) <= 0) return Object.freeze({ status: 'CURRENT' });
    this.#notifications.upsert({
      actions: [
        {
          handler: () => entry.provider.update?.(release),
          label: 'Update',
        },
        {
          handler: () => this.#notifications.dismiss(`update.${productId}`),
          label: 'Later',
        },
      ],
      bullets: release.summary,
      id: `update.${productId}`,
      kind: 'UPDATE_AVAILABLE',
      message: `${entry.name} ${release.version} is available.`,
      priority: 'NORMAL',
      title: 'Update available',
    });
    return Object.freeze({ release, status: 'AVAILABLE' });
  }

  recordInstalled({ productId, name, version, channel, summary }) {
    const release = normalizeRelease(productId, { channel, summary, version });
    this.#installed.set(productId, release);
    this.#notifications.dismiss(`update.${productId}`);
    this.#notifications.upsert({
      actions: [
        {
          handler: () => this.#notifications.dismiss(`post-update.${productId}`),
          label: 'Got It',
        },
      ],
      bullets: release.summary,
      id: `post-update.${productId}`,
      kind: 'POST_UPDATE',
      message: `${name} was updated to ${version}.`,
      priority: 'LOW',
      title: "What's New",
    });
    return release;
  }

  whatsNew(productId) {
    return this.#installed.get(productId) ?? null;
  }
}
