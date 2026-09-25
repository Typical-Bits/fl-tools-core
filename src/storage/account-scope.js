import { ContractError, StorageError } from '../errors.js';
import { CURRENT_ACCOUNT_ATTRIBUTE, SELECTORS } from '../fetlife/selectors.js';

export function deriveAccountIdentity(document) {
  if (!document?.querySelectorAll) return null;
  const ids = new Set(
    [...document.querySelectorAll(SELECTORS.currentAccount.join(','))]
      .map((node) => node.getAttribute(CURRENT_ACCOUNT_ATTRIBUTE)?.trim())
      .filter((value) => /^\d+$/.test(value)),
  );
  if (ids.size !== 1) return null;
  return [...ids][0];
}

export class AccountScope {
  #accountId = null;
  #controller = new AbortController();
  #generation = 0;
  #onChange;

  constructor({ accountId = null, onChange } = {}) {
    this.#onChange = onChange;
    if (accountId !== null) this.#validate(accountId);
    this.#accountId = accountId;
  }

  get accountId() {
    return this.#accountId;
  }

  get signal() {
    return this.#controller.signal;
  }

  capture() {
    if (!this.#accountId) {
      throw new StorageError('Account-scoped persistence requires a reliable account identity', {
        code: 'STORAGE_ACCOUNT_AMBIGUOUS',
      });
    }
    return Object.freeze({ accountId: this.#accountId, generation: this.#generation });
  }

  assertCurrent(token) {
    if (
      !token ||
      token.accountId !== this.#accountId ||
      token.generation !== this.#generation ||
      this.#controller.signal.aborted
    ) {
      throw new StorageError('Account changed before persistent work completed', {
        code: 'STORAGE_ACCOUNT_STALE',
      });
    }
  }

  refresh(document) {
    return this.set(deriveAccountIdentity(document));
  }

  set(accountId) {
    if (accountId !== null) this.#validate(accountId);
    if (accountId === this.#accountId) return false;
    const previousAccountId = this.#accountId;
    this.#controller.abort(new globalThis.DOMException('Account scope changed', 'AbortError'));
    this.#controller = new AbortController();
    this.#generation += 1;
    this.#accountId = accountId;
    this.#onChange?.({ accountId, previousAccountId, generation: this.#generation });
    return true;
  }

  #validate(accountId) {
    if (typeof accountId !== 'string' || accountId.length === 0) {
      throw new ContractError('Account id must be a non-empty string or null');
    }
  }
}
