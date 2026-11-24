import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../../support/crud.js';
import { captureHttpError } from '../../support/errors.js';
import {
  eventually,
  getLiveEnv,
  getUpstreamRequests,
  liveKong,
  unique,
} from '../../support/live.js';

interface EchoBody {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

function parseEchoBody(value: unknown): EchoBody {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('method' in value) ||
    typeof value.method !== 'string' ||
    !('path' in value) ||
    typeof value.path !== 'string' ||
    !('body' in value) ||
    typeof value.body !== 'string' ||
    !('headers' in value) ||
    typeof value.headers !== 'object' ||
    value.headers === null
  ) {
    throw new Error(`Unexpected /echo payload: ${JSON.stringify(value)}`);
  }
  const headers: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(value.headers)) {
    if (typeof v === 'string') {
      headers[k] = v;
    } else if (Array.isArray(v) && v.every((entry) => typeof entry === 'string')) {
      headers[k] = v;
    }
  }
  return { method: value.method, path: value.path, headers, body: value.body };
}

describe('live plugins: enable() and proxy behaviour', () => {
  const env = getLiveEnv();
  const kong = liveKong();

  async function createEchoRoute(prefix: string): Promise<{
    serviceId: string;
    serviceName: string;
    routeId: string;
    routeName: string;
    routePath: string;
    cleanup: () => Promise<void>;
  }> {
    const serviceName = unique(`${prefix}-svc`);
    const routeName = unique(`${prefix}-route`);
    const routePath = `/${unique(prefix)}`;
    const service = await kong.services.create({
      name: serviceName,
      url: `${env.upstreamInternalUrl}/echo`,
    });
    const route = await kong.services.routes(service.id).create({
      name: routeName,
      paths: [routePath],
      protocols: ['http', 'https'],
    });
    return {
      serviceId: service.id,
      serviceName,
      routeId: route.id,
      routeName,
      routePath,
      cleanup: async () => {
        await deleteIgnoringNotFound(() => kong.routes.delete(route.id));
        await deleteIgnoringNotFound(() => kong.services.delete(service.id));
      },
    };
  }

  it('is idempotent on repeated calls and updates config in place with the same plugin id', async () => {
    const { routeId, routeName, cleanup } = await createEchoRoute('enable-idem');
    const tag = unique('enable-idem-tag');
    let pluginId: string | undefined;

    try {
      const first = await kong.plugins.enable('correlation-id', {
        on: { route: routeName },
        config: { header_name: 'X-First-ID', echo_downstream: true },
        tags: [tag],
      });
      pluginId = first.id;
      expect(first.instance_name).toBe(`correlation-id.route.${routeName}`);
      expect(first.config.header_name).toBe('X-First-ID');

      // Repeating with identical arguments keeps the exact same id and leaves one plugin.
      const second = await kong.plugins.enable('correlation-id', {
        on: { route: routeName },
        config: { header_name: 'X-First-ID', echo_downstream: true },
        tags: [tag],
      });
      expect(second.id).toBe(first.id);

      const listedAfterRepeat = await kong.routes.plugins(routeId).all({ tags: [tag] });
      expect(listedAfterRepeat).toHaveLength(1);
      expect(listedAfterRepeat[0]?.id).toBe(first.id);

      // Calling again with a changed config updates that same plugin in place.
      const updated = await kong.plugins.enable('correlation-id', {
        on: { route: routeName },
        config: { header_name: 'X-Updated-ID', echo_downstream: false },
        tags: [tag],
      });
      expect(updated.id).toBe(first.id);
      expect(updated.config.header_name).toBe('X-Updated-ID');
      expect(updated.config.echo_downstream).toBe(false);

      const fetched = await kong.plugins.get(first.id);
      expect(fetched.config).toMatchObject({
        header_name: 'X-Updated-ID',
        echo_downstream: false,
      });

      const listedAfterUpdate = await kong.routes.plugins(routeId).all({ tags: [tag] });
      expect(listedAfterUpdate).toHaveLength(1);
    } finally {
      if (pluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(pluginId!));
      }
      await cleanup();
    }
  });

  it('adopts existing unnamed plugins on route, global, and service+consumer scopes, and rejects 409 on cross-scope instance_name collision', async () => {
    const routeA = await createEchoRoute('adopt-a');
    const routeB = await createEchoRoute('adopt-b');
    const consumerUsername = unique('adopt-user');
    const sharedInstanceName = unique('shared-inst');

    const createdPluginIds: string[] = [];
    let consumerId: string | undefined;

    try {
      // 1. Route plugin created without instance_name -> adopted by enable()
      const legacyRoutePlugin = await kong.routes.plugins(routeA.routeId).create({
        name: 'correlation-id',
        config: { header_name: 'X-Legacy-Route', echo_downstream: true },
      });
      createdPluginIds.push(legacyRoutePlugin.id);
      expect(legacyRoutePlugin.instance_name).toBeNull();

      const adoptedRoutePlugin = await kong.plugins.enable('correlation-id', {
        on: { route: routeA.routeName },
        config: { header_name: 'X-Adopted-Route', echo_downstream: false },
      });
      expect(adoptedRoutePlugin.id).toBe(legacyRoutePlugin.id);
      expect(adoptedRoutePlugin.instance_name).toBe(`correlation-id.route.${routeA.routeName}`);
      expect(adoptedRoutePlugin.config.header_name).toBe('X-Adopted-Route');
      expect(adoptedRoutePlugin.config.echo_downstream).toBe(false);
      expect(await kong.routes.plugins(routeA.routeId).all()).toHaveLength(1);

      // 2. Global plugin created without instance_name -> adopted by enable()
      const legacyGlobalPlugin = await kong.plugins.create({
        name: 'correlation-id',
        config: { header_name: 'X-Legacy-Global', echo_downstream: true },
      });
      createdPluginIds.push(legacyGlobalPlugin.id);
      expect(legacyGlobalPlugin.instance_name).toBeNull();

      const adoptedGlobalPlugin = await kong.plugins.enable('correlation-id', {
        config: { header_name: 'X-Adopted-Global', echo_downstream: false },
      });
      expect(adoptedGlobalPlugin.id).toBe(legacyGlobalPlugin.id);
      expect(adoptedGlobalPlugin.instance_name).toBe('correlation-id');
      expect(adoptedGlobalPlugin.config.header_name).toBe('X-Adopted-Global');
      expect(adoptedGlobalPlugin.config.echo_downstream).toBe(false);
      expect(adoptedGlobalPlugin.service).toBeNull();
      expect(adoptedGlobalPlugin.route).toBeNull();
      expect(adoptedGlobalPlugin.consumer).toBeNull();

      // 3. Service + consumer plugin created without instance_name -> adopted by enable()
      const consumer = await kong.consumers.create({ username: consumerUsername });
      consumerId = consumer.id;

      const legacyScopedPlugin = await kong.services.plugins(routeA.serviceId).create({
        name: 'rate-limiting',
        consumer: { id: consumer.id },
        config: { minute: 50, policy: 'local' },
      });
      createdPluginIds.push(legacyScopedPlugin.id);
      expect(legacyScopedPlugin.instance_name).toBeNull();

      const adoptedScopedPlugin = await kong.plugins.enable('rate-limiting', {
        on: { service: routeA.serviceName, consumer: consumerUsername },
        config: { minute: 20, policy: 'local' },
      });
      expect(adoptedScopedPlugin.id).toBe(legacyScopedPlugin.id);
      expect(adoptedScopedPlugin.instance_name).toBe(
        `rate-limiting.service.${routeA.serviceName}.consumer.${consumerUsername}`,
      );
      expect(adoptedScopedPlugin.config.minute).toBe(20);
      expect(adoptedScopedPlugin.service?.id).toBe(routeA.serviceId);
      expect(adoptedScopedPlugin.consumer?.id).toBe(consumer.id);
      expect(adoptedScopedPlugin.route).toBeNull();

      // 4. Explicit instance_name already used on another scope -> rejects with 409
      // When routeB already has an unnamed response-transformer, adopting it with an
      // instance_name owned by routeA triggers a 409 on instance_name and leaves both untouched.
      const ownerPlugin = await kong.plugins.enable('response-transformer', {
        on: { route: routeA.routeName },
        instanceName: sharedInstanceName,
        config: { add: { headers: ['X-Owner:a'] } },
      });
      createdPluginIds.push(ownerPlugin.id);

      const legacyRouteBPlugin = await kong.routes.plugins(routeB.routeId).create({
        name: 'response-transformer',
        config: { add: { headers: ['X-Legacy:b'] } },
      });
      createdPluginIds.push(legacyRouteBPlugin.id);

      const conflict = await captureHttpError(
        kong.plugins.enable('response-transformer', {
          on: { route: routeB.routeName },
          instanceName: sharedInstanceName,
          config: { add: { headers: ['X-Owner:b'] } },
        }),
      );
      expect(conflict.status).toBe(409);
      expect(conflict.kongName).toBe('unique constraint violation');
      expect(conflict.fields).toEqual({ instance_name: sharedInstanceName });

      const ownerAfter = await kong.plugins.get(ownerPlugin.id);
      expect(ownerAfter.route?.id).toBe(routeA.routeId);
      expect(ownerAfter.instance_name).toBe(sharedInstanceName);
      const routeBAfter = await kong.plugins.get(legacyRouteBPlugin.id);
      expect(routeBAfter.instance_name).toBeNull();
    } finally {
      for (const id of createdPluginIds.reverse()) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(id));
      }
      if (consumerId) {
        await deleteIgnoringNotFound(() => kong.consumers.delete(consumerId!));
      }
      await routeB.cleanup();
      await routeA.cleanup();
    }
  });

  it('adopts the service-only plugin when a service+route plugin of the same name also exists', async () => {
    const echo = await createEchoRoute('adopt-svc-route');
    const createdPluginIds: string[] = [];

    try {
      // Create service+route first so it precedes the service-only plugin in /services/{id}/plugins.
      const svcAndRoute = await kong.plugins.create({
        name: 'rate-limiting',
        service: { id: echo.serviceId },
        route: { id: echo.routeId },
        config: { minute: 10, policy: 'local' },
      });
      createdPluginIds.push(svcAndRoute.id);
      expect(svcAndRoute.instance_name).toBeNull();
      expect(svcAndRoute.service?.id).toBe(echo.serviceId);
      expect(svcAndRoute.route?.id).toBe(echo.routeId);

      const svcOnly = await kong.services.plugins(echo.serviceId).create({
        name: 'rate-limiting',
        config: { minute: 30, policy: 'local' },
      });
      createdPluginIds.push(svcOnly.id);
      expect(svcOnly.instance_name).toBeNull();
      expect(svcOnly.service?.id).toBe(echo.serviceId);
      expect(svcOnly.route).toBeNull();

      // Direct findOnScope distinguishes service-only from service+route.
      const lookedUp = await kong.plugins.findOnScope('rate-limiting', {
        service: echo.serviceId,
      });
      expect(lookedUp?.id).toBe(svcOnly.id);

      // enable() on service S alone adopts svcOnly and leaves svcAndRoute untouched.
      const adopted = await kong.plugins.enable('rate-limiting', {
        on: { service: echo.serviceName },
        config: { minute: 60, policy: 'local' },
      });
      expect(adopted.id).toBe(svcOnly.id);
      expect(adopted.instance_name).toBe(`rate-limiting.service.${echo.serviceName}`);
      expect(adopted.service?.id).toBe(echo.serviceId);
      expect(adopted.route).toBeNull();
      expect(adopted.consumer).toBeNull();
      expect(adopted.config.minute).toBe(60);

      const svcAndRouteAfter = await kong.plugins.get(svcAndRoute.id);
      expect(svcAndRouteAfter.instance_name).toBeNull();
      expect(svcAndRouteAfter.service?.id).toBe(echo.serviceId);
      expect(svcAndRouteAfter.route?.id).toBe(echo.routeId);
      expect(svcAndRouteAfter.config).toMatchObject({ minute: 10 });
    } finally {
      for (const id of createdPluginIds.reverse()) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(id));
      }
      await echo.cleanup();
    }
  });

  it('pins instance_name character rules and sanitizes rejected ASCII chars in derived names', async () => {
    const consumerUsername = `${unique('user')}+ops@example.com`;
    const allowedInstanceName = `${unique('inst')}.a_b-c~café`;
    const createdPluginIds: string[] = [];
    let consumerId: string | undefined;

    try {
      // Kong accepts ASCII alphanumerics, ., -, _, ~, and non-ASCII UTF-8 in instance_name.
      const valid = await kong.plugins.enable('correlation-id', {
        instanceName: allowedInstanceName,
        config: { header_name: 'X-Valid-Name' },
      });
      createdPluginIds.push(valid.id);
      expect(valid.instance_name).toBe(allowedInstanceName);

      // Kong rejects other ASCII characters (such as '@' or ':') with 400 on both PUT /plugins/{key}
      // (`invalid unique instance_name`) and POST /schemas/plugins/validate (`schema violation`).
      const badInstanceName = `${unique('bad')}@host:1`;
      const putError = await captureHttpError(
        kong.plugins.enable('correlation-id', {
          instanceName: badInstanceName,
        }),
      );
      expect(putError.status).toBe(400);
      expect(putError.kongName).toBe('invalid unique instance_name');
      expect(putError.message).toContain(
        'the only accepted ascii characters are alphanumerics or ., -, _, and ~',
      );

      const validateError = await captureHttpError(
        kong.schemas.validatePlugin({
          name: 'correlation-id',
          instance_name: badInstanceName,
          config: {},
        }),
      );
      expect(validateError.status).toBe(400);
      expect(validateError.kongName).toBe('schema violation');
      expect(String(validateError.fields?.instance_name)).toContain(
        'the only accepted ascii characters are alphanumerics or ., -, _, and ~',
      );

      // Consumers allow '+' and '@' in username; enable() replaces those in the derived instance_name.
      const consumer = await kong.consumers.create({ username: consumerUsername });
      consumerId = consumer.id;

      const derived = await kong.plugins.enable('rate-limiting', {
        on: { consumer: consumerUsername },
        config: { minute: 100, policy: 'local' },
      });
      createdPluginIds.push(derived.id);
      expect(derived.consumer?.id).toBe(consumer.id);
      expect(derived.instance_name).toBe(
        `rate-limiting.consumer.${consumerUsername.replace(/[+@]/g, '-')}`,
      );

      // Scope by UUID also works and attaches to the same consumer.
      const byUuid = await kong.plugins.enable('response-transformer', {
        on: { consumer: consumer.id },
        config: { add: { headers: ['X-Consumer-Uuid:1'] } },
      });
      createdPluginIds.push(byUuid.id);
      expect(byUuid.consumer?.id).toBe(consumer.id);
      expect(byUuid.instance_name).toBe(`response-transformer.consumer.${consumer.id}`);
    } finally {
      for (const id of createdPluginIds.reverse()) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(id));
      }
      if (consumerId) {
        await deleteIgnoringNotFound(() => kong.consumers.delete(consumerId!));
      }
    }
  });

  it('behaviour 1/7 (key-auth): allows requests before enable, then 401 without key and 200 with consumer key', async () => {
    const { routeName, routePath, cleanup } = await createEchoRoute('beh-keyauth');
    const consumerUsername = unique('ka-user');
    const apiKey = unique('ka-secret');
    const probe = unique('ka-probe');

    let pluginId: string | undefined;
    let consumerId: string | undefined;

    try {
      // Baseline: without key-auth, requests succeed with 200.
      const baseline = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 200) {
          throw new Error(`Expected baseline 200, got ${res.status}`);
        }
        return parseEchoBody(await res.json());
      });
      expect(baseline.path).toBe(`/echo/${probe}`);

      const consumer = await kong.consumers.create({ username: consumerUsername });
      consumerId = consumer.id;
      await kong.consumers.keyAuth(consumer.id).create({ key: apiKey });

      const plugin = await kong.plugins.enable('key-auth', {
        on: { route: routeName },
        config: { key_names: ['apikey'] },
      });
      pluginId = plugin.id;

      // Without key: 401
      await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 401) {
          throw new Error(`Expected 401 without key, got ${res.status}`);
        }
      });

      // With valid consumer key: 200
      const authed = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`, {
          headers: { apikey: apiKey },
        });
        if (res.status !== 200) {
          throw new Error(`Expected 200 with valid key, got ${res.status}`);
        }
        return parseEchoBody(await res.json());
      });
      expect(authed.path).toBe(`/echo/${probe}`);
    } finally {
      if (pluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(pluginId!));
      }
      if (consumerId) {
        await deleteIgnoringNotFound(() => kong.consumers.delete(consumerId!));
      }
      await cleanup();
    }
  });

  it('behaviour 2/7 (ip-restriction): allows requests before enable, then denies caller with 403', async () => {
    const { routeName, routePath, cleanup } = await createEchoRoute('beh-ip');
    const probe = unique('ip-probe');
    let pluginId: string | undefined;

    try {
      // Baseline: 200 before ip-restriction is enabled.
      await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 200) {
          throw new Error(`Expected baseline 200, got ${res.status}`);
        }
      });

      const plugin = await kong.plugins.enable('ip-restriction', {
        on: { route: routeName },
        config: { deny: ['0.0.0.0/0', '::/0'] },
      });
      pluginId = plugin.id;

      // Denied: 403
      await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 403) {
          throw new Error(`Expected 403 when IP denied, got ${res.status}`);
        }
      });
    } finally {
      if (pluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(pluginId!));
      }
      await cleanup();
    }
  });

  it('behaviour 3/7 (rate-limiting): allows burst before enable, then returns 429 once limit is exceeded', async () => {
    const { routeName, routePath, cleanup } = await createEchoRoute('beh-rl');
    const probe = unique('rl-probe');
    let pluginId: string | undefined;

    try {
      // Baseline: 3 consecutive requests all return 200 before rate-limiting is enabled
      // (polled with eventually so every Kong worker has loaded the new route).
      await eventually(async () => {
        for (let i = 0; i < 3; i += 1) {
          const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
          if (res.status !== 200) {
            throw new Error(`Expected baseline 200 on request ${i + 1}/3, got ${res.status}`);
          }
        }
      });

      const plugin = await kong.plugins.enable('rate-limiting', {
        on: { route: routeName },
        config: { minute: 2, policy: 'local' },
      });
      pluginId = plugin.id;

      // Once active and limit (2/min) is exceeded, Kong returns 429 with rate-limit headers.
      const throttled = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 429) {
          throw new Error(`Expected 429 once limit passed, got ${res.status}`);
        }
        return res;
      });
      expect(throttled.headers.get('x-ratelimit-limit-minute')).toBe('2');
    } finally {
      if (pluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(pluginId!));
      }
      await cleanup();
    }
  });

  it('behaviour 4/7 (pre-function): header absent before enable, then injected in access phase', async () => {
    const { routeName, routePath, cleanup } = await createEchoRoute('beh-prefn');
    const probe = unique('prefn-probe');
    const expectedValue = unique('lua-val');
    let pluginId: string | undefined;

    try {
      // Baseline: X-Pre-Fn header is absent.
      const before = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 200) {
          throw new Error(`Expected baseline 200, got ${res.status}`);
        }
        return parseEchoBody(await res.json());
      });
      expect(before.headers['x-pre-fn']).toBeUndefined();

      const plugin = await kong.plugins.enable('pre-function', {
        on: { route: routeName },
        config: {
          access: [`kong.service.request.set_header('X-Pre-Fn', '${expectedValue}')`],
        },
      });
      pluginId = plugin.id;

      // With pre-function active, the Lua access hook sets X-Pre-Fn before proxying.
      const after = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 200) {
          throw new Error(`Expected 200, got ${res.status}`);
        }
        const body = parseEchoBody(await res.json());
        if (body.headers['x-pre-fn'] !== expectedValue) {
          throw new Error(
            `Waiting for x-pre-fn=${expectedValue}, got ${String(body.headers['x-pre-fn'])}`,
          );
        }
        return body;
      });
      expect(after.headers['x-pre-fn']).toBe(expectedValue);
    } finally {
      if (pluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(pluginId!));
      }
      await cleanup();
    }
  });

  it('behaviour 5/7 (prometheus): service absent from metrics before enable, then exported after request', async () => {
    const { serviceName, routeName, routePath, cleanup } = await createEchoRoute('beh-prom');
    const probe = unique('prom-probe');
    let pluginId: string | undefined;

    try {
      // Baseline: proxying without prometheus plugin leaves this service absent from /metrics.
      await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 200) {
          throw new Error(`Expected baseline 200, got ${res.status}`);
        }
      });
      const metricsBefore = await kong.node.metrics();
      expect(metricsBefore).not.toContain(`service="${serviceName}"`);

      const plugin = await kong.plugins.enable('prometheus', {
        on: { route: routeName },
        config: { status_code_metrics: true },
      });
      pluginId = plugin.id;

      // With prometheus active, proxying emits a series tagged with this service.
      const metricsAfter = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 200) {
          throw new Error(`Expected 200, got ${res.status}`);
        }
        const text = await kong.node.metrics();
        if (!text.includes(`service="${serviceName}"`)) {
          throw new Error(`Waiting for prometheus series with service="${serviceName}"`);
        }
        return text;
      });
      expect(metricsAfter).toContain(`service="${serviceName}"`);
    } finally {
      if (pluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(pluginId!));
      }
      await cleanup();
    }
  });

  it('behaviour 6/7 (request-transformer): added header absent before enable, then reaches upstream', async () => {
    const { routeName, routePath, cleanup } = await createEchoRoute('beh-reqtx');
    const probe = unique('reqtx-probe');
    const headerVal = unique('tx-val');
    let pluginId: string | undefined;

    try {
      // Baseline: X-Transformed-Header is absent.
      const before = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 200) {
          throw new Error(`Expected baseline 200, got ${res.status}`);
        }
        return parseEchoBody(await res.json());
      });
      expect(before.headers['x-transformed-header']).toBeUndefined();

      const plugin = await kong.plugins.enable('request-transformer', {
        on: { route: routeName },
        config: {
          add: { headers: [`X-Transformed-Header:${headerVal}`] },
        },
      });
      pluginId = plugin.id;

      const after = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 200) {
          throw new Error(`Expected 200, got ${res.status}`);
        }
        const body = parseEchoBody(await res.json());
        if (body.headers['x-transformed-header'] !== headerVal) {
          throw new Error(
            `Waiting for x-transformed-header=${headerVal}, got ${String(body.headers['x-transformed-header'])}`,
          );
        }
        return body;
      });
      expect(after.headers['x-transformed-header']).toBe(headerVal);
    } finally {
      if (pluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(pluginId!));
      }
      await cleanup();
    }
  });

  it('behaviour 7/7 (http-log): no log sent before enable, then /collect receives an entry', async () => {
    const { routeName, routePath, cleanup } = await createEchoRoute('beh-httplog');
    const beforeProbe = unique('log-before');
    const afterProbe = unique('log-after');
    let pluginId: string | undefined;

    try {
      // Baseline: proxying before http-log sends nothing for beforeProbe to /collect.
      await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${beforeProbe}`);
        if (res.status !== 200) {
          throw new Error(`Expected baseline 200, got ${res.status}`);
        }
      });
      const collectedBefore = await getUpstreamRequests('/collect');
      expect(collectedBefore.some((entry) => entry.body.includes(beforeProbe))).toBe(false);

      const plugin = await kong.plugins.enable('http-log', {
        on: { route: routeName },
        config: {
          http_endpoint: `${env.upstreamInternalUrl}/collect`,
          queue: { max_coalescing_delay: 0.1, max_batch_size: 1 },
        },
      });
      pluginId = plugin.id;

      // With http-log active, proxying produces a POST /collect entry containing afterProbe.
      const matched = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${afterProbe}`);
        if (res.status !== 200) {
          throw new Error(`Expected 200, got ${res.status}`);
        }
        const entries = await getUpstreamRequests('/collect');
        const hit = entries.find(
          (entry) => entry.method === 'POST' && entry.body.includes(afterProbe),
        );
        if (!hit) {
          throw new Error(`Waiting for /collect log entry mentioning ${afterProbe}`);
        }
        return hit;
      });
      expect(matched.path).toBe('/collect');
      expect(matched.body).toContain(afterProbe);
    } finally {
      if (pluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(pluginId!));
      }
      await cleanup();
    }
  });
});
