import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound, exerciseCollection } from '../../support/crud.js';
import { TLS_FIXTURES } from '../../support/fixtures/tls/index.js';
import { liveKong, unique } from '../../support/live.js';

describe('certificates and nested services, snis, and upstreams', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /certificates', async () => {
    // Certificates have no unique lookup key besides id.
    await exerciseCollection(kong.certificates)({
      makeCreateInput: (tag) => ({
        cert: TLS_FIXTURES.rsaCert,
        key: TLS_FIXTURES.rsaKey,
        cert_alt: TLS_FIXTURES.ecdsaCert,
        key_alt: TLS_FIXTURES.ecdsaKey,
        tags: tag ? [tag] : undefined,
      }),
      update: {
        patch: { cert: TLS_FIXTURES.rsa2Cert, key: TLS_FIXTURES.rsa2Key },
        assertUpdated: (updated, before) => {
          expect(updated.cert).toBe(TLS_FIXTURES.rsa2Cert);
          expect(updated.cert_alt).toBe(TLS_FIXTURES.ecdsaCert);
          expect(updated.tags).toEqual(before.tags);
        },
      },
      upsert: {
        makeInput: () => ({
          cert: TLS_FIXTURES.rsaCert,
          key: TLS_FIXTURES.rsaKey,
        }),
        assertUpserted: (upserted) => {
          expect(upserted.cert).toBe(TLS_FIXTURES.rsaCert);
          expect(upserted.cert_alt).toBeNull();
          expect(upserted.key_alt).toBeNull();
          expect(upserted.tags).toBeNull();
        },
      },
    });
  });

  it('exercises full CRUD and pagination on /certificates/{certificate}/services', async () => {
    const cert = await kong.certificates.create({
      cert: TLS_FIXTURES.rsaCert,
      key: TLS_FIXTURES.rsaKey,
    });

    try {
      await exerciseCollection(kong.certificates.services(cert.id))({
        makeCreateInput: (tag) => ({
          name: unique('cert-svc'),
          protocol: 'https',
          host: 'upstream',
          port: 8443,
          retries: 7,
          connect_timeout: 12_000,
          tags: tag ? [tag] : undefined,
        }),
        getKey: (service) => {
          expect(service.name).toBeTruthy();
          return service.name!;
        },
        update: {
          patch: { retries: 3 },
          assertUpdated: (updated) => {
            expect(updated.retries).toBe(3);
            expect(updated.connect_timeout).toBe(12_000);
            expect(updated.client_certificate?.id).toBe(cert.id);
          },
        },
        upsert: {
          makeInput: (current) => ({
            name: current.name,
            protocol: 'https',
            host: 'upstream',
            port: 8443,
          }),
          assertUpserted: (upserted) => {
            expect(upserted.retries).toBe(5);
            expect(upserted.connect_timeout).toBe(60_000);
            expect(upserted.tags).toBeNull();
            expect(upserted.client_certificate?.id).toBe(cert.id);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.certificates.delete(cert.id));
    }
  });

  it('exercises full CRUD and pagination on /certificates/{certificate}/snis', async () => {
    const cert = await kong.certificates.create({
      cert: TLS_FIXTURES.rsaCert,
      key: TLS_FIXTURES.rsaKey,
    });
    const renamed = `${unique('cert-sni-renamed')}.example.invalid`;

    try {
      await exerciseCollection(kong.certificates.snis(cert.id))({
        makeCreateInput: (tag) => ({
          name: `${unique('cert-sni')}.example.invalid`,
          tags: tag ? [tag, 'keep-sni'] : ['keep-sni'],
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

  it('exercises full CRUD and pagination on /certificates/{certificate}/upstreams', async () => {
    const cert = await kong.certificates.create({
      cert: TLS_FIXTURES.rsaCert,
      key: TLS_FIXTURES.rsaKey,
    });

    try {
      await exerciseCollection(kong.certificates.upstreams(cert.id))({
        makeCreateInput: (tag) => ({
          name: `${unique('cert-up')}.example.invalid`,
          slots: 300,
          algorithm: 'least-connections',
          tags: tag ? [tag] : undefined,
        }),
        getKey: (upstream) => upstream.name,
        update: {
          patch: { slots: 600 },
          assertUpdated: (updated) => {
            expect(updated.slots).toBe(600);
            expect(updated.algorithm).toBe('least-connections');
            expect(updated.client_certificate?.id).toBe(cert.id);
          },
        },
        upsert: {
          makeInput: (current) => ({
            name: current.name,
          }),
          assertUpserted: (upserted) => {
            expect(upserted.slots).toBe(10_000);
            expect(upserted.algorithm).toBe('round-robin');
            expect(upserted.tags).toBeNull();
            expect(upserted.client_certificate?.id).toBe(cert.id);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.certificates.delete(cert.id));
    }
  });
});
