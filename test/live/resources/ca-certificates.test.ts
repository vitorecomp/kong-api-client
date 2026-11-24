import { describe, expect, it } from 'vitest';
import { exerciseCollection } from '../../support/crud.js';
import { TLS_FIXTURES } from '../../support/fixtures/tls/index.js';
import { liveKong, unique } from '../../support/live.js';

describe('ca_certificates', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /ca_certificates', async () => {
    const caCerts = [TLS_FIXTURES.ca1, TLS_FIXTURES.ca2, TLS_FIXTURES.ca3] as const;
    const patchedTag = unique('ca-patched');
    let index = 0;

    // CA certificates have no unique lookup key besides id.
    await exerciseCollection(kong.caCertificates)({
      makeCreateInput: (tag) => {
        const cert = caCerts[index]!;
        index += 1;
        return {
          cert,
          tags: tag ? [tag, 'ca-initial'] : ['ca-initial'],
        };
      },
      update: {
        patch: (_current, tag) => ({
          tags: tag ? [tag, patchedTag] : [patchedTag],
        }),
        assertUpdated: (updated, before) => {
          expect(updated.tags).toContain(patchedTag);
          expect(updated.cert).toBe(before.cert);
          expect(updated.cert_digest).toBe(before.cert_digest);
        },
      },
      upsert: {
        makeInput: (current) => ({
          cert: current.cert,
        }),
        assertUpserted: (upserted, before) => {
          expect(upserted.cert).toBe(before.cert);
          expect(upserted.tags).toBeNull();
        },
      },
    });
  });
});
