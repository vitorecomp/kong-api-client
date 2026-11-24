import { describe, expect, it } from 'vitest';
import {
  AcmeApi,
  CacheApi,
  ClusteringApi,
  ConfigApi,
  DebugApi,
  Kong,
  NodeApi,
  PluginsApi,
  ProxyCacheApi,
  SchemasApi,
  TagsApi,
  UpstreamsApi,
} from '../../src/index.js';
import { createFakeFetch } from '../support/fake-fetch.js';
import { SPECIAL_ENDPOINTS } from '../support/special-manifest.js';

describe('Kong special API wiring', () => {
  it('exposes every special namespace and extended resource on Kong', () => {
    const fake = createFakeFetch();
    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    expect(kong.node).toBeInstanceOf(NodeApi);
    expect(kong.schemas).toBeInstanceOf(SchemasApi);
    expect(kong.tags).toBeInstanceOf(TagsApi);
    expect(kong.cache).toBeInstanceOf(CacheApi);
    expect(kong.config).toBeInstanceOf(ConfigApi);
    expect(kong.debug).toBeInstanceOf(DebugApi);
    expect(kong.clustering).toBeInstanceOf(ClusteringApi);
    expect(kong.acme).toBeInstanceOf(AcmeApi);
    expect(kong.proxyCache).toBeInstanceOf(ProxyCacheApi);
    expect(kong.plugins).toBeInstanceOf(PluginsApi);
    expect(kong.upstreams).toBeInstanceOf(UpstreamsApi);
    expect(SPECIAL_ENDPOINTS).toHaveLength(41);
  });

  it('shares Kong transport configuration (headers and base path) across special APIs', async () => {
    const fake = createFakeFetch()
      .json({ version: '3.9.5' })
      .json({ enabled_plugins: ['key-auth'] })
      .json({ data: [], node_id: 'n1', next: null });

    const kong = new Kong({
      adminUrl: 'http://localhost:8001/admin/',
      headers: { 'X-Client-Token': 'tok-1' },
      fetch: fake.fetch,
    });

    await kong.node.info();
    await kong.plugins.enabledNames();
    await kong.upstreams.health('my-up');

    expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET http://localhost:8001/admin/',
      'GET http://localhost:8001/admin/plugins/enabled',
      'GET http://localhost:8001/admin/upstreams/my-up/health',
    ]);
    for (const req of fake.requests) {
      expect(req.headers['x-client-token']).toBe('tok-1');
    }
  });
});
