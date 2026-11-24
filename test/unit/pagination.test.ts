import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  collectAll,
  formatTagFilter,
  paginate,
  toListQuery,
  type ListParams,
  type Page,
  type TagFilter,
} from '../../src/pagination.js';

describe('formatTagFilter', () => {
  it('sends a string tag filter as-is', () => {
    expect(formatTagFilter('prod')).toBe('prod');
    expect(formatTagFilter('managed-by:kong-api-client')).toBe('managed-by:kong-api-client');
    expect(formatTagFilter('a,b/c')).toBe('a,b/c');
  });

  it('joins an array of tags with commas (AND)', () => {
    expect(formatTagFilter(['a', 'b', 'c'])).toBe('a,b,c');
    expect(formatTagFilter(['only'])).toBe('only');
    expect(formatTagFilter([])).toBeUndefined();
  });

  it('joins { all } tags with commas (AND)', () => {
    expect(formatTagFilter({ all: ['team-a', 'prod'] })).toBe('team-a,prod');
    expect(formatTagFilter({ all: [] })).toBeUndefined();
  });

  it('joins { any } tags with slashes (OR)', () => {
    expect(formatTagFilter({ any: ['team-a', 'team-b'] })).toBe('team-a/team-b');
    expect(formatTagFilter({ any: [] })).toBeUndefined();
  });
});

describe('toListQuery', () => {
  it('returns an empty object when params are omitted', () => {
    expect(toListQuery()).toEqual({});
    expect(toListQuery({})).toEqual({});
  });

  it('maps size, offset, and tags into query parameters', () => {
    expect(toListQuery({ size: 25, offset: 'cursor-1', tags: ['a', 'b'] })).toEqual({
      size: 25,
      offset: 'cursor-1',
      tags: 'a,b',
    });
    expect(toListQuery({ tags: { any: ['x', 'y'] } })).toEqual({
      tags: 'x/y',
    });
  });
});

describe('paginate and collectAll', () => {
  it('follows offset until absent and passes size and tags on every page', async () => {
    const seenParams: ListParams[] = [];
    const pages: Page<{ id: string }>[] = [
      { data: [{ id: '1' }, { id: '2' }], offset: 'tok-1', next: '/items?offset=tok-1' },
      { data: [], offset: 'tok-2', next: '/items?offset=tok-2' },
      { data: [{ id: '3' }], next: null },
    ];

    const fetchPage = async (params: ListParams): Promise<Page<{ id: string }>> => {
      seenParams.push(params);
      await Promise.resolve();
      const page = pages.shift();
      if (!page) {
        throw new Error('Unexpected extra page request');
      }
      return page;
    };

    const collected = await collectAll(paginate(fetchPage, { size: 2, tags: { all: ['a', 'b'] } }));

    expect(collected).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    expect(seenParams).toEqual([
      { size: 2, tags: { all: ['a', 'b'] } },
      { size: 2, tags: { all: ['a', 'b'] }, offset: 'tok-1' },
      { size: 2, tags: { all: ['a', 'b'] }, offset: 'tok-2' },
    ]);
  });

  it('stops requesting further pages when iteration breaks early', async () => {
    let fetchCount = 0;
    const fetchPage = async (): Promise<Page<number>> => {
      fetchCount += 1;
      await Promise.resolve();
      return { data: [fetchCount * 10, fetchCount * 10 + 1], offset: `next-${fetchCount}` };
    };

    const items: number[] = [];
    for await (const item of paginate(fetchPage)) {
      items.push(item);
      if (items.length === 2) {
        break;
      }
    }

    expect(items).toEqual([10, 11]);
    expect(fetchCount).toBe(1);
  });

  it('exposes accurate public pagination types', () => {
    expectTypeOf<Page<string>>().toEqualTypeOf<{
      data: string[];
      offset?: string;
      next?: string | null;
    }>();
    expectTypeOf<'a'>().toExtend<TagFilter>();
    expectTypeOf<readonly string[]>().toExtend<TagFilter>();
    expectTypeOf<{ all: readonly string[] }>().toExtend<TagFilter>();
    expectTypeOf<{ any: readonly string[] }>().toExtend<TagFilter>();
  });
});
