/** A single HTTP request captured by {@link FakeFetch}. */
export interface RecordedFetchRequest {
  /** Uppercase HTTP method (for example `'GET'`). */
  method: string;
  /** Full request URL string. */
  url: string;
  /** Request headers with lowercased keys. */
  headers: Record<string, string>;
  /** Raw request body string, when a body was sent. */
  body: string | undefined;
  /** Parsed JSON request body when `body` is valid JSON, otherwise `undefined`. */
  json: unknown;
  /** `AbortSignal` passed to `fetch`, if any. */
  signal: AbortSignal | undefined;
}

/** Optional metadata when queueing a JSON or text response on {@link FakeFetch}. */
export interface FakeResponseInit {
  /** Custom response headers merged on top of default headers. */
  headers?: Record<string, string>;
  /** Custom HTTP status text. */
  statusText?: string;
}

/** Dynamic handler invoked by {@link FakeFetch} when responding to a request. */
export type FakeFetchHandler = (
  request: RecordedFetchRequest,
  init?: RequestInit,
) => Response | Promise<Response>;

type QueueEntry =
  | { kind: 'response'; response: Response }
  | { kind: 'error'; error: unknown }
  | { kind: 'handler'; handler: FakeFetchHandler };

function extractUrl(input: string | URL | Request): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function extractHeaders(input: string | URL | Request, init?: RequestInit): Record<string, string> {
  const source = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  const headers = new Headers(source);
  const record: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    record[key] = value;
  }
  return record;
}

function extractBody(init?: RequestInit): { body: string | undefined; json: unknown } {
  if (init?.body === undefined || init.body === null) {
    return { body: undefined, json: undefined };
  }
  if (typeof init.body === 'string') {
    let json: unknown;
    try {
      json = JSON.parse(init.body);
    } catch {
      json = undefined;
    }
    return { body: init.body, json };
  }
  if (init.body instanceof URLSearchParams) {
    return { body: init.body.toString(), json: undefined };
  }
  if (init.body instanceof Uint8Array) {
    return { body: new TextDecoder().decode(init.body), json: undefined };
  }
  return { body: undefined, json: undefined };
}

/**
 * Stand-in `fetch` implementation for unit and contract tests.
 * Returns queued responses in FIFO order and records every incoming request.
 */
export class FakeFetch {
  /** All requests received by this fake fetch, in call order. */
  readonly requests: RecordedFetchRequest[] = [];
  private readonly queue: QueueEntry[] = [];

  /** `fetch`-compatible function bound to this instance. */
  readonly fetch: typeof globalThis.fetch = async (input, init) => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const url = extractUrl(input);
    const headers = extractHeaders(input, init);
    const { body, json } = extractBody(init);
    const signal = init?.signal ?? undefined;

    const recorded: RecordedFetchRequest = {
      method,
      url,
      headers,
      body,
      json,
      signal,
    };
    this.requests.push(recorded);

    const entry = this.queue.shift();
    if (!entry) {
      throw new Error(`FakeFetch: unexpected request ${method} ${url} (response queue is empty)`);
    }

    if (entry.kind === 'error') {
      throw entry.error;
    }
    if (entry.kind === 'handler') {
      return await entry.handler(recorded, init);
    }
    return entry.response;
  };

  /** Enqueues a JSON response (`Content-Type: application/json; charset=utf-8`). */
  json(body: unknown, status = 200, init?: FakeResponseInit): this {
    const headers = new Headers({ 'content-type': 'application/json; charset=utf-8' });
    if (init?.headers) {
      for (const [key, value] of Object.entries(init.headers)) {
        headers.set(key, value);
      }
    }
    const response = new Response(JSON.stringify(body), {
      status,
      statusText: init?.statusText,
      headers,
    });
    this.queue.push({ kind: 'response', response });
    return this;
  }

  /** Enqueues a plain text response (`Content-Type: text/plain; charset=utf-8`). */
  text(body: string, status = 200, init?: FakeResponseInit): this {
    const headers = new Headers({ 'content-type': 'text/plain; charset=utf-8' });
    if (init?.headers) {
      for (const [key, value] of Object.entries(init.headers)) {
        headers.set(key, value);
      }
    }
    const response = new Response(body, {
      status,
      statusText: init?.statusText,
      headers,
    });
    this.queue.push({ kind: 'response', response });
    return this;
  }

  /** Enqueues an empty response (defaults to `204 No Content`). */
  empty(status = 204, init?: FakeResponseInit): this {
    const headers = new Headers(init?.headers);
    const response = new Response(null, {
      status,
      statusText: init?.statusText,
      headers,
    });
    this.queue.push({ kind: 'response', response });
    return this;
  }

  /** Enqueues a raw `Response` object. */
  response(response: Response): this {
    this.queue.push({ kind: 'response', response });
    return this;
  }

  /** Enqueues an error to be rejected when the next request is made. */
  error(error: unknown): this {
    this.queue.push({ kind: 'error', error });
    return this;
  }

  /** Enqueues a dynamic handler for the next request. */
  handler(handler: FakeFetchHandler): this {
    this.queue.push({ kind: 'handler', handler });
    return this;
  }

  /** Returns the most recently recorded request, if any. */
  lastRequest(): RecordedFetchRequest | undefined {
    return this.requests[this.requests.length - 1];
  }

  /** Clears recorded requests and any remaining queued responses. */
  reset(): void {
    this.requests.length = 0;
    this.queue.length = 0;
  }
}

/** Creates a new {@link FakeFetch} instance. */
export function createFakeFetch(): FakeFetch {
  return new FakeFetch();
}
