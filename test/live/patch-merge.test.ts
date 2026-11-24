import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../support/crud.js';
import { getLiveEnv, liveKong, unique } from '../support/live.js';

describe('PATCH record merge and array/map replacement semantics (live)', () => {
  const env = getLiveEnv();
  const kong = liveKong();

  let serviceId = '';

  beforeAll(async () => {
    const service = await kong.services.create({
      name: unique('patch-merge-svc'),
      url: env.upstreamInternalUrl,
    });
    serviceId = service.id;
  });

  afterAll(async () => {
    if (serviceId) {
      await deleteIgnoringNotFound(() => kong.services.delete(serviceId));
    }
  });

  it('merges nested http-log config.queue fields on PATCH', async () => {
    const route = await kong.services.routes(serviceId).create({
      name: unique('patch-http-log-queue-route'),
      paths: [`/${unique('hlq')}`],
      protocols: ['http', 'https'],
    });
    let pluginId: string | undefined;

    try {
      const created = await kong.routes.plugins(route.id).create({
        name: 'http-log',
        instance_name: unique('patch-http-log-queue'),
        config: {
          http_endpoint: `${env.upstreamInternalUrl}/collect`,
          queue: {
            max_batch_size: 25,
            max_coalescing_delay: 2,
            max_entries: 5000,
          },
        },
      });
      pluginId = created.id;

      const updated = await kong.plugins.update<'http-log'>(created.id, {
        config: {
          queue: {
            max_coalescing_delay: 5,
          },
        },
      });
      expect(updated.id).toBe(created.id);
      expect(updated.config.http_endpoint).toBe(`${env.upstreamInternalUrl}/collect`);
      expect(updated.config.queue?.max_coalescing_delay).toBe(5);
      expect(updated.config.queue?.max_batch_size).toBe(25);
      expect(updated.config.queue?.max_entries).toBe(5000);

      const fetched = await kong.plugins.get(created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.config).toMatchObject({
        http_endpoint: `${env.upstreamInternalUrl}/collect`,
        queue: {
          max_coalescing_delay: 5,
          max_batch_size: 25,
          max_entries: 5000,
        },
      });
    } finally {
      if (pluginId) {
        const id = pluginId;
        await deleteIgnoringNotFound(() => kong.plugins.delete(id));
      }
      await deleteIgnoringNotFound(() => kong.routes.delete(route.id));
    }
  });

  it('merges deeply nested ai-proxy config.model.options fields on PATCH', async () => {
    const route = await kong.services.routes(serviceId).create({
      name: unique('patch-ai-proxy-route'),
      paths: [`/${unique('aip')}`],
      protocols: ['http', 'https'],
    });
    let pluginId: string | undefined;

    try {
      const created = await kong.routes.plugins(route.id).create({
        name: 'ai-proxy',
        instance_name: unique('patch-ai-proxy'),
        config: {
          route_type: 'llm/v1/chat',
          auth: {
            header_name: 'Authorization',
            header_value: 'Bearer test-key',
          },
          model: {
            provider: 'openai',
            name: 'gpt-4o-mini',
            options: {
              temperature: 0.2,
              max_tokens: 256,
            },
          },
        },
      });
      pluginId = created.id;

      const updated = await kong.plugins.update<'ai-proxy'>(created.id, {
        config: {
          model: {
            options: {
              temperature: 0.9,
            },
          },
        },
      });
      expect(updated.id).toBe(created.id);
      expect(updated.config.model.provider).toBe('openai');
      expect(updated.config.model.name).toBe('gpt-4o-mini');
      expect(updated.config.model.options?.temperature).toBe(0.9);
      expect(updated.config.model.options?.max_tokens).toBe(256);

      const fetched = await kong.plugins.get(created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.config).toMatchObject({
        route_type: 'llm/v1/chat',
        model: {
          provider: 'openai',
          name: 'gpt-4o-mini',
          options: {
            temperature: 0.9,
            max_tokens: 256,
          },
        },
      });
    } finally {
      if (pluginId) {
        const id = pluginId;
        await deleteIgnoringNotFound(() => kong.plugins.delete(id));
      }
      await deleteIgnoringNotFound(() => kong.routes.delete(route.id));
    }
  });

  it('merges nested upstream healthchecks.active fields on PATCH', async () => {
    const created = await kong.upstreams.create({
      name: `${unique('patch-up')}.example.invalid`,
      healthchecks: {
        active: {
          concurrency: 4,
          http_path: '/healthz',
          timeout: 7,
        },
      },
    });

    try {
      const updated = await kong.upstreams.update(created.id, {
        healthchecks: {
          active: {
            concurrency: 12,
          },
        },
      });
      expect(updated.id).toBe(created.id);
      expect(updated.healthchecks?.active?.concurrency).toBe(12);
      expect(updated.healthchecks?.active?.http_path).toBe('/healthz');
      expect(updated.healthchecks?.active?.timeout).toBe(7);

      const fetched = await kong.upstreams.get(created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.healthchecks?.active?.concurrency).toBe(12);
      expect(fetched.healthchecks?.active?.http_path).toBe('/healthz');
      expect(fetched.healthchecks?.active?.timeout).toBe(7);
    } finally {
      await deleteIgnoringNotFound(() => kong.upstreams.delete(created.id));
    }
  });

  it('replaces maps (http-log config.headers) as a whole on PATCH', async () => {
    const route = await kong.services.routes(serviceId).create({
      name: unique('patch-http-log-headers-route'),
      paths: [`/${unique('hlh')}`],
      protocols: ['http', 'https'],
    });
    let pluginId: string | undefined;

    try {
      const created = await kong.routes.plugins(route.id).create({
        name: 'http-log',
        instance_name: unique('patch-http-log-headers'),
        config: {
          http_endpoint: `${env.upstreamInternalUrl}/collect`,
          headers: {
            'x-a': '1',
            'x-b': '2',
          },
        },
      });
      pluginId = created.id;

      const updated = await kong.plugins.update<'http-log'>(created.id, {
        config: {
          headers: {
            'x-c': '3',
          },
        },
      });
      expect(updated.id).toBe(created.id);
      expect(updated.config.http_endpoint).toBe(`${env.upstreamInternalUrl}/collect`);
      expect(updated.config.headers).toEqual({ 'x-c': '3' });

      const fetched = await kong.plugins.get(created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.config.http_endpoint).toBe(`${env.upstreamInternalUrl}/collect`);
      expect(fetched.config.headers).toEqual({ 'x-c': '3' });
    } finally {
      if (pluginId) {
        const id = pluginId;
        await deleteIgnoringNotFound(() => kong.plugins.delete(id));
      }
      await deleteIgnoringNotFound(() => kong.routes.delete(route.id));
    }
  });

  it('replaces arrays (request-transformer config.add.headers) as a whole while preserving sibling fields on PATCH', async () => {
    const route = await kong.services.routes(serviceId).create({
      name: unique('patch-req-tx-route'),
      paths: [`/${unique('rtx')}`],
      protocols: ['http', 'https'],
    });
    let pluginId: string | undefined;

    try {
      const created = await kong.routes.plugins(route.id).create({
        name: 'request-transformer',
        instance_name: unique('patch-req-tx'),
        config: {
          add: {
            headers: ['x-a:1', 'x-b:2'],
            querystring: ['q-keep:1'],
          },
        },
      });
      pluginId = created.id;

      const updated = await kong.plugins.update<'request-transformer'>(created.id, {
        config: {
          add: {
            headers: ['x-c:3'],
          },
        },
      });
      expect(updated.id).toBe(created.id);
      expect(updated.config.add?.headers).toEqual(['x-c:3']);
      expect(updated.config.add?.querystring).toEqual(['q-keep:1']);

      const fetched = await kong.plugins.get(created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.config).toMatchObject({
        add: {
          headers: ['x-c:3'],
          querystring: ['q-keep:1'],
        },
      });
    } finally {
      if (pluginId) {
        const id = pluginId;
        await deleteIgnoringNotFound(() => kong.plugins.delete(id));
      }
      await deleteIgnoringNotFound(() => kong.routes.delete(route.id));
    }
  });
});
