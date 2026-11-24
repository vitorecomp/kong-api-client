import { describe, expect, it } from 'vitest';
import { KongHttpError } from '../../../src/index.js';
import { deleteIgnoringNotFound } from '../../support/crud.js';
import { eventually, getLiveEnv, liveKong, unique } from '../../support/live.js';

describe('live special: proxy-cache endpoints', () => {
  const env = getLiveEnv();
  const kong = liveKong();

  it('reads, deletes (global and plugin-scoped), and purges cached proxy responses', async () => {
    const serviceName = unique('pc-svc');
    const routeName = unique('pc-route');
    const routePrefix = `/${unique('pc')}`;
    const probePath = unique('cached');

    let pluginId: string | undefined;
    let routeId: string | undefined;
    let serviceId: string | undefined;

    try {
      const service = await kong.services.create({
        name: serviceName,
        url: `${env.upstreamInternalUrl}/echo`,
      });
      serviceId = service.id;

      const route = await kong.services.routes(service.id).create({
        name: routeName,
        paths: [routePrefix],
        protocols: ['http', 'https'],
      });
      routeId = route.id;

      const plugin = await kong.routes.plugins(route.id).create({
        name: 'proxy-cache',
        config: {
          strategy: 'memory',
          content_type: ['application/json', 'application/json; charset=utf-8'],
        },
      });
      pluginId = plugin.id;

      const fetchCacheKey = async (): Promise<string> =>
        eventually(async () => {
          const response = await fetch(`${env.proxyUrl}${routePrefix}/${probePath}`);
          if (response.status !== 200) {
            throw new Error(`Expected 200 from proxy, got ${response.status}`);
          }
          const key = response.headers.get('x-cache-key');
          if (!key) {
            throw new Error('Waiting for proxy-cache plugin X-Cache-Key header');
          }
          return key;
        });

      const cacheKey = await fetchCacheKey();

      // GET /proxy-cache/{cacheKey}
      const globalEntry = await kong.proxyCache.get(cacheKey);
      expect(globalEntry.status).toBe(200);
      expect(globalEntry.body).toContain(probePath);
      expect(globalEntry.ttl).toBeGreaterThan(0);

      // GET /proxy-cache/{pluginId}/caches/{cacheKey}
      const scopedEntry = await kong.proxyCache.get(cacheKey, plugin.id);
      expect(scopedEntry.status).toBe(200);
      expect(scopedEntry.body).toContain(probePath);

      // DELETE /proxy-cache/{pluginId}/caches/{cacheKey}
      await expect(kong.proxyCache.delete(cacheKey, plugin.id)).resolves.toBeUndefined();
      await expect(kong.proxyCache.get(cacheKey, plugin.id)).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(KongHttpError);
        expect((error as KongHttpError).status).toBe(404);
        return true;
      });

      // Repopulate cache and test DELETE /proxy-cache/{cacheKey}
      const secondKey = await fetchCacheKey();
      const repopulated = await kong.proxyCache.get(secondKey);
      expect(repopulated.status).toBe(200);

      await expect(kong.proxyCache.delete(secondKey)).resolves.toBeUndefined();
      await expect(kong.proxyCache.get(secondKey)).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(KongHttpError);
        expect((error as KongHttpError).status).toBe(404);
        return true;
      });

      // DELETE /proxy-cache
      await expect(kong.proxyCache.purge()).resolves.toBeUndefined();
    } finally {
      if (pluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(pluginId!));
      }
      if (routeId) {
        await deleteIgnoringNotFound(() => kong.routes.delete(routeId!));
      }
      if (serviceId) {
        await deleteIgnoringNotFound(() => kong.services.delete(serviceId!));
      }
    }
  });
});
