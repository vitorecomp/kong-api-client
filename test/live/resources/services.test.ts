import { describe, expect, it } from 'vitest';
import { KongHttpError } from '../../../src/index.js';
import {
  deleteIgnoringNotFound,
  exerciseCollection,
  exerciseSingleton,
} from '../../support/crud.js';
import { TLS_FIXTURES } from '../../support/fixtures/tls/index.js';
import { liveKong, unique } from '../../support/live.js';

async function captureHttpError(promise: Promise<unknown>): Promise<KongHttpError> {
  let captured: unknown;
  await expect(
    promise.catch((error: unknown) => {
      captured = error;
      throw error;
    }),
  ).rejects.toBeInstanceOf(KongHttpError);
  return captured as KongHttpError;
}

describe('services, nested routes, and route service singleton', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /services', async () => {
    await exerciseCollection(kong.services)({
      makeCreateInput: (tag) => ({
        name: unique('svc'),
        host: 'upstream',
        port: 8080,
        path: '/echo',
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
          expect(updated.path).toBe('/echo');
        },
      },
      upsert: {
        makeInput: (current, tag) => ({
          name: current.name,
          host: 'upstream',
          port: 8080,
          tags: tag ? [tag] : undefined,
        }),
        assertUpserted: (upserted) => {
          expect(upserted.retries).toBe(5);
          expect(upserted.connect_timeout).toBe(60_000);
          expect(upserted.path).toBeNull();
        },
      },
    });
  });

  it('exercises full CRUD and pagination on /services/{service}/routes', async () => {
    const parentService = await kong.services.create({
      name: unique('parent-svc'),
      host: 'upstream',
      port: 8080,
    });

    try {
      await exerciseCollection(kong.services.routes(parentService.id))({
        makeCreateInput: (tag) => ({
          name: unique('nested-route'),
          paths: [`/${unique('path')}`],
          protocols: ['http', 'https'],
          strip_path: false,
          preserve_host: true,
          regex_priority: 10,
          tags: tag ? [tag] : undefined,
        }),
        getKey: (route) => {
          expect(route.name).toBeTruthy();
          return route.name!;
        },
        update: {
          patch: { regex_priority: 20 },
          assertUpdated: (updated) => {
            expect(updated.regex_priority).toBe(20);
            expect(updated.strip_path).toBe(false);
            expect(updated.preserve_host).toBe(true);
          },
        },
        upsert: {
          makeInput: (current, tag) => ({
            name: current.name,
            paths: current.paths,
            protocols: ['http', 'https'],
            tags: tag ? [tag] : undefined,
          }),
          assertUpserted: (upserted) => {
            expect(upserted.strip_path).toBe(true);
            expect(upserted.preserve_host).toBe(false);
            expect(upserted.regex_priority).toBe(0);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.services.delete(parentService.id));
    }
  });

  it('exercises get, update, and upsert on /routes/{route}/service', async () => {
    const service = await kong.services.create({
      name: unique('single-svc'),
      host: 'upstream',
      port: 8080,
      retries: 8,
      connect_timeout: 15_000,
    });
    const route = await kong.services.routes(service.id).create({
      name: unique('single-route'),
      paths: [`/${unique('single')}`],
      protocols: ['http', 'https'],
    });

    try {
      await exerciseSingleton(kong.routes.service(route.id))({
        assertInitial: (fetched) => {
          expect(fetched.id).toBe(service.id);
          expect(fetched.retries).toBe(8);
          expect(fetched.connect_timeout).toBe(15_000);
        },
        update: {
          patch: { retries: 4 },
          assertUpdated: (updated) => {
            expect(updated.id).toBe(service.id);
            expect(updated.retries).toBe(4);
            expect(updated.connect_timeout).toBe(15_000);
            expect(updated.name).toBe(service.name);
          },
        },
        upsert: {
          makeInput: (current) => ({
            name: current.name,
            host: 'upstream',
            port: 8080,
          }),
          assertUpserted: (upserted) => {
            expect(upserted.id).toBe(service.id);
            expect(upserted.retries).toBe(5);
            expect(upserted.connect_timeout).toBe(60_000);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.routes.delete(route.id));
      await deleteIgnoringNotFound(() => kong.services.delete(service.id));
    }
  });

  it('exercises full CRUD and pagination on /services/{service}/plugins', async () => {
    const parentService = await kong.services.create({
      name: unique('svc-plug-parent'),
      host: 'upstream',
      port: 8080,
    });
    const pluginNames = ['correlation-id', 'cors', 'request-termination'] as const;
    let index = 0;

    try {
      await exerciseCollection(kong.services.plugins(parentService.id))({
        makeCreateInput: (tag) => {
          const name = pluginNames[index]!;
          index += 1;
          return {
            name,
            instance_name: unique(`svc-${name}`),
            enabled: false,
            protocols: ['http'],
            tags: tag ? [tag] : undefined,
          };
        },
        getKey: (plugin) => {
          expect(plugin.instance_name).toBeTruthy();
          return plugin.instance_name!;
        },
        update: {
          patch: { protocols: ['http', 'https'] },
          assertUpdated: (updated) => {
            expect(updated.protocols).toEqual(expect.arrayContaining(['http', 'https']));
            expect(updated.protocols).toHaveLength(2);
            expect(updated.enabled).toBe(false);
          },
        },
        upsert: {
          makeInput: (current) => ({
            name: current.name,
            instance_name: current.instance_name,
          }),
          assertUpserted: (upserted) => {
            expect(upserted.enabled).toBe(true);
            expect(upserted.tags).toBeNull();
            expect(upserted.protocols).toEqual(
              expect.arrayContaining(['grpc', 'grpcs', 'http', 'https']),
            );
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.services.delete(parentService.id));
    }
  });

  it('exercises get, update, and upsert on /services/{service}/client_certificate', async () => {
    const initialTag = unique('svc-cert-init');
    const patchedTag = unique('svc-cert-patch');
    const cert = await kong.certificates.create({
      cert: TLS_FIXTURES.rsaCert,
      key: TLS_FIXTURES.rsaKey,
      cert_alt: TLS_FIXTURES.ecdsaCert,
      key_alt: TLS_FIXTURES.ecdsaKey,
      tags: [initialTag],
    });
    const service = await kong.services.create({
      name: unique('svc-client-cert'),
      protocol: 'https',
      host: 'upstream',
      port: 8443,
      client_certificate: { id: cert.id },
    });

    try {
      await exerciseSingleton(kong.services.clientCertificate(service.id))({
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
      await deleteIgnoringNotFound(() => kong.services.delete(service.id));
      await deleteIgnoringNotFound(() => kong.certificates.delete(cert.id));
    }
  });

  it('reports Kong schema violation details on invalid service input', async () => {
    const error = await captureHttpError(
      kong.services.create({
        host: 'upstream',
        port: 99_999,
      }),
    );

    expect(error.status).toBe(400);
    expect(error.kongName).toBe('schema violation');
    expect(error.code).toBe(2);
    expect(error.fields).toBeDefined();
    expect(error.fields).toHaveProperty('port');
  });
});
