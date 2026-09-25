import { ContractError } from '../errors.js';

export const DIAGNOSTIC_RESULTS = Object.freeze(['PASS', 'WARN', 'FAIL', 'NOT_APPLICABLE']);
export const DIAGNOSTIC_CATEGORIES = Object.freeze([
  'CORE_RUNTIME',
  'COMPATIBILITY',
  'PARSER',
  'STORAGE',
  'NETWORK',
  'FILESYSTEM',
  'FEATURE',
  'SECURITY',
  'PERFORMANCE',
  'UPDATE',
]);
export const DIAGNOSTIC_SEVERITIES = Object.freeze(['INFO', 'WARN', 'ERROR', 'FATAL']);

const SENSITIVE_KEY =
  /account|authorization|cookie|credential|favorite|filesystem|group|history|message|note|password|path|profile|secret|subject|token|url|vault/i;

function assertEnum(value, allowed, label) {
  if (!allowed.includes(value)) throw new ContractError(`Invalid diagnostic ${label}`, { value });
}

function redactString(value) {
  return String(value)
    .replace(
      /\b(authorization|cookie|password|token|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
      '$1=[REDACTED]',
    )
    .replace(/\bbearer\s+[a-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/[^\s)\]}]+/gi, '[REDACTED_URL]')
    .replace(/\b[a-z]:\\[^\r\n"']+/gi, '[REDACTED_PATH]')
    .replace(/\/(?:Users|home|var|private|mnt)\/[^\r\n"']+/g, '[REDACTED_PATH]');
}

function sanitize(value, seen = new WeakSet()) {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  )
    return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.slice(0, 25).map((item) => sanitize(item, seen));
    seen.delete(value);
    return result;
  }
  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 50)) {
    output[key] =
      SENSITIVE_KEY.test(key) && !(key === 'FILESYSTEM' && typeof item === 'number')
        ? '[REDACTED]'
        : sanitize(item, seen);
  }
  seen.delete(value);
  return output;
}

function freezeRecord(record) {
  return Object.freeze({ ...record, details: Object.freeze({ ...(record.details ?? {}) }) });
}

export class DiagnosticsService {
  #clock;
  #console = [];
  #captureStop;
  #captureStarted = null;
  #contextSnapshot;
  #healthSnapshot;
  #limit;
  #records = [];
  #selfTests = new Map();
  #version;

  constructor({
    version,
    limit = 100,
    clock = Date.now,
    contextSnapshot = () => ({}),
    healthSnapshot = () => null,
  }) {
    if (
      !version ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      typeof clock !== 'function' ||
      typeof contextSnapshot !== 'function'
    ) {
      throw new ContractError('Diagnostics dependencies are invalid');
    }
    this.#version = version;
    this.#limit = limit;
    this.#clock = clock;
    this.#contextSnapshot = contextSnapshot;
    this.#healthSnapshot = healthSnapshot;
  }

  record({ category, code, severity = 'ERROR', message, details = {}, productId = null, error }) {
    assertEnum(category, DIAGNOSTIC_CATEGORIES, 'category');
    assertEnum(severity, DIAGNOSTIC_SEVERITIES, 'severity');
    if (!/^[A-Z][A-Z0-9_]{2,79}$/.test(code ?? '') || typeof message !== 'string' || !message) {
      throw new ContractError('Diagnostic code and message are required');
    }
    const normalized = error instanceof Error ? error : null;
    const record = freezeRecord({
      category,
      code,
      details,
      error: normalized
        ? Object.freeze({
            message: normalized.message,
            name: normalized.name,
            stack: normalized.stack,
          })
        : null,
      message,
      productId,
      severity,
      timestamp: this.#clock(),
    });
    this.#records.push(record);
    if (this.#records.length > this.#limit) this.#records.shift();
    return record;
  }

