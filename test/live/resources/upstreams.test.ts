import { describe, expect, it } from 'vitest';
import {
  deleteIgnoringNotFound,
  exerciseCollection,
  exerciseSingleton,
} from '../../support/crud.js';
import { captureHttpError } from '../../support/errors.js';
import { TLS_FIXTURES } from '../../support/fixtures/tls/index.js';
import { liveKong, unique } from '../../support/live.js';

describe('upstreams, nested targets, and upstream client_certificate', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /upstreams', async () => {
    await exerciseCollection(kong.upstreams)({
      makeCreateInput: (tag) => ({
        name: `${unique('up')}.example.invalid`,
        slots: 200,
        algorithm: 'least-connections',
        host_header: 'api.example.invalid',
        tags: tag ? [tag] : undefined,
      }),
      getKey: (upstream) => upstream.name,
      update: {
        patch: { slots: 500 },
        assertUpdated: (updated) => {
          expect(updated.slots).toBe(500);
          expect(updated.algorithm).toBe('least-connections');
          expect(updated.host_header).toBe('api.example.invalid');
        },
      },
      upsert: {
        makeInput: (current) => ({
          name: current.name,
        }),
        assertUpserted: (upserted) => {
          expect(upserted.slots).toBe(10_000);
          expect(upserted.algorithm).toBe('round-robin');
          expect(upserted.host_header).toBeNull();
          expect(upserted.tags).toBeNull();
        },
      },
    });
  });

  it('exercises full CRUD and pagination on /upstreams/{upstream}/targets', async () => {
    const parentUpstream = await kong.upstreams.create({
      name: `${unique('up-targets')}.example.invalid`,
    });
    let hostOctet = 10;

    try {
      await exerciseCollection(kong.upstreams.targets(parentUpstream.id))({
        makeCreateInput: (tag) => {
          hostOctet += 1;
          return {
            target: `10.0.0.${hostOctet}:8080`,
            weight: 50,
            tags: tag ? [tag] : undefined,
          };
        },
        // Exercises get('host:port') through segment() encoding ':' as '%3A'
        getKey: (target) => target.target,
        update: {
          patch: { weight: 75 },
          assertUpdated: (updated, before) => {
            expect(updated.weight).toBe(75);
            expect(updated.tags).toEqual(before.tags);
          },
        },
        upsert: {
          // Kong's PUT /upstreams/{upstream}/targets/{id} updates an existing target
          // with PATCH-like merge semantics (omitted fields are kept, not reset).
          getKey: (current) => current.id,
          makeInput: (current) => ({
            target: current.target,
            weight: 100,
            tags: null,
          }),
          assertUpserted: (upserted) => {
            expect(upserted.weight).toBe(100);
            expect(upserted.tags).toBeNull();
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.upstreams.delete(parentUpstream.id));
    }
  });

  it('pins Kong behaviour: PUT /upstreams/{upstream}/targets/{key} merges omitted fields and returns 404 for a missing target', async () => {
    const parentUpstream = await kong.upstreams.create({
      name: `${unique('up-targets-put')}.example.invalid`,
    });
    const targets = kong.upstreams.targets(parentUpstream.id);
    const initialTag = unique('target-put-tag');
    const missingAddress = '10.0.1.99:8080';

    try {
      const created = await targets.create({
        target: '10.0.1.10:8080',
        weight: 50,
        tags: [initialTag],
      });

      const afterPutById = await targets.upsert(created.id, { target: created.target });
      expect(afterPutById.id).toBe(created.id);
      expect(afterPutById.weight).toBe(50);
      expect(afterPutById.tags).toEqual([initialTag]);

      const fetchedAfterPutById = await targets.get(created.id);
      expect(fetchedAfterPutById.weight).toBe(50);
      expect(fetchedAfterPutById.tags).toEqual([initialTag]);

      const afterPutByAddress = await targets.upsert(created.target, { target: created.target });
      expect(afterPutByAddress.id).toBe(created.id);
      expect(afterPutByAddress.weight).toBe(50);
      expect(afterPutByAddress.tags).toEqual([initialTag]);

      const fetchedAfterPutByAddress = await targets.get(created.id);
      expect(fetchedAfterPutByAddress.weight).toBe(50);
      expect(fetchedAfterPutByAddress.tags).toEqual([initialTag]);

      const notFound = await captureHttpError(
        targets.upsert(missingAddress, { target: missingAddress }),
      );
      expect(notFound.status).toBe(404);
      expect(notFound.method).toBe('PUT');
      expect(notFound.path).toBe(
        `/upstreams/${parentUpstream.id}/targets/${encodeURIComponent(missingAddress)}`,
      );
      await expect(targets.find(missingAddress)).resolves.toBeUndefined();
    } finally {
      await deleteIgnoringNotFound(() => kong.upstreams.delete(parentUpstream.id));
    }
  });

  it('exercises get, update, and upsert on /upstreams/{upstream}/client_certificate', async () => {
    const initialTag = unique('up-cert-init');
    const patchedTag = unique('up-cert-patch');
    const cert = await kong.certificates.create({
      cert: TLS_FIXTURES.rsaCert,
      key: TLS_FIXTURES.rsaKey,
      cert_alt: TLS_FIXTURES.ecdsaCert,
      key_alt: TLS_FIXTURES.ecdsaKey,
      tags: [initialTag],
    });
    const upstream = await kong.upstreams.create({
      name: `${unique('up-cert')}.example.invalid`,
      client_certificate: { id: cert.id },
    });

    try {
      await exerciseSingleton(kong.upstreams.clientCertificate(upstream.id))({
        assertInitial: (fetched) => {
          expect(fetched.id).toBe(cert.id);
          expect(fetched.cert_alt).toBe(TLS_FIXTURES.ecdsaCert);
          expect(fetched.tags).toEqual([initialTag]);
        },
        update: {
          patch: { tags: [patchedTag] },
          assertUpdated: (updated) => {
            expect(updated.id).toBe(cert.id);
            expect(updated.tags).toEqual([patchedTag]);
            expect(updated.cert_alt).toBe(TLS_FIXTURES.ecdsaCert);
          },
        },
        upsert: {
          makeInput: () => ({
            cert: TLS_FIXTURES.rsa2Cert,
            key: TLS_FIXTURES.rsa2Key,
          }),
          assertUpserted: (upserted) => {
            expect(upserted.id).toBe(cert.id);
            expect(upserted.cert).toBe(TLS_FIXTURES.rsa2Cert);
            expect(upserted.cert_alt).toBeNull();
            expect(upserted.key_alt).toBeNull();
            expect(upserted.tags).toBeNull();
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.upstreams.delete(upstream.id));
      await deleteIgnoringNotFound(() => kong.certificates.delete(cert.id));
    }
  });
});
