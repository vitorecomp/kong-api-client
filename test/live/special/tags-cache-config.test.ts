import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../../support/crud.js';
import { eventually, getLiveEnv, liveDblessKong, liveKong, unique } from '../../support/live.js';

describe('live special: tags, cache, and declarative config endpoints', () => {
  const env = getLiveEnv();
  const kong = liveKong();
  const dbless = liveDblessKong();

  it('lists tags and tagged entities (including a tag with a colon) via /tags and /tags/{tag}', async () => {
    const tag = `special:${unique('tag')}`;
    const serviceA = unique('tag-svc-a');
    const serviceB = unique('tag-svc-b');
    const createdIds: string[] = [];

    try {
      const svc1 = await kong.services.create({
        name: serviceA,
        url: `${env.upstreamInternalUrl}/echo`,
        tags: [tag],
      });
      createdIds.push(svc1.id);

      const svc2 = await kong.services.create({
        name: serviceB,
        url: `${env.upstreamInternalUrl}/echo`,
        tags: [tag],
      });
      createdIds.push(svc2.id);

      const allTagsPage = await kong.tags.list({ size: 100 });
      expect(Array.isArray(allTagsPage.data)).toBe(true);
      expect(allTagsPage.data.some((entry) => entry.tag === tag)).toBe(true);

      const firstPage = await kong.tags.entities(tag, { size: 1 });
      expect(firstPage.data).toHaveLength(1);
      expect(typeof firstPage.offset).toBe('string');

      const secondPage = await kong.tags.entities(tag, { size: 1, offset: firstPage.offset });
      expect(secondPage.data).toHaveLength(1);

      const entityIds = [...firstPage.data, ...secondPage.data].map((e) => e.entity_id);
      expect(entityIds.sort()).toEqual([svc1.id, svc2.id].sort());
      for (const entry of [...firstPage.data, ...secondPage.data]) {
        expect(entry.tag).toBe(tag);
        expect(entry.entity_name).toBe('services');
      }
    } finally {
      for (const id of createdIds) {
        await deleteIgnoringNotFound(() => kong.services.delete(id));
      }
    }
  });

  it('reads a colon-separated cache key, deletes a key, and purges cache via /cache*', async () => {
    // Trigger a proxy lookup so Kong ensures `router:version` is present in its shared cache,
    // regardless of what other tests invalidated earlier. Reading `router:version` also proves
    // that colons in cache keys are preserved unencoded in the request path.
    const cachedMessage = await eventually(async () => {
      await fetch(`${env.proxyUrl}/__cache-warmup`);
      const entry = await kong.cache.get('router:version');
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !('message' in entry) ||
        typeof entry.message !== 'string' ||
        entry.message.length === 0
      ) {
        throw new Error(
          `Expected cache entry with non-empty message, got ${JSON.stringify(entry)}`,
        );
      }
      return entry.message;
    });
    expect(cachedMessage.length).toBeGreaterThan(0);

    await expect(kong.cache.delete(`special:${unique('cache-key')}`)).resolves.toBeUndefined();
    await expect(kong.cache.purge()).resolves.toBeUndefined();

    const status = await kong.node.status();
    expect(status.database.reachable).toBe(true);
  });

  it('reads and loads declarative config via /config on the DB-less instance', async () => {
    const objServiceName = unique('cfg-obj-svc');
    const yamlServiceName = unique('cfg-yaml-svc');

    try {
      const initial = await dbless.config.get();
      expect(typeof initial.config).toBe('string');
      expect(initial.config).toContain('_format_version');

      const loadedObj = await dbless.config.load({
        _format_version: '3.0',
        services: [{ name: objServiceName, url: `${env.upstreamInternalUrl}/echo` }],
      });
      expect(typeof loadedObj).toBe('object');

      const afterObj = await dbless.services.list();
      expect(afterObj.data.some((svc) => svc.name === objServiceName)).toBe(true);

      const exported = await dbless.config.get();
      expect(exported.config).toContain(objServiceName);

      const yamlConfig = `_format_version: "3.0"\nservices:\n  - name: ${yamlServiceName}\n    url: ${env.upstreamInternalUrl}/echo\n`;
      await dbless.config.load(yamlConfig);

      const afterYaml = await dbless.services.list();
      expect(afterYaml.data.some((svc) => svc.name === yamlServiceName)).toBe(true);
    } finally {
      await dbless.config.load({ _format_version: '3.0' });
    }
  });
});
