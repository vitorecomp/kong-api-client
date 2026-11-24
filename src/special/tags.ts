import type { Page } from '../pagination.js';
import { segment, type CallOptions, type Transport } from '../transport.js';

/** A single tag-to-entity association returned by `/tags` and `/tags/{tag}`. */
export interface TagEntry {
  /** Tag name. */
  tag: string;
  /** Entity type (for example `'services'` or `'routes'`). */
  entity_name: string;
  /** Identifier of the tagged entity. */
  entity_id: string;
  [key: string]: unknown;
}

/** Pagination parameters for tag listing endpoints. */
export interface TagListParams {
  /** Maximum number of tag entries to return per page. */
  size?: number;
  /** Opaque pagination cursor from a previous page's `offset`. */
  offset?: string;
}

function buildTagQuery(
  params?: TagListParams,
): Record<string, string | number | boolean | undefined> | undefined {
  if (!params) {
    return undefined;
  }
  return {
    size: params.size,
    offset: params.offset,
  };
}

/** Admin API endpoints for listing Kong tags and entities associated with a tag. */
export class TagsApi {
  private readonly transport: Transport;

  /** Creates a {@link TagsApi} bound to the given transport. */
  constructor(transport: Transport) {
    this.transport = transport;
  }

  /** Lists one page of all tag associations across entities (`GET /tags`). */
  list(params?: TagListParams, options?: CallOptions): Promise<Page<TagEntry>> {
    return this.transport.request<Page<TagEntry>>({
      method: 'GET',
      path: '/tags',
      query: buildTagQuery(params),
      signal: options?.signal,
    });
  }

  /** Lists one page of entities associated with a specific tag (`GET /tags/{tag}`). */
  async entities(
    tag: string,
    params?: TagListParams,
    options?: CallOptions,
  ): Promise<Page<TagEntry>> {
    const encoded = segment(tag);
    return this.transport.request<Page<TagEntry>>({
      method: 'GET',
      path: `/tags/${encoded}`,
      query: buildTagQuery(params),
      signal: options?.signal,
    });
  }
}
