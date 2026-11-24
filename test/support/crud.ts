import { expect } from 'vitest';
import {
  KongHttpError,
  type Collection,
  type ListParams,
  type Patch,
  type Singleton,
} from '../../src/index.js';
import { unique } from './live.js';

/** Options for {@link exerciseCollection}. */
export interface CollectionCrudOptions<E extends { id: string }, I> {
  /**
   * Builds a valid create payload. When `supportsTags` is `true` (default),
   * attach the supplied `tag` to the entity so pagination tests isolate the
   * entities created by this test run.
   */
  makeCreateInput: (tag?: string) => I;
  /**
   * Optional unique lookup key other than `id` (for example `name`, `username`,
   * `prefix`, or `instance_name`). When provided, `get()` is exercised with both
   * `id` and this key.
   */
  getKey?: (entity: E) => string;
  /**
   * Partial update (`PATCH`) specification. `assertUpdated` must assert both
   * the changed field and that an untouched field retained its previous value.
   */
  update: {
    patch: Patch<I> | ((current: E, tag?: string) => Patch<I>);
    assertUpdated: (updated: E, before: E) => void;
  };
  /**
   * Replacement (`PUT`) specification. `makeInput` should omit a previously set
   * non-default field and `assertUpserted` must assert Kong reset that field to
   * its default.
   */
  upsert: {
    makeInput: (current: E, tag?: string) => I;
    /** Optional key passed to `PUT`; defaults to `getKey(current)` when set, else `current.id`. */
    getKey?: (current: E) => string;
    assertUpserted: (upserted: E, before: E) => void;
  };
  /**
   * Whether the collection supports `?tags=` filtering for the 3-entity
   * pagination check. Defaults to `true`.
   */
  supportsTags?: boolean;
  /** Optional custom cleanup handler when deleting an entity by `id`. */
  cleanup?: (id: string) => Promise<void>;
}

/** Options for {@link exerciseSingleton}. */
export interface SingletonCrudOptions<E, I> {
  /** Asserts that `GET` returns the expected related entity. */
  assertInitial: (entity: E) => void;
  /**
   * Partial update (`PATCH`) specification. `assertUpdated` must assert both
   * the changed field and that an untouched field retained its previous value.
   */
  update: {
    patch: Patch<I> | ((current: E) => Patch<I>);
    assertUpdated: (updated: E, before: E) => void;
  };
  /**
   * Replacement (`PUT`) specification. `makeInput` should omit a previously set
   * non-default field and `assertUpserted` must assert Kong reset that field to
   * its default.
   */
  upsert: {
    makeInput: (current: E) => I;
    assertUpserted: (upserted: E, before: E) => void;
  };
}

function isPatchBuilder<I, Args extends unknown[]>(
  value: Patch<I> | ((...args: Args) => Patch<I>),
): value is (...args: Args) => Patch<I> {
  return typeof value === 'function';
}

/** Runs a cleanup deletion, ignoring a 404 response when the entity was already removed. */
export async function deleteIgnoringNotFound(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (!(error instanceof KongHttpError && error.status === 404)) {
      throw error;
    }
  }
}

/**
 * Returns a runner that exercises full CRUD and real-page pagination on a Kong
 * collection: `create`, `get` (by id and optional secondary key), `update`
 * (`PATCH`), `upsert` (`PUT`), `list` / `iterate` / `all` across real pages
 * (`size: 1` over 3 entities), `delete`, and `find` returning `undefined` after
 * delete.
 *
 * Curried so TypeScript infers `E` and `I` from `collection` first and gives
 * full contextual typing to every callback in `options` (including string
 * literal unions such as `protocols: ['http', 'https']`).
 *
 * Cleans up every created entity in `finally`.
 */
