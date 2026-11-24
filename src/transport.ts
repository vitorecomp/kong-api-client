import {
  KongConnectionError,
  KongError,
  KongHttpError,
  KongTimeoutError,
  type KongHttpErrorOptions,
} from './errors.js';

const DEFAULT_TIMEOUT_MS = 30_000;

/** Configuration options for connecting to the Kong Admin API. */
export interface KongOptions {
  /** Base URL of the Admin API, for example `http://localhost:8001`. A path prefix is kept. */
  adminUrl: string | URL;
  /** Headers sent with every request. A function is called once per request. */
  headers?:
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>);
  /** Per-request timeout in milliseconds. Default `30000`. `0` disables the timeout. */
  timeoutMs?: number;
  /** `fetch` implementation to use. Default: `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
}

/** HTTP methods supported by the Kong Admin API transport. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Low-level options for a single HTTP request through {@link Transport.request}. */
export interface RequestOptions {
  /** HTTP method. Default `'GET'`. */
  method?: HttpMethod;
  /** Request path starting with `'/'`, with path segments already encoded. */
  path: string;
  /** Query string parameters. Entries whose value is `undefined` are omitted. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Request body, serialized as JSON when provided. */
  body?: unknown;
  /** Per-request headers. These override client-level headers and defaults. */
  headers?: Record<string, string>;
  /** Optional `AbortSignal` to cancel this request. */
  signal?: AbortSignal;
}

/** Per-call options accepted by high-level resource and endpoint methods. */
export interface CallOptions {
  /** Optional `AbortSignal` to cancel this call. */
  signal?: AbortSignal;
}

/** Encodes one path segment. Throws {@link KongError} for an empty value. */
export function segment(value: string): string {
  if (value.length === 0) {
    throw new KongError('Path segment must not be empty');
  }
  return encodeURIComponent(value);
}

function normalizeAdminUrl(adminUrl: string | URL): string {
  let parsed: URL;
  if (adminUrl instanceof URL) {
    parsed = new URL(adminUrl.href);
  } else if (typeof adminUrl === 'string') {
    const trimmed = adminUrl.trim();
    if (trimmed.length === 0) {
      throw new KongError('adminUrl must not be empty');
    }
    try {
      parsed = new URL(trimmed);
    } catch (error) {
      throw new KongError('adminUrl must be a valid URL', { cause: error });
    }
  } else {
    throw new KongError('adminUrl is required');
  }

  parsed.search = '';
  parsed.hash = '';
  return parsed.href.replace(/\/+$/, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return mediaType === 'application/json' || mediaType.endsWith('+json');
}

function mergeHeaders(
  hasBody: boolean,
  clientHeaders?: Record<string, string>,
  requestHeaders?: Record<string, string>,
): Record<string, string> {
  const merged = new Map<string, [string, string]>();
  const setHeader = (name: string, value: string): void => {
    merged.set(name.toLowerCase(), [name, value]);
  };

  setHeader('Accept', 'application/json');
  if (hasBody) {
    setHeader('Content-Type', 'application/json');
  }
  if (clientHeaders) {
    for (const [name, value] of Object.entries(clientHeaders)) {
      setHeader(name, value);
    }
  }
  if (requestHeaders) {
    for (const [name, value] of Object.entries(requestHeaders)) {
      setHeader(name, value);
    }
  }

  const result: Record<string, string> = {};
  for (const [name, value] of merged.values()) {
    result[name] = value;
  }
  return result;
}

function buildUrl(
  baseUrl: string,
  normalizedPath: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  let url = `${baseUrl}${normalizedPath}`;
  if (!query) {
    return url;
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      search.append(key, String(value));
    }
  }
  const queryString = search.toString();
  if (queryString.length > 0) {
    url += `${url.includes('?') ? '&' : '?'}${queryString}`;
  }
  return url;
}

/** HTTP transport responsible for talking to the Kong Admin API. */
export class Transport {
  private readonly baseUrl: string;
  private readonly headers: KongOptions['headers'];
  private readonly timeoutMs: number;
  private readonly fetchImpl?: typeof globalThis.fetch;

