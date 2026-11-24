import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../support/crud.js';
import { liveKong, unique } from '../support/live.js';

function idSet(items: ReadonlyArray<{ id: string }>): Set<string> {
  return new Set(items.map((item) => item.id));
}

describe('tag filters (live)', () => {
  const kong = liveKong();

  it('filters consumers accurately with any, all, plain array, and string tag filters', async () => {
    const tagA = unique('tag-a');
    const tagB = unique('tag-b');
    const createdIds: string[] = [];

    try {
      const onlyA = await kong.consumers.create({
        username: unique('tag-filter-a'),
        tags: [tagA],
      });
      createdIds.push(onlyA.id);

      const onlyB = await kong.consumers.create({
        username: unique('tag-filter-b'),
        tags: [tagB],
      });
      createdIds.push(onlyB.id);

      const both = await kong.consumers.create({
        username: unique('tag-filter-ab'),
        tags: [tagA, tagB],
      });
      createdIds.push(both.id);

      const anyMatch = await kong.consumers.all({ tags: { any: [tagA, tagB] } });
      expect(anyMatch).toHaveLength(3);
      expect(idSet(anyMatch)).toEqual(new Set([onlyA.id, onlyB.id, both.id]));

      const allMatch = await kong.consumers.all({ tags: { all: [tagA, tagB] } });
      expect(allMatch).toHaveLength(1);
      expect(idSet(allMatch)).toEqual(new Set([both.id]));

      const arrayMatch = await kong.consumers.all({ tags: [tagA, tagB] });
      expect(arrayMatch).toHaveLength(1);
      expect(idSet(arrayMatch)).toEqual(new Set([both.id]));

      const stringMatch = await kong.consumers.all({ tags: tagA });
      expect(stringMatch).toHaveLength(2);
      expect(idSet(stringMatch)).toEqual(new Set([onlyA.id, both.id]));
    } finally {
      for (const id of [...createdIds].reverse()) {
        await deleteIgnoringNotFound(() => kong.consumers.delete(id));
      }
    }
  });
});
