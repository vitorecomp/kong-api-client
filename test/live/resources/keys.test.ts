import { describe, expect, it } from 'vitest';
import {
  deleteIgnoringNotFound,
  exerciseCollection,
  exerciseSingleton,
} from '../../support/crud.js';
import { TLS_FIXTURES } from '../../support/fixtures/tls/index.js';
import { liveKong, unique } from '../../support/live.js';

describe('keys and key set singleton', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /keys', async () => {
    const renamed = unique('key-renamed');

    await exerciseCollection(kong.keys)({
      makeCreateInput: (tag) => ({
        name: unique('key'),
        kid: unique('kid'),
        pem: {
          private_key: TLS_FIXTURES.rsaKey,
          public_key: TLS_FIXTURES.rsaPub,
        },
        tags: tag ? [tag, 'key-keep'] : ['key-keep'],
      }),
      getKey: (key) => {
        expect(key.name).toBeTruthy();
        return key.name!;
      },
      update: {
        patch: { name: renamed },
        assertUpdated: (updated, before) => {
          expect(updated.name).toBe(renamed);
          expect(updated.kid).toBe(before.kid);
          expect(updated.tags).toEqual(before.tags);
          expect(updated.pem?.public_key).toBe(TLS_FIXTURES.rsaPub);
        },
      },
      upsert: {
        // Kong returns 500 on PUT /keys/{name}; PUT by id replaces the entity cleanly.
        getKey: (current) => current.id,
        makeInput: (current) => ({
          name: current.name,
          kid: current.kid,
          pem: {
            private_key: TLS_FIXTURES.rsa2Key,
            public_key: TLS_FIXTURES.rsa2Pub,
          },
        }),
        assertUpserted: (upserted) => {
          expect(upserted.pem?.public_key).toBe(TLS_FIXTURES.rsa2Pub);
          expect(upserted.tags).toBeNull();
        },
      },
    });
  });

  it('exercises get, update, and upsert on /keys/{key}/set', async () => {
    const initialTag = unique('key-set-init');
    const renamedSet = unique('key-set-renamed');

    const keySet = await kong.keySets.create({
      name: unique('key-set-single'),
      tags: [initialTag],
    });
    const key = await kong.keys.create({
      name: unique('key-with-set'),
      kid: unique('kid-set'),
      set: { id: keySet.id },
      pem: {
        private_key: TLS_FIXTURES.rsaKey,
        public_key: TLS_FIXTURES.rsaPub,
      },
    });

    try {
      await exerciseSingleton(kong.keys.set(key.id))({
        assertInitial: (fetched) => {
          expect(fetched.id).toBe(keySet.id);
          expect(fetched.tags).toEqual([initialTag]);
        },
        update: {
          patch: { name: renamedSet },
          assertUpdated: (updated) => {
            expect(updated.id).toBe(keySet.id);
            expect(updated.name).toBe(renamedSet);
            expect(updated.tags).toEqual([initialTag]);
          },
        },
        upsert: {
          makeInput: (current) => ({
            name: current.name,
          }),
          assertUpserted: (upserted) => {
            expect(upserted.id).toBe(keySet.id);
            expect(upserted.name).toBe(renamedSet);
            expect(upserted.tags).toBeNull();
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.keys.delete(key.id));
      await deleteIgnoringNotFound(() => kong.keySets.delete(keySet.id));
    }
  });
});
