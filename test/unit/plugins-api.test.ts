import { describe, expect, it } from 'vitest';
import { KongError } from '../../src/errors.js';
import { PluginsResource } from '../../src/generated/resources.js';
import { PluginsApi } from '../../src/plugins.js';
import { Transport } from '../../src/transport.js';
import { createFakeFetch } from '../support/fake-fetch.js';

function makePluginsApi() {
  const fake = createFakeFetch();
  const transport = new Transport({
    adminUrl: 'http://localhost:8001',
    fetch: fake.fetch,
  });
  return { fake, plugins: new PluginsApi(transport) };
}

describe('PluginsApi', () => {
  it('extends PluginsResource and inherits collection and singleton methods', async () => {
    const { fake, plugins } = makePluginsApi();
    expect(plugins).toBeInstanceOf(PluginsResource);
    expect(plugins.basePath).toBe('/plugins');

    fake.json({ id: 'svc-1', host: 'example.com' });
    await plugins.service('p-1').get();
    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/plugins/p-1/service',
    });
  });

  it('unwraps enabled plugin names from GET /plugins/enabled', async () => {
    const { fake, plugins } = makePluginsApi();
    fake.json({ enabled_plugins: ['key-auth', 'rate-limiting', 'cors'] });

    const controller = new AbortController();
    const names = await plugins.enabledNames({ signal: controller.signal });

    expect(names).toEqual(['key-auth', 'rate-limiting', 'cors']);
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/plugins/enabled',
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('fetches legacy plugin schema via GET /plugins/schema/{name}', async () => {
    const { fake, plugins } = makePluginsApi();
    const schema = { fields: [{ key_names: { type: 'array' } }], entity_checks: [] };
    fake.json(schema);

    const controller = new AbortController();
    const result = await plugins.schema('key-auth/v1', { signal: controller.signal });

    expect(result).toEqual(schema);
    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/plugins/schema/key-auth%2Fv1',
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('rejects an empty plugin name in schema() without sending a request', async () => {
    const { fake, plugins } = makePluginsApi();

    await expect(plugins.schema('')).rejects.toThrow(KongError);
    expect(fake.requests).toHaveLength(0);
  });
});
