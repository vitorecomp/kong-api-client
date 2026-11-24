import { describe, expect, expectTypeOf, it } from 'vitest';
import { KongError } from '../../src/errors.js';
import type { Plugin } from '../../src/generated/entities.js';
import type { HttpLogConfig } from '../../src/generated/plugins.js';
import { PluginsResource } from '../../src/generated/resources.js';
import { PluginsApi } from '../../src/plugins.js';
import type { KongSchema } from '../../src/special/schemas.js';
import { Transport } from '../../src/transport.js';
import { captureHttpError } from '../support/errors.js';
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

  it('enables a global plugin with default instance_name when scope is omitted or empty', async () => {
    const { fake, plugins } = makePluginsApi();
    const res1 = { id: 'p-1', name: 'prometheus', instance_name: 'prometheus', config: {} };
    const res2 = { id: 'p-2', name: 'cors', instance_name: 'cors', config: {} };
    fake.json(res1).json(res2);

    const p1 = await plugins.enable('prometheus');
    const p2 = await plugins.enable('cors', { on: {} });

    expect(p1).toEqual(res1);
    expect(p2).toEqual(res2);
    expect(fake.requests[0]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/plugins/prometheus',
      json: { name: 'prometheus', instance_name: 'prometheus' },
    });
    expect(fake.requests[1]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/plugins/cors',
      json: { name: 'cors', instance_name: 'cors' },
    });
  });

  it('enables plugins scoped by service, route, consumer, and combinations using names or UUIDs', async () => {
    const { fake, plugins } = makePluginsApi();
    const svcUuid = '11111111-2222-4333-8444-555555555555';
    const routeUuid = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE';
    const consumerUuid = '99999999-8888-4777-8666-555555555555';

    fake.json({ id: '1' }).json({ id: '2' }).json({ id: '3' }).json({ id: '4' }).json({ id: '5' });

    await plugins.enable('key-auth', { on: { service: 'billing' } });
    await plugins.enable('key-auth', { on: { route: 'checkout' } });
    await plugins.enable('rate-limiting', {
      on: { consumer: 'alice' },
      config: { minute: 10 },
    });
    await plugins.enable('rate-limiting', {
      on: { service: 'billing', route: 'checkout', consumer: 'alice' },
      config: { minute: 5 },
    });
    await plugins.enable('rate-limiting', {
      on: { service: svcUuid, route: routeUuid, consumer: consumerUuid },
      config: { minute: 2 },
    });

    expect(fake.requests[0]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/plugins/key-auth.service.billing',
      json: {
        name: 'key-auth',
        instance_name: 'key-auth.service.billing',
        service: { name: 'billing' },
      },
    });
    expect(fake.requests[1]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/plugins/key-auth.route.checkout',
      json: {
        name: 'key-auth',
        instance_name: 'key-auth.route.checkout',
        route: { name: 'checkout' },
      },
    });
    expect(fake.requests[2]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/plugins/rate-limiting.consumer.alice',
      json: {
        name: 'rate-limiting',
        instance_name: 'rate-limiting.consumer.alice',
        consumer: { username: 'alice' },
        config: { minute: 10 },
      },
    });
    expect(fake.requests[3]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/plugins/rate-limiting.service.billing.route.checkout.consumer.alice',
      json: {
        name: 'rate-limiting',
        instance_name: 'rate-limiting.service.billing.route.checkout.consumer.alice',
        service: { name: 'billing' },
        route: { name: 'checkout' },
        consumer: { username: 'alice' },
        config: { minute: 5 },
      },
    });
    expect(fake.requests[4]).toMatchObject({
      method: 'PUT',
      url: `http://localhost:8001/plugins/rate-limiting.service.${svcUuid}.route.${routeUuid}.consumer.${consumerUuid}`,
      json: {
        name: 'rate-limiting',
        instance_name: `rate-limiting.service.${svcUuid}.route.${routeUuid}.consumer.${consumerUuid}`,
        service: { id: svcUuid },
        route: { id: routeUuid },
        consumer: { id: consumerUuid },
        config: { minute: 2 },
      },
    });
  });

  it('sanitizes only Kong-rejected ASCII characters in derived instance names while keeping .-_~ and UTF-8', async () => {
    const { fake, plugins } = makePluginsApi();
    fake.json({ id: '1' }).json({ id: '2' });

    await plugins.enable('rate-limiting', {
      on: { consumer: 'alice+ops@example.com:team/1 ok_~' },
    });
    await plugins.enable('rate-limiting', {
      on: { consumer: 'café_日本語~1.2-3' },
    });

    const expectedSanitized = 'rate-limiting.consumer.alice-ops-example.com-team-1-ok_~';
    expect(fake.requests[0]).toMatchObject({
      method: 'PUT',
      url: `http://localhost:8001/plugins/${expectedSanitized}`,
      json: {
        name: 'rate-limiting',
        instance_name: expectedSanitized,
        consumer: { username: 'alice+ops@example.com:team/1 ok_~' },
      },
    });

    const expectedUtf8 = 'rate-limiting.consumer.café_日本語~1.2-3';
    expect(fake.requests[1]).toMatchObject({
      method: 'PUT',
      url: `http://localhost:8001/plugins/${encodeURIComponent(expectedUtf8)}`,
      json: {
        name: 'rate-limiting',
        instance_name: expectedUtf8,
        consumer: { username: 'café_日本語~1.2-3' },
      },
    });
  });

  it('passes explicit instanceName, enabled, protocols, tags, config, and signal through', async () => {
    const { fake, plugins } = makePluginsApi();
    fake.json({
      id: 'p-1',
      name: 'http-log',
      config: { http_endpoint: 'https://logs.example.com' },
    });

    const controller = new AbortController();
    const plugin = await plugins.enable('http-log', {
      on: { route: 'api' },
      instanceName: 'custom.log_1~prod',
      config: { http_endpoint: 'https://logs.example.com' },
      enabled: false,
      protocols: ['http', 'https'],
      tags: ['env:prod', 'logging'],
      signal: controller.signal,
    });

    expectTypeOf(plugin).toEqualTypeOf<Plugin<'http-log'>>();
    expectTypeOf(plugin.config).toEqualTypeOf<HttpLogConfig>();
    expect(fake.requests[0]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/plugins/custom.log_1~prod',
      json: {
        name: 'http-log',
        instance_name: 'custom.log_1~prod',
        route: { name: 'api' },
        config: { http_endpoint: 'https://logs.example.com' },
        enabled: false,
        protocols: ['http', 'https'],
        tags: ['env:prod', 'logging'],
      },
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('rejects empty explicit instanceName without sending a request', async () => {
    const { fake, plugins } = makePluginsApi();

    await expect(plugins.enable('cors', { instanceName: '' })).rejects.toThrow(KongError);
    expect(fake.requests).toHaveLength(0);
  });

  it('adopts an existing unnamed plugin on 409 for route, service, consumer, combined, and global scopes', async () => {
    const svcId = '11111111-1111-4111-8111-111111111111';
    const routeId = '22222222-2222-4222-8222-222222222222';
    const consumerId = '33333333-3333-4333-8333-333333333333';

    // 1. Route scope (also includes Kong 3.14 consumer_group: null in 409 fields)
    {
      const { fake, plugins } = makePluginsApi();
      const existingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
      const adopted = {
        id: existingId,
        name: 'key-auth',
        instance_name: 'key-auth.route.checkout',
        route: { id: routeId },
        service: null,
        consumer: null,
        config: { key_names: ['X-New-Key'] },
      };
      fake
        .json(
          {
            name: 'unique constraint violation',
            code: 5,
            message: 'UNIQUE violation detected',
            fields: {
              name: 'key-auth',
              service: null,
              route: { id: routeId },
              consumer: null,
              consumer_group: null,
            },
          },
          409,
        )
        .json({
          data: [
            // Same name & route, different consumer -> must be skipped
            {
              id: 'other-id',
              name: 'key-auth',
              instance_name: null,
              service: null,
              route: { id: routeId },
              consumer: { id: consumerId },
            },
            // Exact scope match
            {
              id: existingId,
              name: 'key-auth',
              instance_name: null,
              service: null,
              route: { id: routeId },
              consumer: null,
            },
          ],
          next: null,
        })
        .json(adopted);

      const controller = new AbortController();
      const result = await plugins.enable('key-auth', {
        on: { route: 'checkout' },
        config: { key_names: ['X-New-Key'] },
        signal: controller.signal,
      });

      expect(result).toEqual(adopted);
      expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
        'PUT http://localhost:8001/plugins/key-auth.route.checkout',
        `GET http://localhost:8001/routes/${routeId}/plugins`,
        `PUT http://localhost:8001/plugins/${existingId}`,
      ]);
      expect(fake.requests[2]?.json).toEqual({
        name: 'key-auth',
        instance_name: 'key-auth.route.checkout',
        route: { name: 'checkout' },
        config: { key_names: ['X-New-Key'] },
      });
      for (const req of fake.requests) {
        expect(req.signal).toBeDefined();
      }
    }

    // 2. Service scope
    {
      const { fake, plugins } = makePluginsApi();
      const existingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
      fake
        .json(
          {
            name: 'unique constraint violation',
            fields: {
              name: 'cors',
              service: { id: svcId },
              route: null,
              consumer: null,
            },
          },
          409,
        )
        .json({
          data: [
            {
              id: existingId,
              name: 'cors',
              instance_name: null,
              service: { id: svcId },
              route: null,
              consumer: null,
            },
          ],
          next: null,
        })
        .json({ id: existingId, name: 'cors', instance_name: 'cors.service.billing', config: {} });

      const result = await plugins.enable('cors', { on: { service: 'billing' } });
      expect(result.id).toBe(existingId);
      expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
        'PUT http://localhost:8001/plugins/cors.service.billing',
        `GET http://localhost:8001/services/${svcId}/plugins`,
        `PUT http://localhost:8001/plugins/${existingId}`,
      ]);
    }

    // 3. Consumer scope
    {
      const { fake, plugins } = makePluginsApi();
      const existingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
      fake
        .json(
          {
            name: 'unique constraint violation',
            fields: {
              name: 'rate-limiting',
              service: null,
              route: null,
              consumer: { id: consumerId },
            },
          },
          409,
        )
        .json({
          data: [
            {
              id: existingId,
              name: 'rate-limiting',
              instance_name: null,
              service: null,
              route: null,
              consumer: { id: consumerId },
            },
          ],
          next: null,
        })
        .json({
          id: existingId,
          name: 'rate-limiting',
          instance_name: 'rate-limiting.consumer.alice',
          config: { minute: 10 },
        });

      const result = await plugins.enable('rate-limiting', {
        on: { consumer: 'alice' },
        config: { minute: 10 },
      });
      expect(result.id).toBe(existingId);
      expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
        'PUT http://localhost:8001/plugins/rate-limiting.consumer.alice',
        `GET http://localhost:8001/consumers/${consumerId}/plugins`,
        `PUT http://localhost:8001/plugins/${existingId}`,
      ]);
    }

    // 4. Combined service + consumer scope (lists /services/{id}/plugins, ignores service-only plugin)
    {
      const { fake, plugins } = makePluginsApi();
      const existingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
      fake
        .json(
          {
            name: 'unique constraint violation',
            fields: {
              name: 'rate-limiting',
              service: { id: svcId },
              route: null,
              consumer: { id: consumerId },
            },
          },
          409,
        )
        .json({
          data: [
            {
              id: 'svc-only-id',
              name: 'rate-limiting',
              instance_name: null,
              service: { id: svcId },
              route: null,
              consumer: null,
            },
            {
              id: existingId,
              name: 'rate-limiting',
              instance_name: null,
              service: { id: svcId },
              route: null,
              consumer: { id: consumerId },
            },
          ],
          next: null,
        })
        .json({ id: existingId, name: 'rate-limiting', config: { minute: 5 } });

      const result = await plugins.enable('rate-limiting', {
        on: { service: 'billing', consumer: 'alice' },
        config: { minute: 5 },
      });
      expect(result.id).toBe(existingId);
      expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
        'PUT http://localhost:8001/plugins/rate-limiting.service.billing.consumer.alice',
        `GET http://localhost:8001/services/${svcId}/plugins`,
        `PUT http://localhost:8001/plugins/${existingId}`,
      ]);
    }

    // 5. Global scope across multiple pages (skips scoped plugins with the same name)
    {
      const { fake, plugins } = makePluginsApi();
      const existingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5';
      fake
        .json(
          {
            name: 'unique constraint violation',
            fields: {
              name: 'prometheus',
              service: null,
              route: null,
              consumer: null,
            },
          },
          409,
        )
        .json({
          data: [
            {
              id: 'scoped-prom',
              name: 'prometheus',
              instance_name: null,
              service: { id: svcId },
              route: null,
              consumer: null,
            },
          ],
          offset: 'page-2',
          next: '/plugins?offset=page-2',
        })
        .json({
          data: [
            {
              id: existingId,
              name: 'prometheus',
              instance_name: null,
              service: null,
              route: null,
              consumer: null,
            },
          ],
          next: null,
        })
        .json({ id: existingId, name: 'prometheus', instance_name: 'prometheus', config: {} });

      const result = await plugins.enable('prometheus', {
        config: { status_code_metrics: true },
      });
      expect(result.id).toBe(existingId);
      expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
        'PUT http://localhost:8001/plugins/prometheus',
        'GET http://localhost:8001/plugins',
        'GET http://localhost:8001/plugins?offset=page-2',
        `PUT http://localhost:8001/plugins/${existingId}`,
      ]);
    }
  });

  it('rethrows 409 on instance_name collision without attempting lookup', async () => {
    const { fake, plugins } = makePluginsApi();
    fake.json(
      {
        name: 'unique constraint violation',
        code: 5,
        message: 'UNIQUE violation detected on \'{instance_name="shared"}\'',
        fields: { instance_name: 'shared' },
      },
      409,
    );

    const error = await captureHttpError(
      plugins.enable('correlation-id', {
        on: { route: 'route-b' },
        instanceName: 'shared',
      }),
    );
    expect(error.status).toBe(409);
    expect(error.fields).toEqual({ instance_name: 'shared' });
    expect(fake.requests).toHaveLength(1);
  });

  it('rethrows the original 409 error when scope lookup finds no matching plugin', async () => {
    const { fake, plugins } = makePluginsApi();
    const routeId = '22222222-2222-4222-8222-222222222222';
    fake
      .json(
        {
          name: 'unique constraint violation',
          code: 5,
          message: 'UNIQUE violation detected',
          fields: {
            name: 'key-auth',
            service: null,
            route: { id: routeId },
            consumer: null,
          },
        },
        409,
      )
      .json({ data: [], next: null });

    const error = await captureHttpError(plugins.enable('key-auth', { on: { route: routeId } }));
    expect(error.status).toBe(409);
    expect(error.kongName).toBe('unique constraint violation');
    expect(error.fields?.route).toEqual({ id: routeId });
    expect(fake.requests).toHaveLength(2);
  });

  it('rethrows non-409 errors and non-scope 409 errors without lookup', async () => {
    const { fake, plugins } = makePluginsApi();
    fake
      .json({ name: 'schema violation', message: 'invalid config' }, 400)
      .json({ name: 'conflict', message: 'other 409' }, 409)
      .json({ name: 'unique constraint violation', fields: { name: 'cors', route: 'bad' } }, 409);

    await expect(plugins.enable('cors')).rejects.toMatchObject({ status: 400 });
    await expect(plugins.enable('cors')).rejects.toMatchObject({ status: 409 });
    await expect(plugins.enable('cors')).rejects.toMatchObject({ status: 409 });
    expect(fake.requests).toHaveLength(3);
  });

  it('findOnScope returns matching plugin or undefined and normalizes omitted scope fields', async () => {
    const { fake, plugins } = makePluginsApi();
    fake.json({
      data: [
        {
          id: 'p-1',
          name: 'cors',
          instance_name: null,
          service: null,
          route: null,
          consumer: null,
        },
      ],
      next: null,
    });
    const controller = new AbortController();
    const found = await plugins.findOnScope('cors', {}, { signal: controller.signal });
    expect(found?.id).toBe('p-1');
    expect(fake.requests[0]?.signal).toBeDefined();

    fake.json({ data: [], next: null });
    const missing = await plugins.findOnScope('key-auth', { service: null });
    expect(missing).toBeUndefined();
  });

  it('narrows config by plugin name and rejects unknown fields on known plugins at compile time', async () => {
    const { fake, plugins } = makePluginsApi();
    fake
      .json({ id: 'p-1', name: 'http-log', config: { http_endpoint: 'https://x' } })
      .json({ id: 'p-2', name: 'my-custom-plugin', config: { anything: 1 } });

    const known = await plugins.enable('http-log', {
      config: { http_endpoint: 'https://x' },
    });
    expectTypeOf(known).toEqualTypeOf<Plugin<'http-log'>>();
    expectTypeOf(known.config).toEqualTypeOf<HttpLogConfig>();

    const custom = await plugins.enable('my-custom-plugin', {
      config: { anything: 1, nested: { ok: true } },
    });
    expectTypeOf(custom).toEqualTypeOf<Plugin<'my-custom-plugin'>>();
    expectTypeOf(custom.config).toEqualTypeOf<Record<string, unknown>>();

    const typeErrors = async () => {
      await plugins.enable('http-log', {
        // @ts-expect-error unknown field on a known plugin
        config: { http_endpoint: 'https://x', nope: true },
      });
    };
    expect(typeof typeErrors).toBe('function');
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

    expectTypeOf(result).toEqualTypeOf<KongSchema>();
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
