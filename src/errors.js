export class CoreError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
    this.code = options.code ?? 'CORE_ERROR';
    this.details = options.details;
  }
}

export class ContractError extends CoreError {
  constructor(message, details) {
    super(message, { code: 'CONTRACT_ERROR', details });
  }
}

export class LifecycleError extends CoreError {
  constructor(message, details) {
    super(message, { code: 'LIFECYCLE_ERROR', details });
  }
}

export class SchedulerError extends CoreError {
  constructor(message, details) {
    super(message, { code: 'SCHEDULER_ERROR', details });
  }
}

export class CompatibilityError extends CoreError {
  constructor(message, details) {
    super(message, { code: 'COMPATIBILITY_ERROR', details });
  }
}

export class StorageError extends CoreError {
  constructor(message, { code = 'STORAGE_ERROR', details, cause } = {}) {
    super(message, { code, details, cause });
  }
}

export class StorageConflictError extends StorageError {
  constructor(message, details) {
    super(message, { code: 'STORAGE_CONFLICT', details });
  }
}
