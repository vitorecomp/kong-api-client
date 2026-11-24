import { describe, expect, it } from 'vitest';
import { exerciseCollection } from '../../support/crud.js';
import { liveKong, unique } from '../../support/live.js';

describe('vaults', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /vaults', async () => {
    await exerciseCollection(kong.vaults)({
      makeCreateInput: (tag) => ({
        name: 'env',
        prefix: unique('vlt').toLowerCase(),
        description: 'initial vault description',
        config: { prefix: 'KONG_TEST_VAULT_' },
        tags: tag ? [tag] : undefined,
      }),
      getKey: (vault) => vault.prefix,
      update: {
        patch: { description: 'updated vault description' },
        assertUpdated: (updated, before) => {
          expect(updated.description).toBe('updated vault description');
          expect(updated.config).toEqual(before.config);
          expect(updated.tags).toEqual(before.tags);
        },
      },
      upsert: {
        makeInput: (current) => ({
          name: 'env',
          prefix: current.prefix,
          config: { prefix: 'KONG_TEST_VAULT_' },
        }),
        assertUpserted: (upserted) => {
          expect(upserted.description).toBeNull();
          expect(upserted.tags).toBeNull();
        },
      },
    });
  });
});
