import { describe, expect, it } from 'vitest';
import {
  deleteIgnoringNotFound,
  exerciseCollection,
  exerciseSingleton,
} from '../../support/crud.js';
import { liveKong, unique } from '../../support/live.js';

describe('plugins and plugin parent singletons', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /plugins', async () => {
    const scopeService = await kong.services.create({
      name: unique('plugins-scope-svc'),
      host: 'upstream',
      port: 8080,
    });
    const pluginNames = ['correlation-id', 'cors', 'request-termination'] as const;
    let index = 0;

    try {
      await exerciseCollection(kong.plugins)({
        makeCreateInput: (tag) => {
          const name = pluginNames[index]!;
          index += 1;
          return {
            name,
            instance_name: unique(`top-${name}`),
            service: { id: scopeService.id },
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
            service: { id: scopeService.id },
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
      await deleteIgnoringNotFound(() => kong.services.delete(scopeService.id));
    }
  });

  it('exercises consumer, route, and service singletons on /plugins/{plugin}/*', async () => {
    const consumerCustomId = unique('plug-cid');
    const consumerTag = unique('plug-ctag');
    const consumerPatchedTag = unique('plug-ctag-2');

    const consumer = await kong.consumers.create({
      username: unique('plug-consumer'),
      custom_id: consumerCustomId,
      tags: [consumerTag],
    });
    const service = await kong.services.create({
      name: unique('plug-svc'),
      host: 'upstream',
      port: 8080,
      retries: 7,
      connect_timeout: 12_000,
    });
    const route = await kong.services.routes(service.id).create({
      name: unique('plug-route'),
      paths: [`/${unique('plug-r')}`],
      protocols: ['http', 'https'],
      strip_path: false,
      regex_priority: 10,
    });
    const plugin = await kong.plugins.create({
      name: 'correlation-id',
      instance_name: unique('plug-scoped'),
      consumer: { id: consumer.id },
      service: { id: service.id },
      route: { id: route.id },
    });

    try {
      await exerciseSingleton(kong.plugins.consumer(plugin.id))({
        assertInitial: (fetched) => {
          expect(fetched.id).toBe(consumer.id);
          expect(fetched.custom_id).toBe(consumerCustomId);
          expect(fetched.tags).toEqual([consumerTag]);
        },
        update: {
          patch: { tags: [consumerPatchedTag] },
          assertUpdated: (updated) => {
            expect(updated.id).toBe(consumer.id);
            expect(updated.tags).toEqual([consumerPatchedTag]);
            expect(updated.custom_id).toBe(consumerCustomId);
          },
        },
        upsert: {
          makeInput: (current) => ({
            username: current.username,
          }),
          assertUpserted: (upserted) => {
            expect(upserted.id).toBe(consumer.id);
            expect(upserted.custom_id).toBeNull();
            expect(upserted.tags).toBeNull();
          },
        },
      });

      await exerciseSingleton(kong.plugins.route(plugin.id))({
        assertInitial: (fetched) => {
          expect(fetched.id).toBe(route.id);
          expect(fetched.strip_path).toBe(false);
          expect(fetched.regex_priority).toBe(10);
        },
        update: {
          patch: { regex_priority: 22 },
          assertUpdated: (updated) => {
            expect(updated.id).toBe(route.id);
            expect(updated.regex_priority).toBe(22);
            expect(updated.strip_path).toBe(false);
          },
        },
        upsert: {
          makeInput: (current) => ({
            name: current.name,
            paths: current.paths,
            protocols: ['http', 'https'],
            service: { id: service.id },
          }),
          assertUpserted: (upserted) => {
            expect(upserted.id).toBe(route.id);
            expect(upserted.strip_path).toBe(true);
            expect(upserted.regex_priority).toBe(0);
          },
        },
      });

      await exerciseSingleton(kong.plugins.service(plugin.id))({
        assertInitial: (fetched) => {
          expect(fetched.id).toBe(service.id);
          expect(fetched.retries).toBe(7);
          expect(fetched.connect_timeout).toBe(12_000);
        },
        update: {
          patch: { retries: 3 },
          assertUpdated: (updated) => {
            expect(updated.id).toBe(service.id);
            expect(updated.retries).toBe(3);
            expect(updated.connect_timeout).toBe(12_000);
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
      await deleteIgnoringNotFound(() => kong.plugins.delete(plugin.id));
      await deleteIgnoringNotFound(() => kong.routes.delete(route.id));
      await deleteIgnoringNotFound(() => kong.services.delete(service.id));
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });
});