export function exerciseCollection<E extends { id: string }, I>(
  collection: Collection<E, I>,
): (options: CollectionCrudOptions<E, I>) => Promise<void> {
  return async (options) => {
    const { makeCreateInput, getKey, update, upsert, cleanup } = options;
    const supportsTags = options.supportsTags ?? true;
    const tag = supportsTags ? unique('crud-tag') : undefined;
    const createdIds = new Set<string>();

    try {
      // 1. Create
      const created = await collection.create(makeCreateInput(tag));
      expect(typeof created.id).toBe('string');
      expect(created.id.length).toBeGreaterThan(0);
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
      const patchBody = isPatchBuilder(update.patch) ? update.patch(created, tag) : update.patch;
      const updated = await collection.update(created.id, patchBody);
      expect(updated.id).toBe(created.id);
      update.assertUpdated(updated, created);

      const afterUpdate = await collection.get(created.id);
      update.assertUpdated(afterUpdate, created);

      // 4. Real-page pagination across 3 entities sharing one unique tag
      const second = await collection.create(makeCreateInput(tag));
      createdIds.add(second.id);
      const third = await collection.create(makeCreateInput(tag));
      createdIds.add(third.id);

      const paginatedIds = [afterUpdate.id, second.id, third.id];
      const listParams: Omit<ListParams, 'offset'> = tag ? { size: 1, tags: [tag] } : { size: 1 };

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
      for (const id of paginatedIds) {
        expect(iteratedIds).toContain(id);
      }
      if (supportsTags) {
        expect(iteratedIds).toHaveLength(3);
      }

      const allItems = await collection.all(listParams);
      const allIds = allItems.map((item) => item.id);
      for (const id of paginatedIds) {
        expect(allIds).toContain(id);
      }
      if (supportsTags) {
        expect(allIds).toHaveLength(3);
      }

      // Remove the two extra pagination entities before testing replacement (PUT)
      for (const id of [second.id, third.id]) {
        await collection.delete(id);
        createdIds.delete(id);
      }

      // 5. Replace / upsert (PUT) — verify omitted field resets to default
      const upsertKey = upsert.getKey
        ? upsert.getKey(afterUpdate)
        : getKey
          ? getKey(afterUpdate)
          : afterUpdate.id;
      const upserted = await collection.upsert(upsertKey, upsert.makeInput(afterUpdate, tag));
      expect(typeof upserted.id).toBe('string');
      createdIds.add(upserted.id);
      upsert.assertUpserted(upserted, afterUpdate);

      const afterUpsert = await collection.get(upserted.id);
      upsert.assertUpserted(afterUpsert, afterUpdate);

      // 6. Delete and confirm find() returns undefined afterwards
      await collection.delete(afterUpsert.id);
      createdIds.delete(afterUpsert.id);
      await expect(collection.find(afterUpsert.id)).resolves.toBeUndefined();
    } finally {
      for (const id of [...createdIds].reverse()) {
        await deleteIgnoringNotFound(() => (cleanup ? cleanup(id) : collection.delete(id)));
      }
    }
  };
}

/**
 * Returns a runner that exercises a Kong singleton resource: `get`, `find`,
 * `update` (`PATCH`), and `upsert` (`PUT`).
 *
 * Curried so TypeScript infers `E` and `I` from `singleton` first and gives
 * full contextual typing to every callback in `options`.
 */
export function exerciseSingleton<E, I>(
  singleton: Singleton<E, I>,
): (options: SingletonCrudOptions<E, I>) => Promise<void> {
  return async (options) => {
    const { assertInitial, update, upsert } = options;

    const initial = await singleton.get();
    assertInitial(initial);

    const found = await singleton.find();
    expect(found).toBeDefined();

    const patchBody = isPatchBuilder(update.patch) ? update.patch(initial) : update.patch;
    const updated = await singleton.update(patchBody);
    update.assertUpdated(updated, initial);

    const afterUpdate = await singleton.get();
    update.assertUpdated(afterUpdate, initial);

    const upserted = await singleton.upsert(upsert.makeInput(afterUpdate));
    upsert.assertUpserted(upserted, afterUpdate);

    const afterUpsert = await singleton.get();
    upsert.assertUpserted(afterUpsert, afterUpdate);
  };
}
