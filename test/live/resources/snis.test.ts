import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound, exerciseCollection } from '../../support/crud.js';
import { TLS_FIXTURES } from '../../support/fixtures/tls/index.js';
import { liveKong, unique } from '../../support/live.js';

describe('snis', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /snis', async () => {
    const cert = await kong.certificates.create({
      cert: TLS_FIXTURES.rsaCert,
      key: TLS_FIXTURES.rsaKey,
    });
    const renamed = `${unique('sni-renamed')}.example.invalid`;

    try {
      await exerciseCollection(kong.snis)({
        makeCreateInput: (tag) => ({
          name: `${unique('sni')}.example.invalid`,
          certificate: { id: cert.id },
          tags: tag ? [tag, 'sni-keep'] : ['sni-keep'],
        }),
        getKey: (sni) => sni.name,
        update: {
          patch: { name: renamed },
          assertUpdated: (updated, before) => {
            expect(updated.name).toBe(renamed);
            expect(updated.tags).toEqual(before.tags);
            expect(updated.certificate.id).toBe(cert.id);
          },
        },
        upsert: {
          makeInput: (current) => ({
            name: current.name,
            certificate: { id: cert.id },
          }),
          assertUpserted: (upserted) => {
            expect(upserted.tags).toBeNull();
            expect(upserted.certificate.id).toBe(cert.id);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.certificates.delete(cert.id));
    }
  });
});
