import { KongHttpError } from './errors.js';
import { collectAll, paginate, toListQuery, type ListParams, type Page } from './pagination.js';
import { segment, type CallOptions, type Transport } from './transport.js';

/** What `update` accepts. Kong merges records field by field, at any depth, and replaces arrays and maps as a whole. */
export type Patch<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? string extends keyof T
      ? T
      : { [K in keyof T]?: Patch<T[K]> }
    : T;

/**
 * Generic CRUD and pagination client for a Kong Admin API collection endpoint
 * (for example `/services` or `/services/billing/routes`).
 */
export class Collection<E, I> {
  /** HTTP transport used to perform requests. */
  protected readonly transport: Transport;
  /** Base path of this collection (for example `'/services'`). */
  readonly basePath: string;

  constructor(transport: Transport, basePath: string) {
    this.transport = transport;
    this.basePath =
      basePath.length > 1 && basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  }

  /** Lists a single page of entities in this collection. */
  list(params?: ListParams, options?: CallOptions): Promise<Page<E>> {
    return this.transport.request<Page<E>>({
      method: 'GET',
      path: this.basePath,
      query: params ? toListQuery(params) : undefined,
      signal: options?.signal,
    });
  }

  /** Iterates over all entities in this collection across every page. */
  iterate(
    params?: Omit<ListParams, 'offset'>,
    options?: CallOptions,
  ): AsyncGenerator<E, void, undefined> {
    return paginate((pageParams) => this.list(pageParams, options), params);
  }

  /** Fetches all entities in this collection across every page and returns them as an array. */
  all(params?: Omit<ListParams, 'offset'>, options?: CallOptions): Promise<E[]> {
    return collectAll(this.iterate(params, options));
  }

  /** Retrieves a single entity by its identifier or unique name. */
  async get(key: string, options?: CallOptions): Promise<E> {
    const encoded = segment(key);
    return this.transport.request<E>({
      method: 'GET',
      path: `${this.basePath}/${encoded}`,
      signal: options?.signal,
    });
  }

  /** Retrieves a single entity by key, returning `undefined` when Kong responds with 404. */
  async find(key: string, options?: CallOptions): Promise<E | undefined> {
    try {
      return await this.get(key, options);
    } catch (error) {
      if (error instanceof KongHttpError && error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /** Creates a new entity in this collection (`POST`). */
  create(input: I, options?: CallOptions): Promise<E> {
    return this.transport.request<E>({
      method: 'POST',
      path: this.basePath,
      body: input,
      signal: options?.signal,
    });
  }

  /** Partially updates an existing entity by key (`PATCH`). */
  async update(key: string, patch: Patch<I>, options?: CallOptions): Promise<E> {
    const encoded = segment(key);
    return this.transport.request<E>({
      method: 'PATCH',
      path: `${this.basePath}/${encoded}`,
      body: patch,
      signal: options?.signal,
    });
  }

  /** Creates or replaces an entity at the given key (`PUT`). */
  async upsert(key: string, input: I, options?: CallOptions): Promise<E> {
    const encoded = segment(key);
    return this.transport.request<E>({
      method: 'PUT',
      path: `${this.basePath}/${encoded}`,
      body: input,
      signal: options?.signal,
    });
  }

  /** Deletes an entity by key (`DELETE`). */
  async delete(key: string, options?: CallOptions): Promise<void> {
    const encoded = segment(key);
    await this.transport.request<unknown>({
      method: 'DELETE',
      path: `${this.basePath}/${encoded}`,
      signal: options?.signal,
    });
  }
}

/**
 * Generic client for a Kong Admin API singleton resource endpoint
 * (for example `/routes/r1/service`).
 */
export class Singleton<E, I> {
  /** HTTP transport used to perform requests. */
  protected readonly transport: Transport;
  /** Path of this singleton resource (for example `'/routes/r1/service'`). */
  readonly path: string;

  constructor(transport: Transport, path: string) {
    this.transport = transport;
    this.path = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  }

  /** Retrieves the singleton entity (`GET`). */
  get(options?: CallOptions): Promise<E> {
    return this.transport.request<E>({
      method: 'GET',
      path: this.path,
      signal: options?.signal,
    });
  }

  /** Retrieves the singleton entity, returning `undefined` when Kong responds with 404. */
  async find(options?: CallOptions): Promise<E | undefined> {
    try {
      return await this.get(options);
    } catch (error) {
      if (error instanceof KongHttpError && error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /** Partially updates the singleton entity (`PATCH`). */
  update(patch: Patch<I>, options?: CallOptions): Promise<E> {
    return this.transport.request<E>({
      method: 'PATCH',
      path: this.path,
      body: patch,
      signal: options?.signal,
    });
  }

  /** Creates or replaces the singleton entity (`PUT`). */
  upsert(input: I, options?: CallOptions): Promise<E> {
    return this.transport.request<E>({
      method: 'PUT',
      path: this.path,
      body: input,
      signal: options?.signal,
    });
  }
}
