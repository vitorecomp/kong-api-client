import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  Collection,
  Kong,
  KongConnectionError,
  KongError,
  KongHttpError,
  KongResources,
  KongTimeoutError,
  PLUGINS,
  PluginCollection,
  PluginsResource,
  RESOURCE_TEMPLATES,
  ServicesResource,
  Singleton,
  Transport,
  VERSION,
  segment,
  type Plugin,
  type Service,
} from '../../src/index.js';
import { createFakeFetch } from '../support/fake-fetch.js';

describe('Kong client', () => {
  it('extends KongResources and shares one Transport across resources and request()', async () => {
    const fake = createFakeFetch()
      .json({ version: '3.9.5' })
      .json({ data: [{ id: 's1', name: 'billing' }], next: null });

    let headerCalls = 0;
    const kong = new Kong({
      adminUrl: 'http://localhost:8001/admin/',
      headers: () => {
        headerCalls += 1;
        return { 'X-Seq': String(headerCalls) };
      },
      fetch: fake.fetch,
    });

    expect(kong).toBeInstanceOf(KongResources);
    expect(kong.services).toBeInstanceOf(ServicesResource);
    expect(kong.plugins).toBeInstanceOf(PluginsResource);
    expect(kong.plugins).toBeInstanceOf(PluginCollection);
    expect('targets' in kong).toBe(false);

    const info = await kong.request<{ version: string }>({ path: '/' });
    expect(info).toEqual({ version: '3.9.5' });

    const page = await kong.services.list({ size: 5 });
    expect(page.data).toHaveLength(1);

    expect(headerCalls).toBe(2);
    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/admin/',
    });
    expect(fake.requests[0]!.headers['x-seq']).toBe('1');
    expect(fake.requests[1]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/admin/services?size=5',
    });
    expect(fake.requests[1]!.headers['x-seq']).toBe('2');
  });

  it('passes request() options through to Transport', async () => {
    const fake = createFakeFetch().json({ ok: true });
    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    const result = await kong.request<{ ok: boolean }>({
      method: 'POST',
      path: '/custom/endpoint',
      query: { dry_run: true },
      headers: { 'X-Custom': 'yes' },
      body: { a: 1 },
    });

    expect(result).toEqual({ ok: true });
    expect(fake.requests[0]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:8001/custom/endpoint?dry_run=true',
      json: { a: 1 },
    });
    expect(fake.requests[0]!.headers['x-custom']).toBe('yes');
  });

  it('does not expose transport publicly on the Kong type', () => {
    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: createFakeFetch().fetch });

    const typeChecks = () => {
      // @ts-expect-error transport is protected and not part of the public Kong API
      void kong.transport;
      // @ts-expect-error targets is nested-only and absent from Kong
      void kong.targets;
      expectTypeOf(
        kong.plugins.create({ name: 'http-log', config: { http_endpoint: 'https://x' } }),
      ).toEqualTypeOf<Promise<Plugin<'http-log'>>>();
    };
    expect(typeof typeChecks).toBe('function');

    expectTypeOf<ReturnType<Kong['services']['get']>>().toEqualTypeOf<Promise<Service>>();
  });

  it('re-exports the public core and generated surface from src/index.ts', () => {
    expect(typeof VERSION).toBe('string');
    expect(typeof Kong).toBe('function');
    expect(typeof KongError).toBe('function');
    expect(typeof KongHttpError).toBe('function');
    expect(typeof KongConnectionError).toBe('function');
    expect(typeof KongTimeoutError).toBe('function');
    expect(typeof Transport).toBe('function');
    expect(typeof segment).toBe('function');
    expect(typeof Collection).toBe('function');
    expect(typeof Singleton).toBe('function');
    expect(typeof PluginCollection).toBe('function');
    expect(typeof KongResources).toBe('function');
    expect(Object.keys(PLUGINS)).toHaveLength(45);
    expect(RESOURCE_TEMPLATES).toHaveLength(89);
  });
});