  constructor(options: KongOptions) {
    if (!options) {
      throw new KongError('KongOptions is required');
    }
    this.baseUrl = normalizeAdminUrl(options.adminUrl);

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      throw new KongError('timeoutMs must be a non-negative finite number');
    }
    this.timeoutMs = timeoutMs;
    this.headers = options.headers;
    this.fetchImpl = options.fetch;
  }

  /** Sends a single HTTP request to the Kong Admin API and returns the parsed response. */
  async request<T = unknown>(options: RequestOptions): Promise<T> {
    if (options.signal?.aborted) {
      throw options.signal.reason;
    }

    const method: HttpMethod = options.method ?? 'GET';
    const normalizedPath = options.path.startsWith('/') ? options.path : `/${options.path}`;
    const queryIndex = normalizedPath.indexOf('?');
    const errorPath = queryIndex === -1 ? normalizedPath : normalizedPath.slice(0, queryIndex);

    const clientHeaders = typeof this.headers === 'function' ? await this.headers() : this.headers;

    if (options.signal?.aborted) {
      throw options.signal.reason;
    }

    const hasBody = options.body !== undefined;
    const headers = mergeHeaders(hasBody, clientHeaders, options.headers);
    const url = buildUrl(this.baseUrl, normalizedPath, options.query);

    const init: RequestInit = {
      method,
      headers,
    };
    if (hasBody) {
      init.body = JSON.stringify(options.body);
    }

    let controller: AbortController | undefined;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onCallerAbort = (): void => {
      controller?.abort(options.signal?.reason);
    };

    if (this.timeoutMs > 0 || options.signal) {
      controller = new AbortController();
      init.signal = controller.signal;

      if (options.signal) {
        options.signal.addEventListener('abort', onCallerAbort, { once: true });
      }
      if (this.timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          controller?.abort(new KongTimeoutError(this.timeoutMs, method, errorPath));
        }, this.timeoutMs);
      }
    }

    const fetchFn = this.fetchImpl ?? globalThis.fetch;

    try {
      const response = await fetchFn(url, init);
      return await this.handleResponse<T>(response, method, errorPath);
    } catch (error) {
      if (error instanceof KongError) {
        throw error;
      }
      if (timedOut) {
        throw new KongTimeoutError(this.timeoutMs, method, errorPath);
      }
      if (options.signal?.aborted) {
        throw options.signal.reason;
      }
      const causeMessage = error instanceof Error && error.message ? `: ${error.message}` : '';
      throw new KongConnectionError(`Connection failed (${method} ${errorPath})${causeMessage}`, {
        cause: error,
      });
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      if (options.signal) {
        options.signal.removeEventListener('abort', onCallerAbort);
      }
    }
  }

  private async handleResponse<T>(
    response: Response,
    method: HttpMethod,
    path: string,
  ): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (response.ok) {
      if (response.status === 204) {
        return undefined as T;
      }
      const text = await response.text();
      if (text.length === 0) {
        return undefined as T;
      }
      if (isJsonContentType(contentType)) {
        try {
          return JSON.parse(text) as T;
        } catch (error) {
          throw new KongError(`Invalid JSON response (${method} ${path})`, { cause: error });
        }
      }
      return text as T;
    }

    const text = await response.text();
    let parsedBody: unknown;
    if (text.length > 0) {
      if (isJsonContentType(contentType)) {
        try {
          parsedBody = JSON.parse(text);
        } catch {
          parsedBody = text;
        }
      } else {
        parsedBody = text;
      }
    }

    const errorOptions: KongHttpErrorOptions = {
      status: response.status,
      statusText: response.statusText,
      method,
      path,
      body: parsedBody,
    };

    if (isPlainObject(parsedBody)) {
      if (typeof parsedBody.message === 'string' && parsedBody.message.length > 0) {
        errorOptions.kongMessage = parsedBody.message;
      }
      if (typeof parsedBody.code === 'number') {
        errorOptions.code = parsedBody.code;
      }
      if (typeof parsedBody.name === 'string') {
        errorOptions.kongName = parsedBody.name;
      }
      if (isPlainObject(parsedBody.fields)) {
        errorOptions.fields = parsedBody.fields;
      }
    }

    throw new KongHttpError(errorOptions);
  }
}
