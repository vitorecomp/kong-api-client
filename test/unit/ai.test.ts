import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  AiApi,
  Kong,
  type AiProxyConfig,
  type LlmRouteOptions,
  type Plugin,
  type Route,
  type Service,
} from '../../src/index.js';
import { createFakeFetch } from '../support/fake-fetch.js';

function makeKong() {
  const fake = createFakeFetch();
  const kong = new Kong({
    adminUrl: 'http://localhost:8001',
    fetch: fake.fetch,
  });
  return { fake, kong };
}

describe('AiApi', () => {
  it('is exposed as kong.ai', () => {
    const { kong } = makeKong();
    expect(kong.ai).toBeInstanceOf(AiApi);
  });

  it('llmRoute upserts service, route, and ai-proxy plugin in sequence with defaults', async () => {
    const { fake, kong } = makeKong();
    const svcId = '11111111-2222-4333-8444-555555555551';
    const rtId = '11111111-2222-4333-8444-555555555552';
    const plgId = '11111111-2222-4333-8444-555555555553';
    const service = { id: svcId, name: 'chat' };
    const route = { id: rtId, name: 'chat', service: { id: svcId }, paths: ['/chat'] };
    const plugin = {
      id: plgId,
      name: 'ai-proxy',
      instance_name: 'chat',
      route: { id: rtId },
      config: { route_type: 'llm/v1/chat', model: { provider: 'openai', name: 'gpt-4o' } },
    };
    fake.json(service).json(route).json(plugin);

    const result = await kong.ai.llmRoute({
      name: 'chat',
      paths: ['/chat'],
      provider: 'openai',
      model: 'gpt-4o',
    });

    expectTypeOf(result).toEqualTypeOf<{
      service: Service;
      route: Route;
      plugin: Plugin<'ai-proxy'>;
    }>();
    expect(result).toEqual({ service, route, plugin });

    expect(fake.requests).toHaveLength(3);
    expect(fake.requests[0]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/services/chat',
      json: {
        name: 'chat',
        url: 'http://localhost:32000',
      },
    });
    expect(fake.requests[1]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/routes/chat',
      json: {
        name: 'chat',
        service: { id: svcId },
        paths: ['/chat'],
      },
    });
    expect(fake.requests[1]?.json).not.toHaveProperty('protocols');
    expect(fake.requests[2]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/plugins/chat',
      json: {
        name: 'ai-proxy',
        instance_name: 'chat',
        route: { id: rtId },
        config: {
          route_type: 'llm/v1/chat',
          model: {
            provider: 'openai',
            name: 'gpt-4o',
          },
        },
      },
    });
  });

  it('maps header auth, upstreamUrl, route options, tags, and merges config last', async () => {
    const { fake, kong } = makeKong();
    const svcId = '22222222-2222-4333-8444-555555555551';
    const rtId = '22222222-2222-4333-8444-555555555552';
    fake
      .json({ id: svcId, name: 'assistant' })
      .json({ id: rtId, name: 'assistant' })
      .json({ id: '22222222-2222-4333-8444-555555555553', name: 'ai-proxy', config: {} });

    const controller = new AbortController();
    await kong.ai.llmRoute({
      name: 'assistant',
      paths: ['/v1/chat'],
      hosts: ['ai.example.com'],
      methods: ['POST'],
      protocols: ['http', 'https'],
      provider: 'openai',
      model: 'gpt-4o',
      routeType: 'llm/v1/completions',
      auth: { headerName: 'Authorization', headerValue: 'Bearer sk-test' },
      upstreamUrl: 'http://upstream:8080/v1/completions',
      serviceUrl: 'http://upstream:8080',
      tags: ['ai', 'env:test'],
      config: {
        logging: { log_payloads: true },
        auth: { allow_override: true },
        model: {
          provider: 'openai',
          options: { temperature: 0.2 },
        },
      },
      signal: controller.signal,
    });

    expect(fake.requests[0]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/services/assistant',
      json: {
        name: 'assistant',
        url: 'http://upstream:8080',
        tags: ['ai', 'env:test'],
      },
    });
    expect(fake.requests[1]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/routes/assistant',
      json: {
        name: 'assistant',
        service: { id: svcId },
        paths: ['/v1/chat'],
        hosts: ['ai.example.com'],
        methods: ['POST'],
        protocols: ['http', 'https'],
        tags: ['ai', 'env:test'],
      },
    });
    expect(fake.requests[2]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/plugins/assistant',
      json: {
        name: 'ai-proxy',
        instance_name: 'assistant',
        route: { id: rtId },
        tags: ['ai', 'env:test'],
        config: {
          route_type: 'llm/v1/completions',
          logging: { log_payloads: true },
          auth: {
            header_name: 'Authorization',
            header_value: 'Bearer sk-test',
            allow_override: true,
          },
          model: {
            provider: 'openai',
            name: 'gpt-4o',
            options: {
              upstream_url: 'http://upstream:8080/v1/completions',
              temperature: 0.2,
            },
          },
        },
      },
    });
    for (const req of fake.requests) {
      expect(req.signal).toBeDefined();
    }
  });

  it('maps parameter auth and lets config override route_type, auth, or model.options with null', async () => {
    const { fake, kong } = makeKong();
    fake
      .json({ id: 'svc-3' })
      .json({ id: 'rt-3' })
      .json({ id: 'plg-3' })
      .json({ id: 'svc-4' })
      .json({ id: 'rt-4' })
      .json({ id: 'plg-4' });

    await kong.ai.llmRoute({
      name: 'param-auth',
      paths: ['/p'],
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      auth: { paramName: 'key', paramValue: 'api-key-1', paramLocation: 'query' },
      config: {
        route_type: 'preserve',
        model: { provider: 'gemini', name: 'gemini-override' },
      },
    });

    expect(fake.requests[2]?.json).toMatchObject({
      config: {
        route_type: 'preserve',
        auth: {
          param_name: 'key',
          param_value: 'api-key-1',
          param_location: 'query',
        },
        model: {
          provider: 'gemini',
          name: 'gemini-override',
        },
      },
    });

    // Explicit null overrides in config win over derived auth / model.options.
    await kong.ai.llmRoute({
      name: 'null-override',
      paths: ['/n'],
      provider: 'openai',
      model: 'gpt-4o',
      auth: { headerName: 'Authorization', headerValue: 'Bearer x' },
      upstreamUrl: 'http://upstream:8080/v1/chat/completions',
      config: {
        auth: null,
        model: { provider: 'openai', options: null },
      },
    });

    expect(fake.requests[5]?.json).toMatchObject({
      config: {
        route_type: 'llm/v1/chat',
        auth: null,
        model: {
          provider: 'openai',
          name: 'gpt-4o',
          options: null,
        },
      },
    });
  });

  it('forwards all six single-plugin AI helpers with their scope (and global when undefined) to plugins.enable', async () => {
    const { fake, kong } = makeKong();
    for (let i = 0; i < 7; i += 1) {
      fake.json({ id: `p-${i}`, config: {} });
    }
    const controller = new AbortController();

    const p1 = await kong.ai.proxy(
      { route: 'chat' },
      { route_type: 'llm/v1/chat', model: { provider: 'openai', name: 'gpt-4o' } },
      { signal: controller.signal },
    );
    const p2 = await kong.ai.promptGuard(
      { route: 'chat' },
      { deny_patterns: ['secret'] },
      { signal: controller.signal },
    );
    const p3 = await kong.ai.promptDecorator(
      { route: 'chat' },
      { prompts: { prepend: [{ role: 'system', content: 'Be brief.' }] } },
      { signal: controller.signal },
    );
    const p4 = await kong.ai.promptTemplate(
      { service: 'llm' },
      { templates: [{ name: 't1', template: '{"messages":[]}' }] },
      { signal: controller.signal },
    );
    const p5 = await kong.ai.requestTransformer(
      { route: 'api' },
      {
        prompt: 'Rewrite',
        llm: { route_type: 'llm/v1/chat', model: { provider: 'openai', name: 'gpt-4o' } },
      },
      { signal: controller.signal },
    );
    const p6 = await kong.ai.responseTransformer(
      { route: 'api' },
      {
        prompt: 'Summarize',
        llm: { route_type: 'llm/v1/chat', model: { provider: 'openai', name: 'gpt-4o' } },
      },
      { signal: controller.signal },
    );
    const p7 = await kong.ai.promptDecorator(
      undefined,
      { prompts: { prepend: [{ role: 'system', content: 'Global rule.' }] } },
      { signal: controller.signal },
    );

    expectTypeOf(p1).toEqualTypeOf<Plugin<'ai-proxy'>>();
    expectTypeOf(p2).toEqualTypeOf<Plugin<'ai-prompt-guard'>>();
    expectTypeOf(p3).toEqualTypeOf<Plugin<'ai-prompt-decorator'>>();
    expectTypeOf(p4).toEqualTypeOf<Plugin<'ai-prompt-template'>>();
    expectTypeOf(p5).toEqualTypeOf<Plugin<'ai-request-transformer'>>();
    expectTypeOf(p6).toEqualTypeOf<Plugin<'ai-response-transformer'>>();
    expectTypeOf(p7).toEqualTypeOf<Plugin<'ai-prompt-decorator'>>();

    expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'PUT http://localhost:8001/plugins/ai-proxy.route.chat',
      'PUT http://localhost:8001/plugins/ai-prompt-guard.route.chat',
      'PUT http://localhost:8001/plugins/ai-prompt-decorator.route.chat',
      'PUT http://localhost:8001/plugins/ai-prompt-template.service.llm',
      'PUT http://localhost:8001/plugins/ai-request-transformer.route.api',
      'PUT http://localhost:8001/plugins/ai-response-transformer.route.api',
      'PUT http://localhost:8001/plugins/ai-prompt-decorator',
    ]);
    expect(fake.requests[0]?.json).toMatchObject({
      name: 'ai-proxy',
      instance_name: 'ai-proxy.route.chat',
      route: { name: 'chat' },
    });
    expect(fake.requests[1]?.json).toMatchObject({
      name: 'ai-prompt-guard',
      instance_name: 'ai-prompt-guard.route.chat',
      route: { name: 'chat' },
    });
    expect(fake.requests[2]?.json).toMatchObject({
      name: 'ai-prompt-decorator',
      instance_name: 'ai-prompt-decorator.route.chat',
      route: { name: 'chat' },
    });
    expect(fake.requests[3]?.json).toMatchObject({
      name: 'ai-prompt-template',
      instance_name: 'ai-prompt-template.service.llm',
      service: { name: 'llm' },
    });
    expect(fake.requests[4]?.json).toMatchObject({
      name: 'ai-request-transformer',
      instance_name: 'ai-request-transformer.route.api',
      route: { name: 'api' },
    });
    expect(fake.requests[5]?.json).toMatchObject({
      name: 'ai-response-transformer',
      instance_name: 'ai-response-transformer.route.api',
      route: { name: 'api' },
    });
    expect(fake.requests[6]?.json).toEqual({
      name: 'ai-prompt-decorator',
      instance_name: 'ai-prompt-decorator',
      config: { prompts: { prepend: [{ role: 'system', content: 'Global rule.' }] } },
    });
    for (const req of fake.requests) {
      expect(req.signal).toBeDefined();
    }
  });

  it('derives provider and routeType types directly from generated AiProxyConfig', () => {
    expectTypeOf<LlmRouteOptions['provider']>().toEqualTypeOf<AiProxyConfig['model']['provider']>();
    expectTypeOf<LlmRouteOptions['routeType']>().toEqualTypeOf<
      AiProxyConfig['route_type'] | undefined
    >();

    const checkInvalid = (kong: Kong) => {
      void kong.ai.llmRoute({
        name: 'bad',
        paths: ['/bad'],
        // @ts-expect-error unknown provider must not compile
        provider: 'not-a-provider',
        model: 'x',
      });
      void kong.ai.llmRoute({
        name: 'bad2',
        paths: ['/bad2'],
        provider: 'openai',
        model: 'x',
        // @ts-expect-error unknown routeType must not compile
        routeType: 'llm/v99/invalid',
      });
    };
    expect(typeof checkInvalid).toBe('function');
  });
});
