import { expect } from 'vitest';
import type { Collection, Consumer, ConsumerInput, Patch, Singleton } from '../../src/index.js';
import { deleteIgnoringNotFound, exerciseSingleton } from './crud.js';
import { unique } from './live.js';

/** Options for {@link exerciseCollectionWithTagReset}. */
export interface CollectionTagResetOptions<
  E extends { id: string; tags: Array<string> | null },
  I,
> {
  /** Builds a create payload carrying the supplied `tag`. */
  makeCreateInput: (tag: string) => I;
  /**
   * Optional unique lookup key other than `id` (for example `username`, `key`,
   * or `group` on consumer-scoped ACLs). When provided, `get()` is exercised
   * with both `id` and this key.
   */
  getKey?: (entity: E) => string;
  /**
   * Partial update (`PATCH`) specification. `assertUpdated` must assert both
   * the changed field and that an untouched field retained its previous value.
   */
  update: {
    patch: Patch<I>;
    assertUpdated: (updated: E, before: E) => void;
  };
  /**
   * Replacement (`PUT`) specification. `makeInput` omits `tags` so Kong resets
   * `tags` to `null`, proving `PUT` replacement semantics on entities whose
   * only optional field is `tags`.
   */
  upsert: {
    makeInput: (current: E) => I;
    /** Optional key passed to `PUT`; defaults to `getKey(current)` when set, else `current.id`. */
    getKey?: (current: E) => string;
    assertUpserted: (upserted: E, before: E) => void;
  };
}

/**
 * Exercises full CRUD and real-page pagination on a tagged collection whose
 * only optional field is `tags` (such as `acls`, `basic-auths`, and
 * `key-auths`).
 *
 * Unlike `exerciseCollection`, `upsert` omits `tags` so Kong resets `tags` to
 * `null`, and the 3-entity pagination check then creates three fresh entities
 * sharing a unique pagination tag.
 */
export function exerciseCollectionWithTagReset<
  E extends { id: string; tags: Array<string> | null },
  I,
>(collection: Collection<E, I>): (options: CollectionTagResetOptions<E, I>) => Promise<void> {
  return async (options) => {
    const { makeCreateInput, getKey, update, upsert } = options;
    const initialTag = unique('crud-init-tag');
    const pageTag = unique('crud-page-tag');
    const createdIds = new Set<string>();

    try {
      // 1. Create with tag
      const created = await collection.create(makeCreateInput(initialTag));
      expect(typeof created.id).toBe('string');
      expect(created.id.length).toBeGreaterThan(0);
      expect(created.tags).toEqual([initialTag]);
      createdIds.add(created.id);

      // 2. Get by id and (when available) by secondary unique key
      const fetchedById = await collection.get(created.id);
      expect(fetchedById.id).toBe(created.id);

      if (getKey) {
        const secondaryKey = getKey(created);
        const fetchedByKey = await collection.get(secondaryKey);
        expect(fetchedByKey.id).toBe(created.id);
      }

      // 3. Partial update (PATCH) — verify changed field and preserved field
      const updated = await collection.update(created.id, update.patch);
      expect(updated.id).toBe(created.id);
      update.assertUpdated(updated, created);

      const afterUpdate = await collection.get(created.id);
      update.assertUpdated(afterUpdate, created);

      // 4. Replace / upsert (PUT) omitting `tags` — verify `tags` resets to null
      const upsertKey = upsert.getKey
        ? upsert.getKey(afterUpdate)
        : getKey
          ? getKey(afterUpdate)
          : afterUpdate.id;
      const upserted = await collection.upsert(upsertKey, upsert.makeInput(afterUpdate));
      expect(typeof upserted.id).toBe('string');
      createdIds.add(upserted.id);
      expect(upserted.tags).toBeNull();
      upsert.assertUpserted(upserted, afterUpdate);

      const afterUpsert = await collection.get(upserted.id);
      expect(afterUpsert.tags).toBeNull();
      upsert.assertUpserted(afterUpsert, afterUpdate);

      // Delete the replaced entity and confirm find() returns undefined
      await collection.delete(afterUpsert.id);
      createdIds.delete(afterUpsert.id);
      await expect(collection.find(afterUpsert.id)).resolves.toBeUndefined();

      // 5. Real-page pagination across 3 entities sharing one unique tag
      const p1 = await collection.create(makeCreateInput(pageTag));
      createdIds.add(p1.id);
      const p2 = await collection.create(makeCreateInput(pageTag));
      createdIds.add(p2.id);
      const p3 = await collection.create(makeCreateInput(pageTag));
      createdIds.add(p3.id);

      const expectedIds = [p1.id, p2.id, p3.id];
      const listParams = { size: 1, tags: [pageTag] };

      const firstPage = await collection.list(listParams);
      expect(Array.isArray(firstPage.data)).toBe(true);
      expect(firstPage.data).toHaveLength(1);
      expect(typeof firstPage.offset).toBe('string');
      expect(firstPage.offset?.length).toBeGreaterThan(0);
      expect(firstPage.next).toBeTruthy();

      const iteratedIds: string[] = [];
      for await (const item of collection.iterate(listParams)) {
        iteratedIds.push(item.id);
      }
      expect(iteratedIds).toHaveLength(3);
      for (const id of expectedIds) {
        expect(iteratedIds).toContain(id);
      }

      const allItems = await collection.all(listParams);
      const allIds = allItems.map((item) => item.id);
      expect(allIds).toHaveLength(3);
      for (const id of expectedIds) {
        expect(allIds).toContain(id);
      }

      // 6. Clean up paged entities
      for (const id of expectedIds) {
        await collection.delete(id);
        createdIds.delete(id);
      }
      await expect(collection.find(p1.id)).resolves.toBeUndefined();
    } finally {
      for (const id of [...createdIds].reverse()) {
        await deleteIgnoringNotFound(() => collection.delete(id));
      }
    }
  };
}

/**
 * Exercises `get`, `find`, `update` (`PATCH`), and `upsert` (`PUT`) on a
 * related consumer singleton such as `/key-auths/{id}/consumer`.
 *
 * `PATCH` updates `custom_id` while preserving `username` and `tags`; `PUT`
 * replaces the entire consumer with only a new `username`, resetting both
 * `custom_id` and `tags` to `null`.
 */
export async function exerciseConsumerSingleton(
  singleton: Singleton<Consumer, ConsumerInput>,
  consumer: Consumer,
): Promise<void> {
  const updatedCustomId = unique('singleton-cid');
  const replacedUsername = unique('singleton-user');

  await exerciseSingleton(singleton)({
    assertInitial: (fetched) => {
      expect(fetched.id).toBe(consumer.id);
      expect(fetched.username).toBe(consumer.username);
      expect(fetched.custom_id).toBe(consumer.custom_id);
      expect(fetched.tags).toEqual(consumer.tags);
    },
    update: {
      patch: { custom_id: updatedCustomId },
      assertUpdated: (updated) => {
        expect(updated.id).toBe(consumer.id);
        expect(updated.custom_id).toBe(updatedCustomId);
        expect(updated.username).toBe(consumer.username);
        expect(updated.tags).toEqual(consumer.tags);
      },
    },
    upsert: {
      makeInput: () => ({
        username: replacedUsername,
      }),
      assertUpserted: (upserted) => {
        expect(upserted.id).toBe(consumer.id);
        expect(upserted.username).toBe(replacedUsername);
        expect(upserted.custom_id).toBeNull();
        expect(upserted.tags).toBeNull();
      },
    },
  });
}
