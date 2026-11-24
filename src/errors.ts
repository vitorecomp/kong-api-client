import type { ApplyChange, ApplyConfig, ApplyResult } from './apply/apply.js';
import type { HttpMethod } from './transport.js';

/** Base error class for all errors thrown by `kong-api-client`. */
export class KongError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'KongError';
  }
}

/** Options used to construct a {@link KongHttpError}. */
export interface KongHttpErrorOptions {
  /** HTTP status code returned by Kong. */
  status: number;
  /** HTTP status text returned by the server, used when Kong's body has no message. */
  statusText?: string;
  /** HTTP method of the failed request. */
  method: HttpMethod;
  /** Request path without host and without query string. */
  path: string;
  /** Error message extracted from Kong's JSON error body, if present. */
  kongMessage?: string;
  /** Kong's numeric error code, if present. */
  code?: number;
  /** Kong's error name (for example `"schema violation"`), if present. */
  kongName?: string;
  /** Field-level validation errors returned by Kong, if present. */
  fields?: Record<string, unknown>;
  /** Parsed response body, if present. */
  body?: unknown;
}

/** Error thrown when Kong responds with a non-2xx HTTP status code. */
export class KongHttpError extends KongError {
  /** HTTP status code. */
  readonly status: number;
  /** HTTP method of the failed request. */
  readonly method: HttpMethod;
  /** Request path without host and without query string. */
  readonly path: string;
  /** Kong's numeric error code, when provided in the response body. */
  readonly code?: number;
  /** Kong's error name (for example `"schema violation"`), when provided in the response body. */
  readonly kongName?: string;
  /** Per-field validation details, when provided in the response body. */
  readonly fields?: Record<string, unknown>;
  /** Parsed response body (JSON value or raw text), when non-empty. */
  readonly body?: unknown;

  constructor(options: KongHttpErrorOptions) {
    const detail = options.kongMessage || options.statusText;
    const message = detail
      ? `${options.status} ${detail} (${options.method} ${options.path})`
      : `${options.status} (${options.method} ${options.path})`;
    super(message);
    this.name = 'KongHttpError';
    this.status = options.status;
    this.method = options.method;
    this.path = options.path;
    if (options.code !== undefined) {
      this.code = options.code;
    }
    if (options.kongName !== undefined) {
      this.kongName = options.kongName;
    }
    if (options.fields !== undefined) {
      this.fields = options.fields;
    }
    if (options.body !== undefined) {
      this.body = options.body;
    }
  }
}

/** Error thrown when a request fails before receiving an HTTP response (for example a network or DNS error). */
export class KongConnectionError extends KongError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'KongConnectionError';
  }
}

/** Error thrown when a request exceeds the configured timeout. */
export class KongTimeoutError extends KongError {
  /** Timeout duration in milliseconds that was exceeded. */
  readonly timeoutMs: number;

  constructor(timeoutMs: number, method?: HttpMethod, path?: string, options?: ErrorOptions) {
    const target = method && path ? ` (${method} ${path})` : '';
    super(`Request timed out after ${timeoutMs}ms${target}`, options);
    this.name = 'KongTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** Error thrown when a step of {@link Kong.apply} fails. Nothing is rolled back. */
export class KongApplyError extends KongError {
  /** Details of the step that failed. */
  readonly failed: {
    /** Resource collection being applied. */
    type: keyof ApplyConfig;
    /** Entity key (`<upstream>/<target>` for targets). */
    key: string;
    /** Action attempted when the error occurred. */
    action: ApplyChange['action'];
  };
  /** Changes completed before the failure. */
  readonly result: ApplyResult;

  constructor(
    failed: { type: keyof ApplyConfig; key: string; action: ApplyChange['action'] },
    result: ApplyResult,
    cause: unknown,
  ) {
    const detail = cause instanceof Error && cause.message ? `: ${cause.message}` : '';
    super(`Failed to ${failed.action} ${failed.type} "${failed.key}"${detail}`, { cause });
    this.name = 'KongApplyError';
    this.failed = failed;
    this.result = result;
  }
}
