import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound, exerciseCollection } from '../../support/crud.js';
import { liveKong, unique } from '../../support/live.js';

describe('routes and nested route plugins', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /routes', async () => {
    await exerciseCollection(kong.routes)({
      makeCreateInput: (tag) => ({
        name: unique('route'),
        paths: [`/${unique('rpath')}`],
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
        patch: { regex_priority: 25 },
        assertUpdated: (updated) => {
          expect(updated.regex_priority).toBe(25);
          expect(updated.strip_path).toBe(false);
          expect(updated.preserve_host).toBe(true);
        },
      },
      upsert: {
        makeInput: (current) => ({
          name: current.name,
          paths: current.paths,
          protocols: ['http', 'https'],
        }),
        assertUpserted: (upserted) => {
          expect(upserted.strip_path).toBe(true);
          expect(upserted.preserve_host).toBe(false);
          expect(upserted.regex_priority).toBe(0);
          expect(upserted.tags).toBeNull();
        },
      },
    });
  });

  it('exercises full CRUD and pagination on /routes/{route}/plugins', async () => {
    const parentRoute = await kong.routes.create({
      name: unique('route-plug-parent'),
      paths: [`/${unique('rp')}`],
      protocols: ['http', 'https'],
    });
    const pluginNames = ['correlation-id', 'cors', 'request-termination'] as const;
    let index = 0;

    try {
      await exerciseCollection(kong.routes.plugins(parentRoute.id))({
        makeCreateInput: (tag) => {
          const name = pluginNames[index]!;
          index += 1;
          return {
            name,
            instance_name: unique(`route-${name}`),
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
      await deleteIgnoringNotFound(() => kong.routes.delete(parentRoute.id));
    }
  });
});