  captureConsole(view) {
    if (!view?.addEventListener || this.#captureStop) return;
    this.#captureStarted = this.#clock();
    const write = (level, args) => {
      try {
        const text = args
          .slice(0, 6)
          .map((value) => {
            if (typeof value === 'string') return redactString(value).slice(0, 500);
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            if (
              value instanceof Error ||
              (typeof view.Error === 'function' && value instanceof view.Error)
            )
              return redactString(value.message).slice(0, 500);
            return '[object omitted]';
          })
          .join(' ');
        this.#console.push({ level, text, timestamp: this.#clock(), source: 'page-console' });
        if (this.#console.length > this.#limit) this.#console.shift();
      } catch {
        /* Diagnostics must never interrupt the original console. */
      }
    };
    const restores = [];
    for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
      const original = view.console?.[level];
      if (typeof original !== 'function') continue;
      const wrapper = (...args) => {
        write(level, args);
        return Reflect.apply(original, view.console, args);
      };
      try {
        view.console[level] = wrapper;
        restores.push(() => {
          if (view.console[level] === wrapper) view.console[level] = original;
        });
      } catch {
        /* Read-only console. */
      }
    }
    const error = (event) => write('error', [event.error ?? event.message ?? 'Script error']);
    const rejection = (event) => write('error', [event.reason ?? 'Unhandled rejection']);
    view.addEventListener('error', error);
    view.addEventListener('unhandledrejection', rejection);
    this.#captureStop = () => {
      for (const restore of restores) restore();
      view.removeEventListener('error', error);
      view.removeEventListener('unhandledrejection', rejection);
    };
  }

  stopCapture() {
    this.#captureStop?.();
    this.#captureStop = undefined;
  }

  clearActivity() {
    this.#records = [];
    this.#console = [];
  }

  resetSession() {
    this.clearActivity();
    this.#captureStarted = this.#clock();
  }

  registerSelfTest({ id, category, run }) {
    if (!/^[a-z][a-z0-9.-]+$/.test(id ?? '') || typeof run !== 'function') {
      throw new ContractError('Diagnostic self-test requires a stable id and runner');
    }
    assertEnum(category, DIAGNOSTIC_CATEGORIES, 'category');
    if (this.#selfTests.has(id)) throw new ContractError('Duplicate diagnostic self-test', { id });
    this.#selfTests.set(id, { category, run });
    return () => this.#selfTests.delete(id);
  }

  async runSelfTests() {
    const results = [];
    for (const [id, test] of this.#selfTests) {
      try {
        const output = (await test.run()) ?? {};
        const result = output.result ?? 'PASS';
        assertEnum(result, DIAGNOSTIC_RESULTS, 'result');
        results.push(
          Object.freeze({
            category: test.category,
            details: Object.freeze({ ...(output.details ?? {}) }),
            id,
            message: String(output.message ?? result),
            result,
          }),
        );
      } catch (error) {
        results.push(
          Object.freeze({
            category: test.category,
            details: Object.freeze({}),
            id,
            message: error instanceof Error ? error.message : String(error),
            result: 'FAIL',
          }),
        );
      }
    }
    return Object.freeze(results);
  }

  recent() {
    return Object.freeze([...this.#records]);
  }

  report({ detailed = false, shareable = true, selfTests = [] } = {}) {
    const counts = Object.fromEntries(DIAGNOSTIC_SEVERITIES.map((severity) => [severity, 0]));
    const categoryCounts = Object.fromEntries(
      DIAGNOSTIC_CATEGORIES.map((category) => [category, 0]),
    );
    for (const record of this.#records) counts[record.severity] += 1;
    for (const record of this.#records) categoryCounts[record.category] += 1;
    const context = this.#contextSnapshot() ?? {};
    const report = {
      categoryCounts,
      context,
      page: { ...(context.page ?? {}), route: context.route ?? {} },
      technical: {
        environment: context.environment ?? {},
        runtime: context.runtime ?? {},
        health: this.#healthSnapshot(),
      },
      console: {
        startedAt: this.#captureStarted,
        active: Boolean(this.#captureStop),
        limitation:
          'Only console calls and uncaught errors observed after Core starts; other extension consoles and earlier history are unavailable. Page logs are not attributed to a plugin.',
        records: detailed ? this.#console.slice(-25) : [],
        retained: this.#console.length,
      },
      plugins: context.pluginStatus ?? [],
      conflicts: context.conflicts ?? [],
      counts,
      generatedAt: this.#clock(),
      health: this.#healthSnapshot(),
      retainedRecords: this.#records.length,
      schemaVersion: 3,
      selfTests,
      version: this.#version,
    };
    if (detailed) {
      report.recent = this.#records.map(({ error, ...record }) => ({
        ...record,
        error: error ? { message: error.message, name: error.name } : null,
      }));
    }
    return Object.freeze(shareable ? sanitize(report) : report);
  }
}

export { sanitize as redactDiagnosticValue };
