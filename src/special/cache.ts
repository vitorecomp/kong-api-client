import { segment, type CallOptions, type Transport } from '../transport.js';

function encodeCacheKey(key: string): string {
  // Kong's /cache/:key handler passes the path param directly to cache:probe without unescaping;
  // colons are valid RFC 3986 path segment characters and standard separators in Kong cache keys.
  return segment(key).replace(/%3A/gi, ':');
}

/** Admin API endpoints for inspecting and invalidating Kong's internal database caches. */
export class CacheApi {
  private readonly transport: Transport;

  /** Creates a {@link CacheApi} bound to the given transport. */
  constructor(transport: Transport) {
    this.transport = transport;
  }

  /** Purges every entry from Kong's node-level caches (`DELETE /cache`). */
  async purge(options?: CallOptions): Promise<void> {
    await this.transport.request<unknown>({
      method: 'DELETE',
      path: '/cache',
      signal: options?.signal,
    });
  }

  /** Retrieves a cached entry by key (`GET /cache/{key}`). */
  async get(key: string, options?: CallOptions): Promise<unknown> {
    const encoded = encodeCacheKey(key);
    return this.transport.request<unknown>({
      method: 'GET',
      path: `/cache/${encoded}`,
      signal: options?.signal,
    });
  }

  /** Invalidates a single cached entry by key (`DELETE /cache/{key}`). */
  async delete(key: string, options?: CallOptions): Promise<void> {
    const encoded = encodeCacheKey(key);
    await this.transport.request<unknown>({
      method: 'DELETE',
      path: `/cache/${encoded}`,
      signal: options?.signal,
    });
  }
}
