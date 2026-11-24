import { describe, expect, it } from 'vitest';
import { exerciseCollection } from '../../support/crud.js';
import { captureHttpError } from '../../support/errors.js';
import { liveKong, unique } from '../../support/live.js';

describe('acme_storage', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /acme_storage (id is the only endpoint key)', async () => {
    // acme_storage has no `tags` field and only accepts its UUID `id` in path
    // parameters (Kong rejects non-UUID lookups by `key` with 400 invalid primary key).
    await exerciseCollection(kong.acmeStorage)({
      supportsTags: false,
      makeCreateInput: () => ({
        key: unique('acme-key'),
        value: 'initial-acme-value',
      }),
      update: {
        patch: { value: 'updated-acme-value' },
        assertUpdated: (updated, before) => {
          expect(updated.value).toBe('updated-acme-value');
          expect(updated.key).toBe(before.key);
        },
      },
      upsert: {
        makeInput: (current) => ({
          key: current.key,
        }),
        assertUpserted: (upserted, before) => {
          expect(upserted.key).toBe(before.key);
          expect(typeof upserted.value).toBe('string');
          expect(upserted.value.length).toBeGreaterThan(0);
          expect(upserted.value).not.toBe('updated-acme-value');
        },
      },
    });

    const invalidKeyError = await captureHttpError(kong.acmeStorage.get('not-a-uuid-key'));
    expect(invalidKeyError.status).toBe(400);
    expect(invalidKeyError.kongName).toBe('invalid primary key');
    expect(invalidKeyError.code).toBe(1);
    expect(invalidKeyError.fields).toHaveProperty('id');
  });
});
