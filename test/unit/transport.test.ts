import { inspect } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KongConnectionError,
  KongError,
  KongHttpError,
  KongTimeoutError,
  Transport,
  segment,
  type KongOptions,
} from '../../src/index.js';
import { createFakeFetch } from '../support/fake-fetch.js';

async function captureError<T extends Error>(
  promise: Promise<unknown>,
  ErrorClass: new (...args: never[]) => T,
): Promise<T> {
  let captured: unknown;
  await expect(
    promise.catch((error: unknown) => {
      captured = error;
      throw error;
    }),
  ).rejects.toBeInstanceOf(ErrorClass);
  return captured as T;
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  const notRejected = Symbol('not-rejected');
  const outcome = await promise.then(
    () => notRejected,
    (reason: unknown) => reason,
  );
  expect(outcome).not.toBe(notRejected);
  return outcome;
}

function assertNoSecretInError(error: unknown, secrets: string[]): void {
  const err = error as Error;
  const serialized = JSON.stringify(error);
  const allOwnProps = JSON.stringify(error, Object.getOwnPropertyNames(error));
  const inspected = inspect(error, { depth: null, showHidden: true });

  for (const secret of secrets) {
    expect(err.message).not.toContain(secret);
    expect(err.stack ?? '').not.toContain(secret);
    expect(serialized).not.toContain(secret);
    expect(allOwnProps).not.toContain(secret);
    expect(inspected).not.toContain(secret);
  }
}

describe('segment', () => {
  it('encodes reserved path characters', () => {
    expect(segment('a b/c')).toBe('a%20b%2Fc');
    expect(segment('a?b#c%d')).toBe('a%3Fb%23c%25d');
    expect(segment('my-service_1.0')).toBe('my-service_1.0');
  });

  it('throws KongError for an empty value', () => {
    expect(() => segment('')).toThrow(KongError);
  });
});

describe('Transport constructor', () => {
  it('throws KongError when adminUrl is missing, empty, or invalid', () => {
    expect(() => new Transport(undefined as unknown as KongOptions)).toThrow(KongError);
    expect(() => new Transport({ adminUrl: '' })).toThrow(KongError);
    expect(() => new Transport({ adminUrl: '   ' })).toThrow(KongError);
    expect(() => new Transport({ adminUrl: 'not-a-valid-url' })).toThrow(KongError);
    expect(() => new Transport({ adminUrl: undefined as unknown as string })).toThrow(KongError);
  });

  it('throws KongError when timeoutMs is negative or non-finite', () => {
    expect(() => new Transport({ adminUrl: 'http://localhost:8001', timeoutMs: -1 })).toThrow(
      KongError,
    );
    expect(
      () => new Transport({ adminUrl: 'http://localhost:8001', timeoutMs: Number.NaN }),
    ).toThrow(KongError);
    expect(
      () =>
        new Transport({ adminUrl: 'http://localhost:8001', timeoutMs: Number.POSITIVE_INFINITY }),
    ).toThrow(KongError);
  });
});

