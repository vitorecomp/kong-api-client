/** One page of results returned by a Kong Admin API list endpoint. */
export interface Page<T> {
  /** Entities contained in this page. */
  data: T[];
  /** Opaque pagination cursor for the next page; absent on the last page. */
  offset?: string;
  /** Relative URL of the next page, or `null` when there is no next page. */
  next?: string | null;
}

/**
 * Tag filter for Kong Admin API list endpoints.
 *
 * - A string is sent as-is.
 * - An array or `{ all }` requires entities to carry every listed tag (joined with `,`).
 * - `{ any }` matches entities carrying at least one listed tag (joined with `/`).
 */
export type TagFilter =
  | string
  | readonly string[]
  | {
      /** Match entities carrying every listed tag (joined with `,`). */
      all: readonly string[];
    }
  | {
      /** Match entities carrying at least one listed tag (joined with `/`). */
      any: readonly string[];
    };

/** Pagination and filtering parameters accepted by Kong list endpoints. */
export interface ListParams {
  /** Maximum number of items to return per page. */
  size?: number;
  /** Opaque cursor returned by a previous page's `offset`. */
  offset?: string;
  /** Filter entities by Kong tags. */
  tags?: TagFilter;
}

/** Formats a {@link TagFilter} into the `tags` query parameter value expected by Kong. */
export function formatTagFilter(tags: TagFilter): string | undefined {
  if (typeof tags === 'string') {
    return tags;
  }
  if ('all' in tags) {
    return tags.all.length > 0 ? tags.all.join(',') : undefined;
  }
  if ('any' in tags) {
    return tags.any.length > 0 ? tags.any.join('/') : undefined;
  }
  return tags.length > 0 ? tags.join(',') : undefined;
}

/** Converts {@link ListParams} into query parameters suitable for `Transport.request`. */
export function toListQuery(
  params?: ListParams,
): Record<string, string | number | boolean | undefined> {
  const query: Record<string, string | number | boolean | undefined> = {};
  if (!params) {
    return query;
  }
  if (params.size !== undefined) {
    query.size = params.size;
  }
  if (params.offset !== undefined) {
    query.offset = params.offset;
  }
  if (params.tags !== undefined) {
    query.tags = formatTagFilter(params.tags);
  }
  return query;
}

/**
 * Walks all pages of a Kong list endpoint by following each page's `offset`
 * until it is absent, yielding every entity in order.
 */
export async function* paginate<T>(
  fetchPage: (params: ListParams) => Promise<Page<T>>,
  params?: Omit<ListParams, 'offset'>,
): AsyncGenerator<T, void, undefined> {
  let offset: string | undefined;
  while (true) {
    const page = await fetchPage(offset === undefined ? { ...params } : { ...params, offset });
    for (const item of page.data) {
      yield item;
    }
    if (!page.offset) {
      break;
    }
    offset = page.offset;
  }
}

/** Collects every item from an async iterable into an array. */
export async function collectAll<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
}
