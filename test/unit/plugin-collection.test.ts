import { describe, expect, expectTypeOf, it } from 'vitest';
import { KongError } from '../../src/errors.js';
import type { Plugin } from '../../src/generated/entities.js';
import type { HttpLogConfig } from '../../src/generated/plugins.js';
import { PluginCollection } from '../../src/plugin-collection.js';
import { Transport } from '../../src/transport.js';
import { createFakeFetch } from '../support/fake-fetch.js';

function makeCollection(basePath = '/plugins') {
  const fake = createFakeFetch();
  const transport = new Transport({
    adminUrl: 'http://localhost:8001',
    fetch: fake.fetch,
  });
  return { fake, plugins: new PluginCollection(transport, basePath) };
}

describe('PluginCollection', () => {
  it('creates a known plugin with config narrowed by plugin name', async () => {
    const { fake, plugins } = makeCollection();
    const responsePlugin = {
      id: 'p-1',
      name: 'http-log',
      config: { http_endpoint: 'https://x' },
    };
    fake.json(responsePlugin, 201);

    const controller = new AbortController();
    const p = await plugins.create(
      { name: 'http-log', config: { http_endpoint: 'https://x' } },
      { signal: controller.signal },
    );

    expectTypeOf(p).toEqualTypeOf<Plugin<'http-log'>>();
    expectTypeOf(p.config).toEqualTypeOf<HttpLogConfig>();
    expect(p.id).toBe('p-1');
    expect(p.config.http_endpoint).toBe('https://x');

    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:8001/plugins',
      json: { name: 'http-log', config: { http_endpoint: 'https://x' } },
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('creates a custom plugin with Record<string, unknown> config', async () => {
    const { fake, plugins } = makeCollection('/services/billing/plugins');
    fake.json({ id: 'p-2', name: 'my-custom-plugin', config: { anything: 1 } }, 201);

    const p = await plugins.create({ name: 'my-custom-plugin', config: { anything: 1 } });

    expectTypeOf(p).toEqualTypeOf<Plugin<'my-custom-plugin'>>();
    expectTypeOf(p.config).toEqualTypeOf<Record<string, unknown>>();
    expect(p.config).toEqual({ anything: 1 });
    expect(fake.requests[0]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:8001/services/billing/plugins',
      json: { name: 'my-custom-plugin', config: { anything: 1 } },
    });
  });

  it('upserts a plugin by encoded key and narrows config by plugin name', async () => {
    const { fake, plugins } = makeCollection();
    fake.json({ id: 'p-3', name: 'http-log', config: { http_endpoint: 'https://x' } });

    const controller = new AbortController();
    const p = await plugins.upsert(
      'team/log-1',
      { name: 'http-log', config: { http_endpoint: 'https://x' } },
      { signal: controller.signal },
    );

    expectTypeOf(p).toEqualTypeOf<Plugin<'http-log'>>();
    expectTypeOf(p.config).toEqualTypeOf<HttpLogConfig>();
    expect(fake.requests[0]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/plugins/team%2Flog-1',
      json: { name: 'http-log', config: { http_endpoint: 'https://x' } },
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('updates a plugin by encoded key with or without plugin name', async () => {
    const { fake, plugins } = makeCollection();
    fake
      .json({ id: 'p-4', name: 'http-log', config: { http_endpoint: 'https://y' } })
      .json({ id: 'p-4', name: 'http-log', enabled: false, config: {} });

    const controller = new AbortController();
    const typed = await plugins.update(
      'team/log-1',
      { name: 'http-log', config: { http_endpoint: 'https://y' } },
      { signal: controller.signal },
    );
    expectTypeOf(typed).toEqualTypeOf<Plugin<'http-log'>>();
    expectTypeOf(typed.config).toEqualTypeOf<HttpLogConfig>();

    const untyped = await plugins.update('p-4', { enabled: false });
    expectTypeOf(untyped).toEqualTypeOf<Plugin<string>>();

    fake.json({
      id: 'p-4',
      name: 'http-log',
      config: { http_endpoint: 'https://y', timeout: 5000 },
    });
    const partialConfig = await plugins.update<'http-log'>('p-4', {
      config: { timeout: 5000 },
    });
    expectTypeOf(partialConfig).toEqualTypeOf<Plugin<'http-log'>>();
    expectTypeOf(partialConfig.config).toEqualTypeOf<HttpLogConfig>();

    expect(fake.requests).toHaveLength(3);
    expect(fake.requests[0]).toMatchObject({
      method: 'PATCH',
      url: 'http://localhost:8001/plugins/team%2Flog-1',
      json: { name: 'http-log', config: { http_endpoint: 'https://y' } },
    });
    expect(fake.requests[0]?.signal).toBeDefined();
    expect(fake.requests[1]).toMatchObject({
      method: 'PATCH',
      url: 'http://localhost:8001/plugins/p-4',
      json: { enabled: false },
    });
    expect(fake.requests[2]).toMatchObject({
      method: 'PATCH',
      url: 'http://localhost:8001/plugins/p-4',
      json: { config: { timeout: 5000 } },
    });
  });

  it('rejects empty keys in upsert and update without sending requests', async () => {
    const { fake, plugins } = makeCollection();

    await expect(
      plugins.upsert('', { name: 'http-log', config: { http_endpoint: 'https://x' } }),
    ).rejects.toThrow(KongError);
    await expect(plugins.update('', { enabled: false })).rejects.toThrow(KongError);
    expect(fake.requests).toHaveLength(0);
  });

  it('inherits Collection read and delete operations', async () => {
    const { fake, plugins } = makeCollection();
    fake.json({ data: [{ id: 'p-1', name: 'cors', config: {} }], next: null }).empty(204);

    const page = await plugins.list();
    await plugins.delete('p-1');

    expect(page.data).toHaveLength(1);
    expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET http://localhost:8001/plugins',
      'DELETE http://localhost:8001/plugins/p-1',
    ]);
  });

  it('rejects unknown config fields on known plugins at compile time', () => {
    const { plugins } = makeCollection();

    const checkTypes = async () => {
      await plugins.create({
        name: 'http-log',
        // @ts-expect-error unknown field on a known plugin
        config: { http_endpoint: 'https://x', nope: true },
      });
      await plugins.upsert('k', {
        name: 'http-log',
        // @ts-expect-error unknown field on a known plugin
        config: { http_endpoint: 'https://x', nope: true },
      });
      await plugins.update('k', {
        name: 'http-log',
        // @ts-expect-error unknown field on a known plugin
        config: { http_endpoint: 'https://x', nope: true },
      });
    };

    expect(typeof checkTypes).toBe('function');
  });
});