describe('Transport URLs and query parameters', () => {
  it('strips trailing slashes on adminUrl and keeps path prefixes', async () => {
    const fake = createFakeFetch().json({ ok: 1 }).json({ ok: 2 }).json({ ok: 3 }).json({ ok: 4 });

    const t1 = new Transport({ adminUrl: 'http://localhost:8001/', fetch: fake.fetch });
    await t1.request({ path: '/services' });

    const t2 = new Transport({ adminUrl: 'http://localhost:8001/admin/v1/', fetch: fake.fetch });
    await t2.request({ path: '/services' });

    const t3 = new Transport({
      adminUrl: new URL('https://kong.example.com:8444/gateway/admin///?ignored=1#frag'),
      fetch: fake.fetch,
    });
    await t3.request({ path: '/routes/a%20b%2Fc' });

    const t4 = new Transport({ adminUrl: 'http://localhost:8001/prefix', fetch: fake.fetch });
    await t4.request({ path: 'status' });

    expect(fake.requests.map((r) => r.url)).toEqual([
      'http://localhost:8001/services',
      'http://localhost:8001/admin/v1/services',
      'https://kong.example.com:8444/gateway/admin/routes/a%20b%2Fc',
      'http://localhost:8001/prefix/status',
    ]);
  });

  it('encodes query values and drops undefined entries', async () => {
    const fake = createFakeFetch().json({}).json({}).json({});
    const transport = new Transport({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    await transport.request({
      path: '/services',
      query: {
        size: 50,
        tags: 'managed-by:kong,env/prod',
        filter: 'hello world&x=1',
        flag: true,
        offset: undefined,
      },
    });
    await transport.request({
      path: '/services',
      query: { offset: undefined, tags: undefined },
    });
    await transport.request({
      path: '/services?existing=1',
      query: { size: 10 },
    });

    const firstUrl = new URL(fake.requests[0]!.url);
    expect(firstUrl.pathname).toBe('/services');
    expect(firstUrl.searchParams.get('size')).toBe('50');
    expect(firstUrl.searchParams.get('tags')).toBe('managed-by:kong,env/prod');
    expect(firstUrl.searchParams.get('filter')).toBe('hello world&x=1');
    expect(firstUrl.searchParams.get('flag')).toBe('true');
    expect(firstUrl.searchParams.has('offset')).toBe(false);
    expect(fake.requests[0]!.url).not.toContain('offset');
    expect(fake.requests[0]!.url).toContain('tags=managed-by%3Akong%2Cenv%2Fprod');

    expect(fake.requests[1]!.url).toBe('http://localhost:8001/services');
    expect(fake.requests[2]!.url).toBe('http://localhost:8001/services?existing=1&size=10');
  });
});

describe('Transport headers', () => {
  it('sends default Accept header and omits Content-Type when there is no body', async () => {
    const fake = createFakeFetch().json({ ok: true }).json({ id: '1' });
    const transport = new Transport({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    await transport.request({ path: '/services' });
    await transport.request({ method: 'POST', path: '/services', body: { name: 'billing' } });

    expect(fake.requests[0]!.method).toBe('GET');
    expect(fake.requests[0]!.headers).toEqual({ accept: 'application/json' });
    expect(fake.requests[0]!.headers['content-type']).toBeUndefined();
    expect(fake.requests[0]!.body).toBeUndefined();

    expect(fake.requests[1]!.method).toBe('POST');
    expect(fake.requests[1]!.headers).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
    });
    expect(fake.requests[1]!.json).toEqual({ name: 'billing' });
  });

  it('sends Content-Type for falsy non-undefined JSON bodies', async () => {
    const fake = createFakeFetch().json({ ok: true });
    const transport = new Transport({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    await transport.request({ method: 'PUT', path: '/flag', body: false });

    expect(fake.requests[0]!.headers['content-type']).toBe('application/json');
    expect(fake.requests[0]!.body).toBe('false');
  });

  it('merges static client headers and lets per-request headers win case-insensitively', async () => {
    const fake = createFakeFetch().json({ ok: true });
    const transport = new Transport({
      adminUrl: 'http://localhost:8001',
      headers: {
        'Kong-Admin-Token': 'client-token',
        'X-Trace': 'from-client',
        accept: 'application/vnd.kong+json',
      },
      fetch: fake.fetch,
    });

    await transport.request({
      method: 'POST',
      path: '/services',
      body: { name: 'svc' },
      headers: {
        'kong-admin-token': 'request-token',
        'content-type': 'application/merge-patch+json',
        'X-Extra': '1',
      },
    });

    expect(fake.requests[0]!.headers).toEqual({
      accept: 'application/vnd.kong+json',
      'content-type': 'application/merge-patch+json',
      'kong-admin-token': 'request-token',
      'x-trace': 'from-client',
      'x-extra': '1',
    });
  });

  it('calls a sync client headers function once per request', async () => {
    const fake = createFakeFetch().json({ n: 1 }).json({ n: 2 });
    let calls = 0;
    const transport = new Transport({
      adminUrl: 'http://localhost:8001',
      headers: () => {
        calls += 1;
        return { 'X-Call': String(calls) };
      },
      fetch: fake.fetch,
    });

    await transport.request({ path: '/one' });
    await transport.request({ path: '/two' });

    expect(calls).toBe(2);
    expect(fake.requests[0]!.headers['x-call']).toBe('1');
    expect(fake.requests[1]!.headers['x-call']).toBe('2');
  });

  it('calls an async client headers function once per request and lets per-request headers win', async () => {
    const fake = createFakeFetch().json({ n: 1 }).json({ n: 2 });
    let calls = 0;
    const transport = new Transport({
      adminUrl: 'http://localhost:8001',
      headers: async () => {
        calls += 1;
        await Promise.resolve();
        return { Authorization: `Bearer token-${calls}`, 'X-From': 'async' };
      },
      fetch: fake.fetch,
    });

    await transport.request({ path: '/one' });
    await transport.request({
      path: '/two',
      headers: { Authorization: 'Bearer override' },
    });

    expect(calls).toBe(2);
    expect(fake.requests[0]!.headers['authorization']).toBe('Bearer token-1');
    expect(fake.requests[0]!.headers['x-from']).toBe('async');
    expect(fake.requests[1]!.headers['authorization']).toBe('Bearer override');
    expect(fake.requests[1]!.headers['x-from']).toBe('async');
  });
});

describe('Transport responses', () => {
  it('parses JSON and +json content types', async () => {
    const fake = createFakeFetch()
      .json({ version: '3.9.5' })
      .response(
        new Response(JSON.stringify({ detail: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/vnd.api+json; charset=utf-8' },
        }),
      );
    const transport = new Transport({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    const r1 = await transport.request<{ version: string }>({ path: '/' });
    const r2 = await transport.request<{ detail: string }>({ path: '/custom' });

    expect(r1).toEqual({ version: '3.9.5' });
    expect(r2).toEqual({ detail: 'ok' });
  });

  it('resolves 204 and empty 200 responses to undefined', async () => {
    const fake = createFakeFetch()
      .empty(204)
      .response(new Response('', { status: 200, headers: { 'content-type': 'application/json' } }));
    const transport = new Transport({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    const r1 = await transport.request({ method: 'DELETE', path: '/services/s1' });
    const r2 = await transport.request({ path: '/empty' });

    expect(r1).toBeUndefined();
    expect(r2).toBeUndefined();
  });

  it('returns plain text for non-JSON responses', async () => {
    const metrics =
      '# HELP kong_http_requests_total Total HTTP requests\nkong_http_requests_total 42\n';
    const noContentType = new Response(new TextEncoder().encode('raw-body-no-ct'), { status: 200 });
    const fake = createFakeFetch().text(metrics).response(noContentType);
    const transport = new Transport({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    const r1 = await transport.request<string>({ path: '/metrics' });
    const r2 = await transport.request<string>({ path: '/raw' });

    expect(noContentType.headers.get('content-type')).toBeNull();
    expect(r1).toBe(metrics);
    expect(r2).toBe('raw-body-no-ct');
  });

  it('throws KongError (not KongConnectionError) when a 2xx JSON response is malformed', async () => {
    const fake = createFakeFetch().response(
      new Response('{not-json', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const transport = new Transport({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    const error = await captureError(transport.request({ path: '/broken' }), KongError);
    expect(error).not.toBeInstanceOf(KongConnectionError);
    expect(error.cause).toBeInstanceOf(SyntaxError);
  });
});

describe('Transport errors, timeouts, aborts, and secret redaction', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('populates every field of KongHttpError from Kong JSON error body', async () => {
    const kongErrorBody = {
      message: 'schema violation (host: required field missing)',
      name: 'schema violation',
      code: 2,
      fields: { host: 'required field missing' },
    };
    const fake = createFakeFetch().json(kongErrorBody, 400, { statusText: 'Bad Request' });
    const transport = new Transport({
      adminUrl: 'http://localhost:8001/admin-prefix',
      fetch: fake.fetch,
    });

    const error = await captureError(
      transport.request({
        method: 'POST',
        path: '/services',
        query: { debug: true },
        body: { name: 'no-host' },
      }),
      KongHttpError,
    );

    expect(error.name).toBe('KongHttpError');
    expect(error.status).toBe(400);
    expect(error.method).toBe('POST');
    expect(error.path).toBe('/services');
    expect(error.code).toBe(2);
    expect(error.kongName).toBe('schema violation');
    expect(error.fields).toEqual({ host: 'required field missing' });
    expect(error.body).toEqual(kongErrorBody);
    expect(error.message).toBe(
      '400 schema violation (host: required field missing) (POST /services)',
    );
  });

  it('handles non-JSON, malformed JSON, empty, and non-object JSON error responses', async () => {
    const fake = createFakeFetch()
      .text('Bad Gateway from upstream proxy', 502, { statusText: 'Bad Gateway' })
      .response(
        new Response('{corrupt', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'content-type': 'application/json' },
        }),
      )
      .empty(503, { statusText: 'Service Unavailable' })
      .json(['unexpected', 'array'], 422, { statusText: 'Unprocessable Entity' });

    const transport = new Transport({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    const e1 = await captureError(transport.request({ path: '/services?a=1' }), KongHttpError);
    expect(e1.status).toBe(502);
    expect(e1.path).toBe('/services');
    expect(e1.body).toBe('Bad Gateway from upstream proxy');
    expect(e1.code).toBeUndefined();
    expect(e1.kongName).toBeUndefined();
    expect(e1.fields).toBeUndefined();
    expect(e1.message).toBe('502 Bad Gateway (GET /services)');

    const e2 = await captureError(transport.request({ path: '/corrupt' }), KongHttpError);
    expect(e2.status).toBe(500);
    expect(e2.body).toBe('{corrupt');
    expect(e2.message).toBe('500 Internal Server Error (GET /corrupt)');

    const e3 = await captureError(transport.request({ path: '/empty-err' }), KongHttpError);
    expect(e3.status).toBe(503);
    expect(e3.body).toBeUndefined();
    expect(e3.message).toBe('503 Service Unavailable (GET /empty-err)');

    const e4 = await captureError(transport.request({ path: '/array-err' }), KongHttpError);
    expect(e4.status).toBe(422);
    expect(e4.body).toEqual(['unexpected', 'array']);
    expect(e4.message).toBe('422 Unprocessable Entity (GET /array-err)');
  });

  it('never leaks request headers or request body in KongHttpError, KongConnectionError, or KongTimeoutError', async () => {
    const headerSecret = 'super-secret-admin-token-9f8e7d6c';
    const bodySecret = 'super-secret-api-password-1a2b3c4d';

    const fake = createFakeFetch()
      .json({ message: 'Unauthorized', name: 'unauthorized', code: 1 }, 401, {
        statusText: 'Unauthorized',
      })
      .error(new TypeError('fetch failed'))
      .handler((req) => {
        return new Promise<Response>((_resolve, reject) => {
          req.signal?.addEventListener('abort', () => {
            const reason: unknown = req.signal?.reason;
            reject(reason instanceof Error ? reason : new DOMException('Aborted', 'AbortError'));
          });
        });
      });

    const transport = new Transport({
      adminUrl: 'http://localhost:8001',
      headers: { Authorization: `Bearer ${headerSecret}` },
      timeoutMs: 25,
      fetch: fake.fetch,
    });

    const httpError = await captureError(
      transport.request({
        method: 'POST',
        path: '/plugins',
        headers: { 'X-Extra-Secret': headerSecret },
        body: { config: { api_key: bodySecret } },
      }),
      KongHttpError,
    );
    assertNoSecretInError(httpError, [headerSecret, bodySecret]);

    const connError = await captureError(
      transport.request({
        method: 'POST',
        path: '/plugins',
        headers: { 'X-Extra-Secret': headerSecret },
        body: { config: { api_key: bodySecret } },
      }),
      KongConnectionError,
    );
    assertNoSecretInError(connError, [headerSecret, bodySecret]);

    const timeoutError = await captureError(
      transport.request({
        method: 'POST',
        path: '/plugins',
        headers: { 'X-Extra-Secret': headerSecret },
        body: { config: { api_key: bodySecret } },
      }),
      KongTimeoutError,
    );
    assertNoSecretInError(timeoutError, [headerSecret, bodySecret]);
  });

  it('throws KongConnectionError preserving the original cause on network errors', async () => {
    const rootCause = new TypeError('fetch failed');
    const fake = createFakeFetch().error(rootCause).error('non-error-failure');
    const transport = new Transport({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    const e1 = await captureError(transport.request({ path: '/services' }), KongConnectionError);
    expect(e1.name).toBe('KongConnectionError');
    expect(e1.cause).toBe(rootCause);
    expect(e1.message).toContain('GET /services');
    expect(e1.message).toContain('fetch failed');

    const e2 = await captureError(transport.request({ path: '/services' }), KongConnectionError);
    expect(e2.cause).toBe('non-error-failure');
  });

  it('throws KongTimeoutError when timeoutMs is exceeded and supports timeoutMs: 0', async () => {
    const fake = createFakeFetch()
      .handler((req) => {
        return new Promise<Response>((_resolve, reject) => {
          req.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      })
      .handler(async (req) => {
        expect(req.signal).toBeUndefined();
        await new Promise((resolve) => setTimeout(resolve, 20));
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      });

    const timedTransport = new Transport({
      adminUrl: 'http://localhost:8001',
      timeoutMs: 25,
      fetch: fake.fetch,
    });
    const timeoutErr = await captureError(
      timedTransport.request({ path: '/slow' }),
      KongTimeoutError,
    );
    expect(timeoutErr.timeoutMs).toBe(25);
    expect(timeoutErr.message).toBe('Request timed out after 25ms (GET /slow)');

    const noTimeoutTransport = new Transport({
      adminUrl: 'http://localhost:8001',
      timeoutMs: 0,
      fetch: fake.fetch,
    });
    await expect(noTimeoutTransport.request({ path: '/ok' })).resolves.toEqual({ ok: true });
  });

  it('rethrows caller AbortSignal reason unchanged before, during headers, and in-flight', async () => {
    const headersFn = vi.fn(() => ({ 'X-Test': '1' }));
    const fake = createFakeFetch();
    const transport = new Transport({
      adminUrl: 'http://localhost:8001',
      headers: headersFn,
      timeoutMs: 5000,
      fetch: fake.fetch,
    });

    // 1. Already aborted with a custom reason before request starts
    const preAborted = new AbortController();
    const customReason = new Error('cancelled by caller');
    preAborted.abort(customReason);
    const reason1 = await captureRejection(
      transport.request({ path: '/services', signal: preAborted.signal }),
    );
    expect(reason1).toBe(customReason);
    expect(headersFn).not.toHaveBeenCalled();
    expect(fake.requests).toHaveLength(0);

    // 2. Aborted while async headers() is resolving
    const duringHeaders = new AbortController();
    const headersReason = 'aborted-during-headers';
    const asyncHeadersTransport = new Transport({
      adminUrl: 'http://localhost:8001',
      headers: async () => {
        duringHeaders.abort(headersReason);
        await Promise.resolve();
        return { 'X-Test': '1' };
      },
      fetch: fake.fetch,
    });
    const reason2 = await captureRejection(
      asyncHeadersTransport.request({ path: '/services', signal: duringHeaders.signal }),
    );
    expect(reason2).toBe(headersReason);
    expect(fake.requests).toHaveLength(0);

    // 3. Aborted in-flight with custom reason (even if fetch rejects with generic AbortError)
    const inFlight = new AbortController();
    const inFlightReason = new Error('stop now');
    fake.handler((req) => {
      return new Promise<Response>((_resolve, reject) => {
        req.signal?.addEventListener('abort', () => {
          reject(new DOMException('Generic abort', 'AbortError'));
        });
        queueMicrotask(() => inFlight.abort(inFlightReason));
      });
    });
    const reason3 = await captureRejection(
      transport.request({ path: '/services', signal: inFlight.signal }),
    );
    expect(reason3).toBe(inFlightReason);

    // 4. Aborted in-flight with default AbortError reason (no argument to abort())
    const defaultAbort = new AbortController();
    fake.handler((req) => {
      return new Promise<Response>((_resolve, reject) => {
        req.signal?.addEventListener('abort', () => {
          const reason: unknown = req.signal?.reason;
          reject(reason instanceof Error ? reason : new DOMException('Aborted', 'AbortError'));
        });
        queueMicrotask(() => defaultAbort.abort());
      });
    });
    const reason4 = await captureRejection(
      transport.request({ path: '/services', signal: defaultAbort.signal }),
    );
    expect(reason4).toBe(defaultAbort.signal.reason);
    expect(reason4).toBeInstanceOf(DOMException);
  });

  it('uses globalThis.fetch by default when options.fetch is omitted', async () => {
    const fake = createFakeFetch().json({ status: 'ok' });
    vi.stubGlobal('fetch', fake.fetch);

    const transport = new Transport({ adminUrl: 'http://localhost:8001' });
    const result = await transport.request<{ status: string }>({ path: '/status' });

    expect(result).toEqual({ status: 'ok' });
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]!.url).toBe('http://localhost:8001/status');
  });
});
