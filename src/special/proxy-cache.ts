import { segment, type CallOptions, type Transport } from '../transport.js';

/** Cached HTTP response entry returned by Kong's `proxy-cache` plugin Admin API. */
export interface ProxyCacheEntry {
  /** Cached response body. */
  body: string;
  /** Byte length of the cached response body. */
  body_len: number;
  /** Cached HTTP response headers. */
  headers: Record<string, string | string[]>;
  /** HTTP status code of the cached response. */
  status: number;
  /** Unix timestamp when the response was cached. */
  timestamp: number;
  /** Cache entry TTL in seconds. */
  ttl: number;
  /** Cache entry serialization version. */
  version: number;
  /** Request body associated with the cache entry, when present. */
  req_body?: string;
  [key: string]: unknown;
}

/** Admin API endpoints exposed by Kong's `proxy-cache` plugin. */
export class ProxyCacheApi {
  private readonly transport: Transport;

  /** Creates a {@link ProxyCacheApi} bound to the given transport. */
  constructor(transport: Transport) {
    this.transport = transport;
  }

  /** Purges all cached responses across every `proxy-cache` plugin instance (`DELETE /proxy-cache`). */
  async purge(options?: CallOptions): Promise<void> {
    await this.transport.request<unknown>({
      method: 'DELETE',
      path: '/proxy-cache',
      signal: options?.signal,
    });
  }

  /** Retrieves a cached response by cache key (`GET /proxy-cache/{cacheKey}`). */
  get(cacheKey: string, options?: CallOptions): Promise<ProxyCacheEntry>;
  /** Retrieves a cached response scoped to one `proxy-cache` plugin (`GET /proxy-cache/{pluginId}/caches/{cacheKey}`). */
  get(cacheKey: string, pluginId: string, options?: CallOptions): Promise<ProxyCacheEntry>;
  async get(
    cacheKey: string,
    pluginIdOrOptions?: string | CallOptions,
    options?: CallOptions,
  ): Promise<ProxyCacheEntry> {
    const pluginId = typeof pluginIdOrOptions === 'string' ? pluginIdOrOptions : undefined;
    const callOptions = typeof pluginIdOrOptions === 'string' ? options : pluginIdOrOptions;
    const encodedKey = segment(cacheKey);
    const path =
      pluginId !== undefined
        ? `/proxy-cache/${segment(pluginId)}/caches/${encodedKey}`
        : `/proxy-cache/${encodedKey}`;

    return this.transport.request<ProxyCacheEntry>({
      method: 'GET',
      path,
      signal: callOptions?.signal,
    });
  }

  /** Deletes a cached response by cache key (`DELETE /proxy-cache/{cacheKey}`). */
  delete(cacheKey: string, options?: CallOptions): Promise<void>;
  /** Deletes a cached response scoped to one `proxy-cache` plugin (`DELETE /proxy-cache/{pluginId}/caches/{cacheKey}`). */
  delete(cacheKey: string, pluginId: string, options?: CallOptions): Promise<void>;
  async delete(
    cacheKey: string,
    pluginIdOrOptions?: string | CallOptions,
    options?: CallOptions,
  ): Promise<void> {
    const pluginId = typeof pluginIdOrOptions === 'string' ? pluginIdOrOptions : undefined;
    const callOptions = typeof pluginIdOrOptions === 'string' ? options : pluginIdOrOptions;
    const encodedKey = segment(cacheKey);
    const path =
      pluginId !== undefined
        ? `/proxy-cache/${segment(pluginId)}/caches/${encodedKey}`
        : `/proxy-cache/${encodedKey}`;

    await this.transport.request<unknown>({
      method: 'DELETE',
      path,
      signal: callOptions?.signal,
    });
  }
}
