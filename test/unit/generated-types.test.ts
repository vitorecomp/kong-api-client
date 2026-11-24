import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  AclInput,
  OAuth2TokenInput,
  Plugin,
  PluginInput,
  Service,
  ServiceInput,
  SniInput,
  TargetInput,
} from '../../src/generated/entities.js';
import {
  PLUGINS,
  type AiProxyConfig,
  type ConfigOf,
  type HttpLogConfig,
  type PluginName,
  type ProxyCacheConfig,
} from '../../src/generated/plugins.js';
import { KongResources } from '../../src/generated/resources.js';
import { Transport } from '../../src/transport.js';
import { createFakeFetch } from '../support/fake-fetch.js';

describe('generated entity and plugin types', () => {
  it('types ServiceInput to accept shorthand url or host and reject invalid fields', () => {
    const byUrl: ServiceInput = { name: 'billing', url: 'https://example.com:8443/v1' };
    const byHost: ServiceInput = { host: 'example.com' };

    expect(byUrl.url).toBe('https://example.com:8443/v1');
    expect(byHost.host).toBe('example.com');

    const badPort: ServiceInput = {
      host: 'example.com',
      // @ts-expect-error port must be a number, not a string
      port: '80',
    };
    const badTimestamp: ServiceInput = {
      host: 'example.com',
      // @ts-expect-error created_at is omitted from entity input types
      created_at: 1700000000,
    };
    expect([badPort, badTimestamp]).toHaveLength(2);
  });

  it('types returned Service with non-null host and id and nullable name', () => {
    expectTypeOf<Service['id']>().toEqualTypeOf<string>();
    expectTypeOf<Service['host']>().toEqualTypeOf<string>();
    expectTypeOf<Service['name']>().toEqualTypeOf<string | null>();
  });

  it('requires http_endpoint on HttpLogConfig and allows omitting defaulted queue', () => {
    const valid: HttpLogConfig = { http_endpoint: 'https://logs.example.com/ingest' };
    expect(valid.http_endpoint).toBe('https://logs.example.com/ingest');

    // @ts-expect-error http_endpoint is required on HttpLogConfig
    const missingEndpoint: HttpLogConfig = {};
    const unknownField: HttpLogConfig = {
      http_endpoint: 'https://logs.example.com/ingest',
      // @ts-expect-error unknown property on HttpLogConfig
      nope: true,
    };
    expect([missingEndpoint, unknownField]).toHaveLength(2);
  });

  it('maps ConfigOf<N> to the plugin config type or Record<string, unknown> for custom plugins', () => {
    expectTypeOf<ConfigOf<'http-log'>>().toEqualTypeOf<HttpLogConfig>();
    expectTypeOf<ConfigOf<'x-custom'>>().toEqualTypeOf<Record<string, unknown>>();
    expectTypeOf<Plugin<'http-log'>['config']>().toEqualTypeOf<HttpLogConfig>();
    expectTypeOf<Plugin<'x-custom'>['config']>().toEqualTypeOf<Record<string, unknown>>();

    const pluginInput: PluginInput<'http-log'> = {
      name: 'http-log',
      config: { http_endpoint: 'https://logs.example.com' },
    };
    const customInput: PluginInput<'x-custom'> = {
      name: 'x-custom',
      config: { anything: 1 },
    };
    expect([pluginInput.name, customInput.name]).toEqual(['http-log', 'x-custom']);
  });

  it('quotes non-identifier members such as X-Cache-Status on ProxyCacheConfig', () => {
    type ResponseHeaders = NonNullable<ProxyCacheConfig['response_headers']>;
    expectTypeOf<ResponseHeaders['X-Cache-Status']>().toEqualTypeOf<boolean | null | undefined>();

    const cfg: ProxyCacheConfig = {
      strategy: 'memory',
      response_headers: {
        'X-Cache-Status': true,
        'X-Cache-Key': false,
      },
    };
    expect(cfg.response_headers?.['X-Cache-Status']).toBe(true);
  });

  it('merges 3.9 and 3.14 unions such as ai-proxy model.provider', () => {
    type Provider = AiProxyConfig['model']['provider'];

    // Present on both 3.9 and 3.14.
    expectTypeOf<'openai'>().toExtend<Provider>();
    // Accepted only on Kong Gateway 3.14.
    expectTypeOf<'ollama'>().toExtend<Provider>();
    expectTypeOf<'deepseek'>().toExtend<Provider>();

    const config: AiProxyConfig = {
      route_type: 'llm/v1/chat',
      model: { provider: 'ollama', name: 'llama3' },
    };
    expect(config.model.provider).toBe('ollama');

    const invalid: AiProxyConfig = {
      route_type: 'llm/v1/chat',
      // @ts-expect-error unsupported provider literal
      model: { provider: 'not-a-real-provider' },
    };
    expect(invalid.route_type).toBe('llm/v1/chat');
  });

  it('maps foreign references according to target entity key capabilities', () => {
    // Entities with a unique `name` accept `{ id }` or `{ name }`.
    const target: TargetInput = {
      upstream: { name: 'backend' },
      target: '127.0.0.1:8080',
    };
    // Consumers accept `{ id }` or `{ username }`.
    const acl: AclInput = {
      consumer: { username: 'alice' },
      group: 'admins',
    };
    // Certificates have no name field, so only `{ id }` is accepted.
    expectTypeOf<ServiceInput['client_certificate']>().toEqualTypeOf<
      { id: string } | null | undefined
    >();
    expectTypeOf<SniInput['certificate']>().toEqualTypeOf<{ id: string }>();
    // OAuth2 credentials do not have a unique name, and consumer_groups has no recording.
    expectTypeOf<OAuth2TokenInput['credential']>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<PluginInput['consumer_group']>().toEqualTypeOf<
      { id: string } | null | undefined
    >();

    const badServiceCert: ServiceInput = {
      host: 'example.com',
      // @ts-expect-error certificates cannot be referenced by name
      client_certificate: { name: 'my-cert' },
    };
    const badSniCert: SniInput = {
      name: 'example.com',
      // @ts-expect-error certificates cannot be referenced by name
      certificate: { name: 'my-cert' },
    };
    expect([target.target, acl.group, badServiceCert.host, badSniCert.name]).toHaveLength(4);
  });

  it('exposes accurate PLUGINS scope and target metadata', () => {
    expect(PLUGINS['key-auth'].scopes).not.toContain('consumer');
    expect(PLUGINS.acme.scopes).toEqual(['global']);
    expect(PLUGINS['http-log'].targets).toEqual(['kong-3.9', 'kong-gateway-3.14']);
    expectTypeOf<keyof typeof PLUGINS>().toEqualTypeOf<PluginName>();
  });

  it('generates KongResources with nested inputs, PluginCollection, and no top-level targets', async () => {
    const fake = createFakeFetch();
    const transport = new Transport({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const kong = new KongResources(transport);

    // KongResources must not expose top-level `targets`.
    expectTypeOf<'targets'>().not.toExtend<keyof KongResources>();
    expect('targets' in kong).toBe(false);
    // @ts-expect-error targets is nested-only and absent from KongResources
    const noTargets: unknown = kong.targets;
    expect(noTargets).toBeUndefined();

    fake
      .json({ id: 't-1', target: 'a:80', upstream: { id: 'u' } }, 201)
      .json({ id: 'r-1', paths: ['/x'] }, 201)
      .json({ id: 'k-1', key: 'secret', consumer: { id: 'c' } }, 201)
      .json({ id: 'p-1', name: 'http-log', config: { http_endpoint: 'https://x' } }, 201);

    await kong.upstreams.targets('u').create({ target: 'a:80' });
    await kong.services.routes('s').create({ paths: ['/x'] });
    await kong.consumers.keyAuth('c').create({});
    const plugin = await kong.services.plugins('s').create({
      name: 'http-log',
      config: { http_endpoint: 'https://x' },
    });

    expectTypeOf(plugin).toEqualTypeOf<Plugin<'http-log'>>();
    expectTypeOf(plugin.config).toEqualTypeOf<HttpLogConfig>();

    expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'POST http://localhost:8001/upstreams/u/targets',
      'POST http://localhost:8001/services/s/routes',
      'POST http://localhost:8001/consumers/c/key-auth',
      'POST http://localhost:8001/services/s/plugins',
    ]);
  });
});
