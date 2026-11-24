import { inspect } from 'node:util';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { runApply } from '../../src/apply/apply.js';
import {
  Kong,
  KongApplyError,
  KongHttpError,
  type ApplyConfig,
  type ApplyResult,
} from '../../src/index.js';
import { createFakeFetch } from '../support/fake-fetch.js';

const MANAGED = 'managed-by:kong-api-client';

async function captureApplyError(promise: Promise<unknown>): Promise<KongApplyError> {
  let captured: unknown;
  await expect(
    promise.catch((error: unknown) => {
      captured = error;
      throw error;
    }),
  ).rejects.toBeInstanceOf(KongApplyError);
  if (!(captured instanceof KongApplyError)) {
    throw new Error('Expected KongApplyError');
  }
  return captured;
}

describe('Kong.apply unit tests', () => {
  it('creates all 10 resource types in dependency order using PUT (and POST for targets)', async () => {
    const fake = createFakeFetch()
      // 1. certificates: GET 404, PUT 200
      .json({ message: 'Not found' }, 404)
      .json({ id: 'cert-1', cert: 'CERT', key: 'KEY', tags: [MANAGED] })
      // 2. ca_certificates: GET 404, PUT 200
      .json({ message: 'Not found' }, 404)
      .json({ id: 'ca-1', cert: 'CA', tags: [MANAGED] })
      // 3. snis: GET 404, PUT 200
      .json({ message: 'Not found' }, 404)
      .json({ id: 'sni-id', name: 'a.example.com', certificate: { id: 'cert-1' }, tags: [MANAGED] })
      // 4. vaults: GET 404, PUT 200
      .json({ message: 'Not found' }, 404)
      .json({ id: 'v-id', prefix: 'my-vault', name: 'env', tags: [MANAGED] })
      // 5. upstreams: GET 404, PUT 200
      .json({ message: 'Not found' }, 404)
      .json({ id: 'up-id', name: 'my-up', tags: [MANAGED] })
      // 6. targets: GET list empty, POST 201
      .json({ data: [], next: null })
      .json({ id: 't-id', target: '10.0.0.1:8080', weight: 100, tags: [MANAGED] }, 201)
      // 7. services (expanded url): GET 404, PUT 200
      .json({ message: 'Not found' }, 404)
      .json({
        id: 'svc-id',
        name: 'billing',
        protocol: 'https',
        host: 'billing.example.com',
        port: 443,
        path: '/v1',
        tags: [MANAGED],
      })
      // 8. routes: GET 404, PUT 200
      .json({ message: 'Not found' }, 404)
      .json({
        id: 'rt-id',
        name: 'billing-route',
        service: { id: 'svc-id' },
        paths: ['/billing'],
        tags: [MANAGED],
      })
      // 9. consumers: GET 404, PUT 200
      .json({ message: 'Not found' }, 404)
      .json({ id: 'c-id', username: 'alice', tags: [MANAGED] })
      // 10. plugins: GET 404, scope lookup empty, PUT 200
      .json({ message: 'Not found' }, 404)
      .json({ data: [], next: null })
      .json({
        id: 'p-id',
        name: 'http-log',
        instance_name: 'billing-log',
        service: { id: 'svc-id' },
        config: { http_endpoint: 'https://logs.example.com' },
        tags: [MANAGED],
      });

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    const result = await kong.apply({
      certificates: [{ id: 'cert-1', cert: 'CERT', key: 'KEY' }],
      ca_certificates: [{ id: 'ca-1', cert: 'CA' }],
      snis: [{ name: 'a.example.com', certificate: { id: 'cert-1' } }],
      vaults: [{ prefix: 'my-vault', name: 'env' }],
      upstreams: [{ name: 'my-up' }],
      targets: [{ upstream: 'my-up', target: '10.0.0.1:8080', weight: 100 }],
      services: [{ name: 'billing', url: 'https://billing.example.com/v1' }],
      routes: [{ name: 'billing-route', service: { name: 'billing' }, paths: ['/billing'] }],
      consumers: [{ username: 'alice' }],
      plugins: [
        {
          name: 'http-log',
          instance_name: 'billing-log',
          service: { name: 'billing' },
          config: { http_endpoint: 'https://logs.example.com' },
        },
      ],
    });

    expect(result.dryRun).toBe(false);
    expect(result.summary).toEqual({ create: 10, update: 0, unchanged: 0, delete: 0 });
    expect(result.changes).toEqual([
      { type: 'certificates', key: 'cert-1', action: 'create' },
      { type: 'ca_certificates', key: 'ca-1', action: 'create' },
      { type: 'snis', key: 'a.example.com', action: 'create' },
      { type: 'vaults', key: 'my-vault', action: 'create' },
      { type: 'upstreams', key: 'my-up', action: 'create' },
      { type: 'targets', key: 'my-up/10.0.0.1:8080', action: 'create' },
      { type: 'services', key: 'billing', action: 'create' },
      { type: 'routes', key: 'billing-route', action: 'create' },
      { type: 'consumers', key: 'alice', action: 'create' },
      { type: 'plugins', key: 'billing-log', action: 'create' },
    ]);

    const requestSummary = fake.requests.map((r) => `${r.method} ${new URL(r.url).pathname}`);
    expect(requestSummary).toEqual([
      'GET /certificates/cert-1',
      'PUT /certificates/cert-1',
      'GET /ca_certificates/ca-1',
      'PUT /ca_certificates/ca-1',
      'GET /snis/a.example.com',
      'PUT /snis/a.example.com',
      'GET /vaults/my-vault',
      'PUT /vaults/my-vault',
      'GET /upstreams/my-up',
      'PUT /upstreams/my-up',
      'GET /upstreams/my-up/targets',
      'POST /upstreams/my-up/targets',
      'GET /services/billing',
      'PUT /services/billing',
      'GET /routes/billing-route',
      'PUT /routes/billing-route',
      'GET /consumers/alice',
      'PUT /consumers/alice',
      'GET /plugins/billing-log',
      'GET /services/svc-id/plugins',
      'PUT /plugins/billing-log',
    ]);

    // Verify target POST omitted upstream and included managed tag
    expect(fake.requests[11]!.json).toEqual({
      target: '10.0.0.1:8080',
      weight: 100,
      tags: [MANAGED],
    });
    // Verify service PUT sent expanded url fields without url
    expect(fake.requests[13]!.json).toEqual({
      name: 'billing',
      protocol: 'https',
      host: 'billing.example.com',
      port: 443,
      path: '/v1',
      tags: [MANAGED],
    });
  });

  it('sends PATCH for differing fields only and makes zero writes when unchanged', async () => {
    const fake = createFakeFetch()
      // Run 1: service matches, route differs on paths, plugin differs on config
      .json({
        id: 'svc-1',
        name: 'api',
        protocol: 'http',
        host: 'api.example.com',
        port: 80,
        path: null,
        tags: [MANAGED],
      })
      .json({
        id: 'rt-1',
        name: 'api-route',
        service: { id: 'svc-1' },
        paths: ['/old'],
        protocols: ['https', 'http'],
        tags: [MANAGED],
      })
      .json({
        id: 'rt-1',
        name: 'api-route',
        service: { id: 'svc-1' },
        paths: ['/new'],
        protocols: ['http', 'https'],
        tags: [MANAGED],
      })
      .json({
        id: 'p-1',
        name: 'http-log',
        instance_name: 'api-log',
        service: { id: 'svc-1' },
        route: { id: 'rt-1' },
        config: { http_endpoint: 'https://old.example.com', method: 'POST' },
        tags: [MANAGED],
      })
      .json({
        id: 'p-1',
        name: 'http-log',
        instance_name: 'api-log',
        service: { id: 'svc-1' },
        route: { id: 'rt-1' },
        config: { http_endpoint: 'https://new.example.com', method: 'POST' },
        tags: [MANAGED],
      });

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const res1 = await runApply(
      kong,
      {
        services: [{ name: 'api', url: 'http://api.example.com' }],
        routes: [
          {
            name: 'api-route',
            service: { name: 'api' },
            paths: ['/new'],
            protocols: ['http', 'https'],
          },
        ],
        plugins: [
          {
            name: 'http-log',
            instance_name: 'api-log',
            service: { name: 'api' },
            route: { name: 'api-route' },
            config: { http_endpoint: 'https://new.example.com' },
          },
        ],
      },
      {},
      { routes: ['protocols', 'tags'], plugins: ['protocols', 'tags'], services: ['tags'] },
    );

    expect(res1.summary).toEqual({ create: 0, update: 2, unchanged: 1, delete: 0 });
    expect(res1.changes).toEqual([
      { type: 'services', key: 'api', action: 'unchanged' },
      { type: 'routes', key: 'api-route', action: 'update', fields: ['paths'] },
      { type: 'plugins', key: 'api-log', action: 'update', fields: ['config'] },
    ]);
    expect(fake.requests[2]!.method).toBe('PATCH');
    expect(fake.requests[2]!.json).toEqual({ paths: ['/new'] });
    expect(fake.requests[4]!.method).toBe('PATCH');
    expect(fake.requests[4]!.json).toEqual({
      config: { http_endpoint: 'https://new.example.com' },
    });

    // Run 2: everything matches -> GET only
    fake.reset();
    fake
      .json({
        id: 'svc-1',
        name: 'api',
        protocol: 'http',
        host: 'api.example.com',
        port: 80,
        path: null,
        tags: [MANAGED],
      })
      .json({
        id: 'rt-1',
        name: 'api-route',
        service: { id: 'svc-1' },
        paths: ['/new'],
        protocols: ['https', 'http'],
        tags: [MANAGED],
      });

    const res2 = await kong.apply({
      services: [{ name: 'api', url: 'http://api.example.com' }],
      routes: [
        {
          name: 'api-route',
          service: { name: 'api' },
          paths: ['/new'],
          protocols: ['http', 'https'],
        },
      ],
    });
    expect(res2.summary).toEqual({ create: 0, update: 0, unchanged: 2, delete: 0 });
    expect(fake.requests.every((r) => r.method === 'GET')).toBe(true);
  });

  it('sends only GET requests during dryRun including prune and pending name references', async () => {
    const fake = createFakeFetch()
      // upstream not yet created
      .json({ message: 'Not found' }, 404)
      // service not yet created
      .json({ message: 'Not found' }, 404)
      // route exists pointing to old service id; new service is pending create -> counts as different
      .json({
        id: 'rt-1',
        name: 'r1',
        service: { id: 'old-svc-id' },
        paths: ['/a'],
        tags: [MANAGED],
      })
      // prune lists: plugins, consumers, routes, services, (targets skipped for pending upstream),
      // upstreams, vaults, snis, ca_certificates, certificates
      .json({
        data: [{ id: 'old-p', instance_name: 'dropped-plugin', tags: [MANAGED] }],
        next: null,
      })
      .json({ data: [], next: null })
      .json({ data: [{ id: 'rt-1', name: 'r1', tags: [MANAGED] }], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null });

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const result = await kong.apply(
      {
        upstreams: [{ name: 'new-up' }],
        targets: [{ upstream: 'new-up', target: '10.0.0.1:8080' }],
        services: [{ name: 'new-svc', host: 'example.com' }],
        routes: [{ name: 'r1', service: { name: 'new-svc' }, paths: ['/a'] }],
      },
      { dryRun: true, prune: true },
    );

    expect(result.dryRun).toBe(true);
    expect(result.changes).toEqual([
      { type: 'upstreams', key: 'new-up', action: 'create' },
      { type: 'targets', key: 'new-up/10.0.0.1:8080', action: 'create' },
      { type: 'services', key: 'new-svc', action: 'create' },
      { type: 'routes', key: 'r1', action: 'update', fields: ['service'] },
      { type: 'plugins', key: 'dropped-plugin', action: 'delete' },
    ]);
    expect(result.summary).toEqual({ create: 3, update: 1, unchanged: 0, delete: 1 });
    expect(fake.requests.every((r) => r.method === 'GET')).toBe(true);
  });

  it('resolves external entity references via find() when not in config', async () => {
    const fake = createFakeFetch()
      // GET plugin -> exists
      .json({
        id: 'p-1',
        name: 'key-auth',
        instance_name: 'ka-1',
        service: { id: 'ext-svc-id' },
        consumer: { id: 'ext-consumer-id' },
        tags: [MANAGED],
      })
      // find external service by name
      .json({ id: 'ext-svc-id', name: 'external-svc' })
      // find external consumer by username
      .json({ id: 'ext-consumer-id', username: 'external-user' });

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const result = await kong.apply({
      plugins: [
        {
          name: 'key-auth',
          instance_name: 'ka-1',
          service: { name: 'external-svc' },
          consumer: { username: 'external-user' },
        },
      ],
    });

    expect(result.changes).toEqual([{ type: 'plugins', key: 'ka-1', action: 'unchanged' }]);
    expect(fake.requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      'GET /plugins/ka-1',
      'GET /services/external-svc',
      'GET /consumers/external-user',
    ]);
  });

  it('prunes managed entities in reverse order and leaves untagged or other-tag entities untouched', async () => {
    const fake = createFakeFetch()
      // apply: upstream u1 exists & unchanged
      .json({ id: 'up-1', name: 'u1', tags: [MANAGED] })
      // prune plugins
      .json({
        data: [
          { id: 'p-drop', instance_name: 'old-plug', tags: [MANAGED] },
          { id: 'p-other', instance_name: 'other-plug', tags: ['other-tag'] },
        ],
        next: null,
      })
      .empty(204)
      // prune consumers
      .json({ data: [], next: null })
      // prune routes
      .json({ data: [], next: null })
      // prune services
      .json({ data: [{ id: 's-drop', name: 'old-svc', tags: [MANAGED] }], next: null })
      .empty(204)
      // prune targets on u1
      .json({
        data: [
          { id: 't-drop', target: '10.0.0.9:8080', tags: [MANAGED] },
          { id: 't-untagged', target: '10.0.0.8:8080', tags: null },
        ],
        next: null,
      })
      .empty(204)
      // prune upstreams (u1 is kept)
      .json({ data: [{ id: 'up-1', name: 'u1', tags: [MANAGED] }], next: null })
      // prune vaults, snis, ca_certificates, certificates
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null });

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const result = await kong.apply({ upstreams: [{ name: 'u1' }] }, { prune: true });

    expect(result.changes).toEqual([
      { type: 'upstreams', key: 'u1', action: 'unchanged' },
      { type: 'plugins', key: 'old-plug', action: 'delete' },
      { type: 'services', key: 'old-svc', action: 'delete' },
      { type: 'targets', key: 'u1/10.0.0.9:8080', action: 'delete' },
    ]);
    expect(result.summary).toEqual({ create: 0, update: 0, unchanged: 1, delete: 3 });

    const deletes = fake.requests
      .filter((r) => r.method === 'DELETE')
      .map((r) => new URL(r.url).pathname);
    expect(deletes).toEqual([
      '/plugins/p-drop',
      '/services/s-drop',
      '/upstreams/u1/targets/t-drop',
    ]);
  });

  it('throws KongApplyError on halfway failure with partial result, failed step, and cause', async () => {
    const headerSecret = 'apply-hdr-secret-xyz';
    const fake = createFakeFetch()
      // service 1 succeeds
      .json({ message: 'Not found' }, 404)
      .json({ id: 's1', name: 'svc-1', host: 'example.com', tags: [MANAGED] })
      // service 2 fails on PUT
      .json({ message: 'Not found' }, 404)
      .json(
        {
          message: 'schema violation (port: value should be between 0 and 65535)',
          name: 'schema violation',
          code: 2,
          fields: { port: 'value should be between 0 and 65535' },
        },
        400,
        { statusText: 'Bad Request' },
      );

    const kong = new Kong({
      adminUrl: 'http://localhost:8001',
      headers: { Authorization: `Bearer ${headerSecret}` },
      fetch: fake.fetch,
    });

    const err = await captureApplyError(
      kong.apply({
        services: [
          { name: 'svc-1', host: 'example.com' },
          { name: 'svc-2', host: 'example.com', port: 99_999 },
        ],
      }),
    );

    expect(err.name).toBe('KongApplyError');
    expect(err.failed).toEqual({ type: 'services', key: 'svc-2', action: 'create' });
    expect(err.result).toEqual({
      changes: [{ type: 'services', key: 'svc-1', action: 'create' }],
      summary: { create: 1, update: 0, unchanged: 0, delete: 0 },
      dryRun: false,
    });
    expect(err.cause).toBeInstanceOf(KongHttpError);
    expect(JSON.stringify(err)).not.toContain(headerSecret);
    expect(inspect(err, { depth: null, showHidden: true })).not.toContain(headerSecret);
  });

  it('updates existing targets and handles missing external refs and dryRun 404 upstreams', async () => {
    const fake = createFakeFetch()
      // target list returns existing target with weight 50
      .json({
        data: [
          { id: 't1', target: '10.0.0.1:8080', weight: 50, tags: [MANAGED] },
          { id: 't2', target: '10.0.0.2:8080', weight: 100, tags: [MANAGED] },
        ],
        next: null,
      })
      // PATCH t1
      .json({ id: 't1', target: '10.0.0.1:8080', weight: 80, tags: [MANAGED] })
      // GET route -> exists with service id-1; desired references missing external service name
      .json({ id: 'r1', name: 'r1', service: { id: 'id-1' }, tags: [MANAGED] })
      // find external service -> 404 (unresolved ref -> counts as different)
      .json({ message: 'Not found' }, 404)
      // PATCH route
      .json({ id: 'r1', name: 'r1', service: { id: 'id-2' }, tags: [MANAGED] })
      // GET plugin -> exists with explicit { id } service ref and null route ref
      .json({
        id: 'p1',
        name: 'http-log',
        instance_name: 'p1',
        service: { id: 'svc-id-direct' },
        route: null,
        config: { http_endpoint: 'https://logs.example.com' },
        tags: [MANAGED],
      });

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const res = await runApply(
      kong,
      {
        targets: [
          { upstream: 'existing-up', target: '10.0.0.1:8080', weight: 80 },
          { upstream: 'existing-up', target: '10.0.0.2:8080', weight: 100 },
        ],
        routes: [{ name: 'r1', service: { name: 'missing-svc' } }],
        plugins: [
          {
            name: 'http-log',
            instance_name: 'p1',
            service: { id: 'svc-id-direct' },
            route: null,
            config: { http_endpoint: 'https://logs.example.com' },
          },
        ],
      },
      {},
      { 'plugin:http-log': ['config.headers.*'], plugins: ['protocols', 'tags'] },
    );

    expect(res.changes).toEqual([
      { type: 'targets', key: 'existing-up/10.0.0.1:8080', action: 'update', fields: ['weight'] },
      { type: 'targets', key: 'existing-up/10.0.0.2:8080', action: 'unchanged' },
      { type: 'routes', key: 'r1', action: 'update', fields: ['service'] },
      { type: 'plugins', key: 'p1', action: 'unchanged' },
    ]);

    // Dry run targeting an upstream not in config that returns 404
    fake.reset();
    fake
      .json({ message: 'Not found' }, 404) // targets list 404 on apply
      // prune: plugins, consumers, routes, services -> empty
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      // prune targets on ghost-up -> 404 ignored in dryRun
      .json({ message: 'Not found' }, 404)
      // prune upstreams, vaults, snis, ca_certificates, certificates -> empty
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null });

    const dryRes = await kong.apply(
      { targets: [{ upstream: 'ghost-up', target: '10.0.0.1:8080' }] },
      { dryRun: true, prune: true },
    );
    expect(dryRes.changes).toEqual([
      { type: 'targets', key: 'ghost-up/10.0.0.1:8080', action: 'create' },
    ]);
    expect(fake.requests.every((r) => r.method === 'GET')).toBe(true);
  });

  it('uses generated SET_FIELDS for plugin config sets by default', async () => {
    const fake = createFakeFetch().json({
      id: 'jwt-1',
      name: 'jwt',
      instance_name: 'jwt-api',
      config: {
        claims_to_verify: ['nbf', 'exp'],
        header_names: ['X-Jwt', 'Authorization'],
      },
      tags: [MANAGED],
    });

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const result = await kong.apply({
      plugins: [
        {
          name: 'jwt',
          instance_name: 'jwt-api',
          config: {
            claims_to_verify: ['exp', 'nbf'],
            header_names: ['Authorization', 'X-Jwt'],
          },
        },
      ],
    });

    expect(result.changes).toEqual([{ type: 'plugins', key: 'jwt-api', action: 'unchanged' }]);
    expect(fake.requests.every((r) => r.method === 'GET')).toBe(true);
  });

  it('adopts existing unnamed plugins by name and exact scope across route, service, consumer, and global scopes', async () => {
    const fake = createFakeFetch()
      // 1. Route-scoped plugin: GET by instance_name -> 404, find route -> id, list route plugins -> skips consumer-scoped match and adopts exact match
      .json({ message: 'Not found' }, 404)
      .json({ id: 'rt-1', name: 'my-route' })
      .json({
        data: [
          {
            id: 'p-route-other-consumer',
            name: 'correlation-id',
            instance_name: null,
            route: { id: 'rt-1' },
            service: null,
            consumer: { id: 'c-other' },
            config: { header_name: 'X-Req' },
            tags: null,
          },
          {
            id: 'p-route-exact',
            name: 'correlation-id',
            instance_name: null,
            route: { id: 'rt-1' },
            service: null,
            consumer: null,
            config: { header_name: 'X-Req', echo_downstream: true },
            tags: ['existing-tag'],
          },
        ],
        next: null,
      })
      .json({
        id: 'p-route-exact',
        name: 'correlation-id',
        instance_name: 'route-corr',
        route: { id: 'rt-1' },
        config: { header_name: 'X-Req', echo_downstream: true },
        tags: ['existing-tag', MANAGED],
      })
      // 2. Service-scoped plugin: GET 404, find service -> id, list service plugins -> adopts
      .json({ message: 'Not found' }, 404)
      .json({ id: 'svc-1', name: 'my-svc' })
      .json({
        data: [
          {
            id: 'p-svc-exact',
            name: 'cors',
            instance_name: null,
            service: { id: 'svc-1' },
            route: null,
            consumer: null,
            config: { credentials: false },
            tags: null,
          },
        ],
        next: null,
      })
      .json({
        id: 'p-svc-exact',
        name: 'cors',
        instance_name: 'svc-cors',
        service: { id: 'svc-1' },
        config: { credentials: true },
        tags: [MANAGED],
      })
      // 3. Consumer-scoped plugin: GET 404, find consumer -> id, list consumer plugins -> adopts
      .json({ message: 'Not found' }, 404)
      .json({ id: 'c-1', username: 'alice' })
      .json({
        data: [
          {
            id: 'p-consumer-exact',
            name: 'rate-limiting',
            instance_name: null,
            service: null,
            route: null,
            consumer: { id: 'c-1' },
            config: { minute: 60 },
            tags: [MANAGED],
          },
        ],
        next: null,
      })
      .json({
        id: 'p-consumer-exact',
        name: 'rate-limiting',
        instance_name: 'alice-rl',
        consumer: { id: 'c-1' },
        config: { minute: 60 },
        tags: [MANAGED],
      })
      // 4. Global plugin across two pages: page 1 has scoped plugin of same name, page 2 has global plugin
      .json({ message: 'Not found' }, 404)
      .json({
        data: [
          {
            id: 'p-scoped-not-global',
            name: 'prometheus',
            instance_name: null,
            service: { id: 'svc-1' },
            route: null,
            consumer: null,
            config: {},
            tags: null,
          },
        ],
        offset: 'page-2',
      })
      .json({
        data: [
          {
            id: 'p-global-exact',
            name: 'prometheus',
            instance_name: null,
            service: null,
            route: null,
            consumer: null,
            config: { per_consumer: false },
            tags: null,
          },
        ],
        next: null,
      })
      .json({
        id: 'p-global-exact',
        name: 'prometheus',
        instance_name: 'global-prom',
        config: { per_consumer: false },
        tags: [MANAGED],
      });

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const result = await kong.apply({
      plugins: [
        {
          name: 'correlation-id',
          instance_name: 'route-corr',
          route: { name: 'my-route' },
          config: { header_name: 'X-Req' },
        },
        {
          name: 'cors',
          instance_name: 'svc-cors',
          service: { name: 'my-svc' },
          config: { credentials: true },
        },
        {
          name: 'rate-limiting',
          instance_name: 'alice-rl',
          consumer: { username: 'alice' },
          config: { minute: 60 },
        },
        {
          name: 'prometheus',
          instance_name: 'global-prom',
          config: { per_consumer: false },
        },
      ],
    });

    expect(result.summary).toEqual({ create: 0, update: 4, unchanged: 0, delete: 0 });
    expect(result.changes).toEqual([
      {
        type: 'plugins',
        key: 'route-corr',
        action: 'update',
        fields: ['instance_name', 'tags'],
      },
      {
        type: 'plugins',
        key: 'svc-cors',
        action: 'update',
        fields: ['instance_name', 'config', 'tags'],
      },
      {
        type: 'plugins',
        key: 'alice-rl',
        action: 'update',
        fields: ['instance_name'],
      },
      {
        type: 'plugins',
        key: 'global-prom',
        action: 'update',
        fields: ['instance_name', 'tags'],
      },
    ]);

    const patches = fake.requests
      .filter((r) => r.method === 'PATCH')
      .map((r) => ({ path: new URL(r.url).pathname, body: r.json }));
    expect(patches).toEqual([
      {
        path: '/plugins/p-route-exact',
        body: { instance_name: 'route-corr', tags: ['existing-tag', MANAGED] },
      },
      {
        path: '/plugins/p-svc-exact',
        body: { instance_name: 'svc-cors', config: { credentials: true }, tags: [MANAGED] },
      },
      {
        path: '/plugins/p-consumer-exact',
        body: { instance_name: 'alice-rl' },
      },
      {
        path: '/plugins/p-global-exact',
        body: { instance_name: 'global-prom', tags: [MANAGED] },
      },
    ]);
  });

  it('handles dry-run plugin adoption, pending-create parent refs, and 404/error scope lookups', async () => {
    const fake = createFakeFetch()
      // 1. dryRun: service pending create -> plugin skips scope lookup and reports create
      .json({ message: 'Not found' }, 404)
      .json({ message: 'Not found' }, 404)
      // 2. dryRun: explicit missing route id returns 404 on scope lookup -> reports create
      .json({ message: 'Not found' }, 404)
      .json({ message: 'Not found' }, 404)
      // 3. dryRun: existing unnamed global plugin -> reports update with instance_name and zero writes
      .json({ message: 'Not found' }, 404)
      .json({
        data: [
          {
            id: 'p-dry-adopt',
            name: 'correlation-id',
            instance_name: null,
            service: null,
            route: null,
            consumer: null,
            config: { header_name: 'X-Dry' },
            tags: null,
          },
        ],
        next: null,
      });

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const dryRes = await kong.apply(
      {
        services: [{ name: 'brand-new-svc', host: 'example.com' }],
        plugins: [
          {
            name: 'cors',
            instance_name: 'new-svc-cors',
            service: { name: 'brand-new-svc' },
          },
          {
            name: 'cors',
            instance_name: 'ghost-route-cors',
            route: { id: '00000000-0000-4000-8000-000000000000' },
          },
          {
            name: 'correlation-id',
            instance_name: 'dry-global-corr',
            config: { header_name: 'X-Dry' },
          },
        ],
      },
      { dryRun: true },
    );

    expect(dryRes.changes).toEqual([
      { type: 'services', key: 'brand-new-svc', action: 'create' },
      { type: 'plugins', key: 'new-svc-cors', action: 'create' },
      { type: 'plugins', key: 'ghost-route-cors', action: 'create' },
      {
        type: 'plugins',
        key: 'dry-global-corr',
        action: 'update',
        fields: ['instance_name', 'tags'],
      },
    ]);
    expect(fake.requests.every((r) => r.method === 'GET')).toBe(true);

    // Non-404 error during scope lookup propagates wrapped in KongApplyError
    fake.reset();
    fake
      .json({ message: 'Not found' }, 404)
      .json({ message: 'Internal server error' }, 500, { statusText: 'Internal Server Error' });

    const err = await captureApplyError(
      kong.apply({
        plugins: [
          {
            name: 'correlation-id',
            instance_name: 'boom-corr',
          },
        ],
      }),
    );
    expect(err.failed).toEqual({ type: 'plugins', key: 'boom-corr', action: 'unchanged' });
    expect(err.cause).toBeInstanceOf(KongHttpError);
  });

  it('normalizes declared target addresses during matching, diffing, and pruning', async () => {
    const fake = createFakeFetch()
      // GET upstream u1 -> exists
      .json({ id: 'up-1', name: 'u1', tags: [MANAGED] })
      // GET targets on u1 -> Kong stores canonical host:8000 / expanded IPv6
      .json({
        data: [
          { id: 't1', target: '10.0.0.5:8000', weight: 100, tags: [MANAGED] },
          { id: 't2', target: 'Example.COM:8000', weight: 100, tags: [MANAGED] },
          {
            id: 't3',
            target: '[0000:0000:0000:0000:0000:0000:0000:0001]:8000',
            weight: 100,
            tags: [MANAGED],
          },
          {
            id: 't4',
            target: '[2001:0db8:0000:0000:0000:0000:0000:0001]:81',
            weight: 50,
            tags: [MANAGED],
          },
          { id: 't-extra', target: '10.0.0.9:8000', weight: 100, tags: [MANAGED] },
        ],
        next: null,
      })
      // Prune lists: plugins, consumers, routes, services -> empty
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      // Prune targets on u1 -> returns all 5; only t-extra should be deleted
      .json({
        data: [
          { id: 't1', target: '10.0.0.5:8000', weight: 100, tags: [MANAGED] },
          { id: 't2', target: 'Example.COM:8000', weight: 100, tags: [MANAGED] },
          {
            id: 't3',
            target: '[0000:0000:0000:0000:0000:0000:0000:0001]:8000',
            weight: 100,
            tags: [MANAGED],
          },
          {
            id: 't4',
            target: '[2001:0db8:0000:0000:0000:0000:0000:0001]:81',
            weight: 50,
            tags: [MANAGED],
          },
          { id: 't-extra', target: '10.0.0.9:8000', weight: 100, tags: [MANAGED] },
        ],
        next: null,
      })
      .empty(204)
      // Prune upstreams, vaults, snis, ca_certificates, certificates -> empty/kept
      .json({ data: [{ id: 'up-1', name: 'u1', tags: [MANAGED] }], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null })
      .json({ data: [], next: null });

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const result = await kong.apply(
      {
        upstreams: [{ name: 'u1' }],
        targets: [
          { upstream: 'u1', target: '10.0.0.5', weight: 100 },
          { upstream: 'u1', target: 'Example.COM', weight: 100 },
          { upstream: 'u1', target: '::1', weight: 100 },
          { upstream: 'u1', target: '[2001:DB8::1]:81', weight: 50 },
        ],
      },
      { prune: true },
    );

    expect(result.summary).toEqual({ create: 0, update: 0, unchanged: 5, delete: 1 });
    expect(result.changes).toEqual([
      { type: 'upstreams', key: 'u1', action: 'unchanged' },
      { type: 'targets', key: 'u1/10.0.0.5', action: 'unchanged' },
      { type: 'targets', key: 'u1/Example.COM', action: 'unchanged' },
      { type: 'targets', key: 'u1/::1', action: 'unchanged' },
      { type: 'targets', key: 'u1/[2001:DB8::1]:81', action: 'unchanged' },
      { type: 'targets', key: 'u1/10.0.0.9:8000', action: 'delete' },
    ]);
    expect(fake.requests.filter((r) => r.method === 'DELETE')).toHaveLength(1);
    expect(new URL(fake.requests.find((r) => r.method === 'DELETE')!.url).pathname).toBe(
      '/upstreams/u1/targets/t-extra',
    );
  });

  it('uses generated MAP_FIELDS by default and sends PATCH when a map key is removed', async () => {
    const fake = createFakeFetch()
      .json({
        id: 'p-log',
        name: 'http-log',
        instance_name: 'hl-1',
        config: {
          http_endpoint: 'https://logs.example.com',
          headers: { 'x-keep': '1', 'x-remove': '2' },
        },
        tags: [MANAGED],
      })
      .json({
        id: 'p-log',
        name: 'http-log',
        instance_name: 'hl-1',
        config: {
          http_endpoint: 'https://logs.example.com',
          headers: { 'x-keep': '1' },
        },
        tags: [MANAGED],
      });

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const result = await kong.apply({
      plugins: [
        {
          name: 'http-log',
          instance_name: 'hl-1',
          config: {
            http_endpoint: 'https://logs.example.com',
            headers: { 'x-keep': '1' },
          },
        },
      ],
    });

    expect(result.changes).toEqual([
      { type: 'plugins', key: 'hl-1', action: 'update', fields: ['config'] },
    ]);
    expect(fake.requests[1]!.method).toBe('PATCH');
    expect(fake.requests[1]!.json).toEqual({
      config: { http_endpoint: 'https://logs.example.com', headers: { 'x-keep': '1' } },
    });
  });

  it('passes unsplittable service url untouched so Kong answers with its own error', async () => {
    const fake = createFakeFetch()
      .json({ message: 'Not found' }, 404)
      .json(
        {
          message: 'schema violation (host: required field missing)',
          name: 'schema violation',
          code: 2,
          fields: { host: 'required field missing' },
        },
        400,
      );

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const err = await captureApplyError(
      kong.apply({ services: [{ name: 'bad-url', url: 'example.com/x' }] }),
    );
    expect(err.failed).toEqual({ type: 'services', key: 'bad-url', action: 'create' });
    expect(err.cause).toBeInstanceOf(KongHttpError);
    expect(fake.requests[1]!.json).toEqual({
      name: 'bad-url',
      url: 'example.com/x',
      tags: [MANAGED],
    });
  });

  it('enforces typed plugin configs on inline apply() calls and accepts ApplyConfig variables', () => {
    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: createFakeFetch().fetch });

    const typeChecks = () => {
      // 1. Valid inline known plugin + custom unknown plugin
      expectTypeOf(
        kong.apply({
          plugins: [
            {
              name: 'http-log',
              instance_name: 'log-1',
              config: { http_endpoint: 'https://logs.example.com' },
            },
            {
              name: 'my-custom-plugin',
              instance_name: 'custom-1',
              config: { arbitrary: 123, nested: true },
            },
          ],
        }),
      ).toEqualTypeOf<Promise<ApplyResult>>();

      // 2. Unknown field in a known plugin config is a compile error
      void kong.apply({
        plugins: [
          {
            name: 'http-log',
            instance_name: 'log-bad-field',
            // @ts-expect-error unknown config property on http-log
            config: { http_endpoint: 'https://logs.example.com', not_a_real_field: true },
          },
        ],
      });

      // 2b. Wrong type in a known plugin config is a compile error
      void kong.apply({
        plugins: [
          {
            name: 'http-log',
            instance_name: 'log-bad-type',
            // @ts-expect-error timeout must be a number
            config: { http_endpoint: 'https://logs.example.com', timeout: 'ten' },
          },
        ],
      });

      // 3. A config stored in a variable of type ApplyConfig is accepted
      const variableConfig: ApplyConfig = {
        services: [{ name: 's1', host: 'example.com' }],
        plugins: [
          {
            name: 'http-log',
            instance_name: 'log-var',
            config: { http_endpoint: 'https://logs.example.com' },
          },
        ],
      };
      void kong.apply(variableConfig);

      // 4. Missing instance_name on a plugin is a compile error
      void kong.apply({
        plugins: [
          // @ts-expect-error instance_name is required in ApplyConfig.plugins
          {
            name: 'http-log',
            config: { http_endpoint: 'https://logs.example.com' },
          },
        ],
      });

      // Empty config is also valid
      void kong.apply({});
    };

    expect(typeof typeChecks).toBe('function');
  });
});
