import type { CallOptions, Transport } from '../transport.js';
import { colonSegment } from './colon-segment.js';

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
    const encoded = colonSegment(key);
    return this.transport.request<unknown>({
      method: 'GET',
      path: `/cache/${encoded}`,
      signal: options?.signal,
    });
  }

  /** Invalidates a single cached entry by key (`DELETE /cache/{key}`). */
  async delete(key: string, options?: CallOptions): Promise<void> {
    const encoded = colonSegment(key);
    await this.transport.request<unknown>({
      method: 'DELETE',
      path: `/cache/${encoded}`,
      signal: options?.signal,
    });
  }
}
