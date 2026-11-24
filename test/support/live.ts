import { randomBytes } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Kong, type KongOptions } from '../../src/index.js';

export type LiveTarget = 'oss-3.9' | 'ee-3.14';

export interface LiveEnv {
  target: LiveTarget;
  adminUrl: string;
  dblessAdminUrl: string;
  proxyUrl: string;
  upstreamUrl: string;
  upstreamInternalUrl: string;
}

export interface RecordedRequest {
  method: string;
  path: string;
  query: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  receivedAt: string;
}

export interface EventuallyOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name} for live tests`);
  }
  return value;
}

export function getLiveEnv(): LiveEnv {
  const rawTarget = requireEnv('KONG_TARGET');
  if (rawTarget !== 'oss-3.9' && rawTarget !== 'ee-3.14') {
    throw new Error(`Unsupported KONG_TARGET '${rawTarget}'; expected 'oss-3.9' or 'ee-3.14'`);
  }
  return {
    target: rawTarget,
    adminUrl: requireEnv('KONG_ADMIN_URL'),
    dblessAdminUrl: requireEnv('KONG_DBLESS_ADMIN_URL'),
    proxyUrl: requireEnv('KONG_PROXY_URL'),
    upstreamUrl: requireEnv('KONG_UPSTREAM_URL'),
    upstreamInternalUrl: requireEnv('KONG_UPSTREAM_INTERNAL_URL'),
  };
}

export function liveRequestLogPath(target: LiveTarget = getLiveEnv().target): string {
  return fileURLToPath(new URL(`../../coverage/live-requests-${target}.jsonl`, import.meta.url));
}

function createLoggingFetch(
  logPath: string,
  baseFetch: typeof globalThis.fetch = globalThis.fetch,
): typeof globalThis.fetch {
  mkdirSync(dirname(logPath), { recursive: true });
  return async (input, init) => {
    const response = await baseFetch(input, init);
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(rawUrl);
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const record = JSON.stringify({
      method,
      path: parsed.pathname,
      status: response.status,
    });
    appendFileSync(logPath, `${record}\n`, 'utf8');
    return response;
  };
}

export function liveKong(options: Partial<Omit<KongOptions, 'adminUrl'>> = {}): Kong {
  const env = getLiveEnv();
  const logPath = liveRequestLogPath(env.target);
  return new Kong({
    ...options,
    adminUrl: env.adminUrl,
    fetch: createLoggingFetch(logPath, options.fetch),
  });
}

export function liveDblessKong(options: Partial<Omit<KongOptions, 'adminUrl'>> = {}): Kong {
  const env = getLiveEnv();
  const logPath = liveRequestLogPath(env.target);
  return new Kong({
    ...options,
    adminUrl: env.dblessAdminUrl,
    fetch: createLoggingFetch(logPath, options.fetch),
  });
}

export function getProxyUrl(): string {
  return getLiveEnv().proxyUrl;
}

export async function getUpstreamRequests(pathPrefix?: string): Promise<RecordedRequest[]> {
  const { upstreamUrl } = getLiveEnv();
  const url = new URL('/__requests', upstreamUrl);
  if (pathPrefix !== undefined) {
    url.searchParams.set('path', pathPrefix);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch upstream requests: HTTP ${response.status}`);
  }
  return (await response.json()) as RecordedRequest[];
}

export async function clearUpstreamRequests(): Promise<void> {
  const { upstreamUrl } = getLiveEnv();
  const response = await fetch(new URL('/__requests', upstreamUrl), { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to clear upstream requests: HTTP ${response.status}`);
  }
}

export function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function eventually<T>(
  fn: () => Promise<T> | T,
  options: EventuallyOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const intervalMs = options.intervalMs ?? 200;
  const deadline = Date.now() + timeoutMs;

  let lastError: unknown;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (Date.now() >= deadline) {
        throw lastError;
      }
      await sleep(intervalMs);
    }
  }
}
