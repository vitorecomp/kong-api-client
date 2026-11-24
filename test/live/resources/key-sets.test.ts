import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound, exerciseCollection } from '../../support/crud.js';
import { TLS_FIXTURES } from '../../support/fixtures/tls/index.js';
import { liveKong, unique } from '../../support/live.js';

describe('key-sets and nested keys', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /key-sets', async () => {
    const renamed = unique('ks-renamed');

    await exerciseCollection(kong.keySets)({
      makeCreateInput: (tag) => ({
        name: unique('ks'),
        tags: tag ? [tag, 'ks-keep'] : ['ks-keep'],
      }),
      getKey: (keySet) => {
        expect(keySet.name).toBeTruthy();
        return keySet.name!;
      },
      update: {
        patch: { name: renamed },
        assertUpdated: (updated, before) => {
          expect(updated.name).toBe(renamed);
          expect(updated.tags).toEqual(before.tags);
        },
      },
      upsert: {
        // Kong returns 500 on PUT /key-sets/{name}; PUT by id replaces the entity cleanly.
        getKey: (current) => current.id,
        makeInput: (current) => ({
          name: current.name,
        }),
        assertUpserted: (upserted) => {
          expect(upserted.name).toBe(renamed);
          expect(upserted.tags).toBeNull();
        },
      },
    });
  });

  it('exercises full CRUD and pagination on /key-sets/{keySet}/keys', async () => {
    const parentKeySet = await kong.keySets.create({
      name: unique('ks-parent'),
    });
    const renamed = unique('ks-key-renamed');

    try {
      await exerciseCollection(kong.keySets.keys(parentKeySet.id))({
        makeCreateInput: (tag) => ({
          name: unique('ks-key'),
          kid: unique('ks-kid'),
          pem: {
            private_key: TLS_FIXTURES.rsaKey,
            public_key: TLS_FIXTURES.rsaPub,
          },
          tags: tag ? [tag, 'ks-key-keep'] : ['ks-key-keep'],
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
            expect(updated.set?.id).toBe(parentKeySet.id);
          },
        },
        upsert: {
          // Kong returns 500 on PUT /key-sets/{id}/keys/{name}; PUT by id replaces cleanly.
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
            expect(upserted.set?.id).toBe(parentKeySet.id);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.keySets.delete(parentKeySet.id));
    }
  });
});
