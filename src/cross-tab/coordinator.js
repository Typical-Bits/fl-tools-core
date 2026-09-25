import { ContractError } from '../errors.js';

const PROTOCOL = 'fl-tools/core-cross-tab/1';
const MAX_PAYLOAD_NODES = 200;
const MAX_PAYLOAD_CHARACTERS = 16_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSmallSafePayload(root) {
  let characters = 0;
  let nodes = 0;
  const stack = [{ depth: 0, value: root }];
  while (stack.length) {
    const { depth, value } = stack.pop();
    nodes += 1;
    if (nodes > MAX_PAYLOAD_NODES || depth > 8) return false;
    if (value === null || value === undefined || typeof value === 'boolean') continue;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return false;
      continue;
    }
    if (typeof value === 'string') {
      characters += value.length;
      if (characters > MAX_PAYLOAD_CHARACTERS) return false;
      continue;
    }
    if (typeof value !== 'object') return false;
    const keys = Object.keys(value);
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key) || key.length > 80) return false;
      characters += key.length;
      stack.push({ depth: depth + 1, value: value[key] });
    }
  }
  return characters <= MAX_PAYLOAD_CHARACTERS;
}

function defaultId() {
  return crypto.randomUUID();
}

/** Account-safe BroadcastChannel envelope and deduplication foundation. */
export class CrossTabCoordinator {
  #channel;
  #channelFactory;
  #eventBus;
  #getAccountId;
  #idFactory;
  #maxSeen;
  #seen = new Set();
  #seenOrder = [];
  #sourceId;
  #started = false;

  constructor({
    eventBus,
    getAccountId,
    channelFactory = (name) => new BroadcastChannel(name),
    idFactory = defaultId,
    maxSeen = 1000,
  }) {
    if (!eventBus || typeof getAccountId !== 'function' || typeof channelFactory !== 'function') {
      throw new ContractError('Cross-tab coordinator dependencies are required');
    }
    this.#eventBus = eventBus;
    this.#getAccountId = getAccountId;
    this.#channelFactory = channelFactory;
    this.#idFactory = idFactory;
    this.#maxSeen = maxSeen;
    this.#sourceId = idFactory();
  }

  start() {
    if (this.#started) return;
    this.#channel = this.#channelFactory('fl-tools-core');
    this.#channel.addEventListener('message', this.#onMessage);
    this.#started = true;
  }

  publish(type, payload, { scope = 'account' } = {}) {
    if (!this.#started) throw new ContractError('Cross-tab coordinator is not started');
    if (typeof type !== 'string' || type.length === 0)
      throw new ContractError('Message type is required');
    if (!['account', 'core'].includes(scope)) throw new ContractError('Invalid message scope');
    if (!isSmallSafePayload(payload)) {
      throw new ContractError('Cross-tab payload must be small and structurally safe');
    }
    const accountId = scope === 'account' ? this.#getAccountId() : null;
    if (scope === 'account' && !accountId) {
      throw new ContractError('Account-scoped message requires an unambiguous account');
    }
    const envelope = Object.freeze({
      accountId,
      messageId: this.#idFactory(),
      payload,
      protocol: PROTOCOL,
      scope,
      sourceId: this.#sourceId,
      type,
    });
    this.#remember(envelope.messageId);
    this.#channel.postMessage(envelope);
    return envelope.messageId;
  }

  stop() {
    if (!this.#started) return;
    this.#channel.removeEventListener('message', this.#onMessage);
    this.#channel.close();
    this.#channel = undefined;
    this.#started = false;
    this.#seen.clear();
    this.#seenOrder = [];
  }

  #onMessage = ({ data }) => {
    if (!this.#isValid(data) || data.sourceId === this.#sourceId || this.#seen.has(data.messageId))
      return;
    if (data.scope === 'account') {
      const currentAccountId = this.#getAccountId();
      if (!currentAccountId || data.accountId !== currentAccountId) return;
    }
    this.#remember(data.messageId);
    this.#eventBus.emit(`cross-tab:${data.type}`, data);
  };

  #isValid(data) {
    return (
      data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      Object.keys(data).length === 7 &&
      data.protocol === PROTOCOL &&
      typeof data.messageId === 'string' &&
      data.messageId.length > 0 &&
      data.messageId.length <= 200 &&
      typeof data.sourceId === 'string' &&
      data.sourceId.length > 0 &&
      data.sourceId.length <= 200 &&
      typeof data.type === 'string' &&
      data.type.length > 0 &&
      data.type.length <= 80 &&
      ['account', 'core'].includes(data.scope) &&
      (data.scope === 'account'
        ? typeof data.accountId === 'string' &&
          data.accountId.length > 0 &&
          data.accountId.length <= 200
        : data.accountId === null) &&
      isSmallSafePayload(data.payload)
    );
  }

  #remember(messageId) {
    this.#seen.add(messageId);
    this.#seenOrder.push(messageId);
    while (this.#seenOrder.length > this.#maxSeen) {
      this.#seen.delete(this.#seenOrder.shift());
    }
  }
}

export { PROTOCOL as CROSS_TAB_PROTOCOL };
