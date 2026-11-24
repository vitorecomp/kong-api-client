import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { expandServiceInput, expandServiceUrl } from '../../src/apply/url.js';
import type { ApplyConfig, ServiceInput } from '../../src/index.js';
import { deleteIgnoringNotFound } from '../support/crud.js';
import { captureHttpError } from '../support/errors.js';
import { TLS_FIXTURES } from '../support/fixtures/tls/index.js';
import { getLiveEnv, liveKong, unique } from '../support/live.js';

function createCountingKong() {
  const methods: string[] = [];
  const kong = liveKong({
    fetch: (input, init) => {
      const method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
      methods.push(method);
      return globalThis.fetch(input, init);
    },
  });
  return {
    kong,
    methods,
    resetCounts: () => {
      methods.length = 0;
    },
    writeCount: () => methods.filter((m) => m !== 'GET').length,
  };
}

describe('Kong.apply live tests', () => {
  it('creates, idempotently re-applies with zero writes, updates every resource type, and supports dryRun', async () => {
    const { kong, resetCounts, writeCount } = createCountingKong();
    const tag = unique('apply-full');
    const certId = randomUUID();
    const caCertId = randomUUID();
    const sniName = `${unique('apply-sni')}.example.invalid`;
    const vaultPrefix = unique('apply-vlt').toLowerCase();
    const upstreamName = `${unique('apply-up')}.example.invalid`;
    const serviceName = unique('apply-svc');
    const routeName = unique('apply-route');
    const routePath = `/${unique('apply-p')}`;
    const consumerName = unique('apply-user');
    const svcPluginName = unique('apply-svc-plug');
    const routePluginName = unique('apply-rt-plug');

    const baseConfig: ApplyConfig<['correlation-id', 'cors']> = {
      certificates: [
        {
          id: certId,
          cert: TLS_FIXTURES.rsaCert,
          key: TLS_FIXTURES.rsaKey,
        },
      ],
      ca_certificates: [
        {
          id: caCertId,
          cert: TLS_FIXTURES.ca1,
        },
      ],
      snis: [
        {
          name: sniName,
          certificate: { id: certId },
        },
      ],
      vaults: [
        {
          prefix: vaultPrefix,
          name: 'env',
          description: 'initial description',
          config: { prefix: 'KONG_APPLY_TEST_' },
        },
      ],
      upstreams: [
        {
          name: upstreamName,
          slots: 200,
        },
      ],
      targets: [
        { upstream: upstreamName, target: '10.0.1.1:8080', weight: 50 },
        { upstream: upstreamName, target: '10.0.1.2:8080', weight: 100 },
      ],
      services: [
        {
          name: serviceName,
          url: 'http://upstream:8080/echo',
          retries: 5,
        },
      ],
      routes: [
        {
          name: routeName,
          service: { name: serviceName },
          paths: [routePath],
          protocols: ['http', 'https'],
          regex_priority: 10,
        },
      ],
      consumers: [
        {
          username: consumerName,
          custom_id: 'cid-v1',
        },
      ],
      plugins: [
        {
          name: 'correlation-id',
          instance_name: svcPluginName,
          service: { name: serviceName },
          config: { header_name: 'X-Apply-One' },
        },
        {
          name: 'cors',
          instance_name: routePluginName,
          route: { name: routeName },
          enabled: true,
          config: { credentials: false },
        },
      ],
    };

    try {
      // 1. First run: every entity created
      const first = await kong.apply(baseConfig, { tag });
      expect(first.dryRun).toBe(false);
      expect(first.summary).toEqual({ create: 12, update: 0, unchanged: 0, delete: 0 });
      expect(first.changes.every((c) => c.action === 'create')).toBe(true);

      // 2. Second run: every entity unchanged, ZERO write requests
      resetCounts();
      const second = await kong.apply(baseConfig, { tag });
      expect(second.summary).toEqual({ create: 0, update: 0, unchanged: 12, delete: 0 });
      expect(second.changes.every((c) => c.action === 'unchanged')).toBe(true);
      expect(writeCount()).toBe(0);

      // 3. Change one field of every type
      const extraCaTag = unique('ca-upd');
      const extraSniTag = unique('sni-upd');
      const updatedConfig: ApplyConfig<['correlation-id', 'cors']> = {
        certificates: [
          {
            id: certId,
            cert: TLS_FIXTURES.rsaCert,
            key: TLS_FIXTURES.rsaKey,
            cert_alt: TLS_FIXTURES.ecdsaCert,
            key_alt: TLS_FIXTURES.ecdsaKey,
          },
        ],
        ca_certificates: [
          {
            id: caCertId,
            cert: TLS_FIXTURES.ca1,
            tags: [extraCaTag],
          },
        ],
        snis: [
          {
            name: sniName,
            certificate: { id: certId },
            tags: [extraSniTag],
          },
        ],
        vaults: [
          {
            prefix: vaultPrefix,
            name: 'env',
            description: 'updated description',
            config: { prefix: 'KONG_APPLY_TEST_' },
          },
        ],
        upstreams: [
          {
            name: upstreamName,
            slots: 400,
          },
        ],
        targets: [
          { upstream: upstreamName, target: '10.0.1.1:8080', weight: 80 },
          { upstream: upstreamName, target: '10.0.1.2:8080', weight: 100 },
        ],
        services: [
          {
            name: serviceName,
            url: 'http://upstream:8080/echo',
            retries: 9,
          },
        ],
        routes: [
          {
            name: routeName,
            service: { name: serviceName },
            paths: [routePath],
            protocols: ['https', 'http'],
            regex_priority: 25,
          },
        ],
        consumers: [
          {
            username: consumerName,
            custom_id: 'cid-v2',
          },
        ],
        plugins: [
          {
            name: 'correlation-id',
            instance_name: svcPluginName,
            service: { name: serviceName },
            config: { header_name: 'X-Apply-Two' },
          },
          {
            name: 'cors',
            instance_name: routePluginName,
            route: { name: routeName },
            enabled: false,
            config: { credentials: false },
          },
        ],
      };

      const third = await kong.apply(updatedConfig, { tag });
      expect(third.summary).toEqual({ create: 0, update: 11, unchanged: 1, delete: 0 });
      expect(third.changes).toEqual([
        { type: 'certificates', key: certId, action: 'update', fields: ['cert_alt', 'key_alt'] },
        { type: 'ca_certificates', key: caCertId, action: 'update', fields: ['tags'] },
        { type: 'snis', key: sniName, action: 'update', fields: ['tags'] },
        { type: 'vaults', key: vaultPrefix, action: 'update', fields: ['description'] },
        { type: 'upstreams', key: upstreamName, action: 'update', fields: ['slots'] },
        {
          type: 'targets',
          key: `${upstreamName}/10.0.1.1:8080`,
          action: 'update',
          fields: ['weight'],
        },
        { type: 'targets', key: `${upstreamName}/10.0.1.2:8080`, action: 'unchanged' },
        { type: 'services', key: serviceName, action: 'update', fields: ['retries'] },
        { type: 'routes', key: routeName, action: 'update', fields: ['regex_priority'] },
        { type: 'consumers', key: consumerName, action: 'update', fields: ['custom_id'] },
        { type: 'plugins', key: svcPluginName, action: 'update', fields: ['config'] },
        { type: 'plugins', key: routePluginName, action: 'update', fields: ['enabled'] },
      ]);

      // Verify fresh reads reflect every update
      expect((await kong.certificates.get(certId)).cert_alt).toBe(TLS_FIXTURES.ecdsaCert);
      expect((await kong.caCertificates.get(caCertId)).tags).toContain(extraCaTag);
      expect((await kong.snis.get(sniName)).tags).toContain(extraSniTag);
      expect((await kong.vaults.get(vaultPrefix)).description).toBe('updated description');
      expect((await kong.upstreams.get(upstreamName)).slots).toBe(400);
      const liveTargets = await kong.upstreams.targets(upstreamName).all();
      expect(liveTargets.find((t) => t.target === '10.0.1.1:8080')?.weight).toBe(80);
      expect((await kong.services.get(serviceName)).retries).toBe(9);
      expect((await kong.routes.get(routeName)).regex_priority).toBe(25);
      expect((await kong.consumers.get(consumerName)).custom_id).toBe('cid-v2');
      const liveSvcPlugin = await kong.plugins.get(svcPluginName);
      expect(liveSvcPlugin.config).toMatchObject({ header_name: 'X-Apply-Two' });
      expect((await kong.plugins.get(routePluginName)).enabled).toBe(false);

      // 4. Dry run of a further changed config: reports changes without mutating Kong
      resetCounts();
      const dryRunResult = await kong.apply(
        {
          services: [
            {
              name: serviceName,
              url: 'http://upstream:8080/echo',
              retries: 12,
            },
          ],
          consumers: [
            {
              username: consumerName,
              custom_id: 'cid-dry-run',
            },
          ],
        },
        { dryRun: true, tag },
      );
      expect(dryRunResult.dryRun).toBe(true);
      expect(dryRunResult.changes).toEqual([
        { type: 'services', key: serviceName, action: 'update', fields: ['retries'] },
        { type: 'consumers', key: consumerName, action: 'update', fields: ['custom_id'] },
      ]);
      expect(writeCount()).toBe(0);
      expect((await kong.services.get(serviceName)).retries).toBe(9);
      expect((await kong.consumers.get(consumerName)).custom_id).toBe('cid-v2');
    } finally {
      await kong.apply({}, { prune: true, tag });
    }
  });

  it('adds the managed tag to an existing untagged entity while preserving existing tags', async () => {
    const kong = liveKong();
    const tag = unique('apply-adopt');
    const serviceName = unique('adopt-svc');
    const userTag = unique('keep-user-tag');

    const created = await kong.services.create({
      name: serviceName,
      host: 'upstream',
      port: 8080,
      tags: [userTag],
    });

    try {
      const first = await kong.apply(
        {
          services: [{ name: serviceName, host: 'upstream', port: 8080 }],
        },
        { tag },
      );
      expect(first.changes).toEqual([
        { type: 'services', key: serviceName, action: 'update', fields: ['tags'] },
      ]);

      const fetched = await kong.services.get(created.id);
      expect(fetched.tags).toEqual(expect.arrayContaining([userTag, tag]));
      expect(fetched.tags).toHaveLength(2);

      const second = await kong.apply(
        {
          services: [{ name: serviceName, host: 'upstream', port: 8080 }],
        },
        { tag },
      );
      expect(second.changes).toEqual([{ type: 'services', key: serviceName, action: 'unchanged' }]);
    } finally {
      await deleteIgnoringNotFound(() => kong.services.delete(created.id));
    }
  });

  it('adopts an existing plugin created without instance_name, keeping its id and setting instance_name', async () => {
    const { kong, resetCounts, writeCount } = createCountingKong();
    const tag = unique('apply-adopt-plug');
    const serviceName = unique('adopt-plug-svc');
    const routeName = unique('adopt-plug-rt');
    const pluginInstance = unique('adopt-plug-inst');

    const service = await kong.services.create({
      name: serviceName,
      host: 'upstream',
      port: 8080,
      tags: [tag],
    });
    const route = await kong.services.routes(service.id).create({
      name: routeName,
      paths: [`/${unique('adopt-plug')}`],
      protocols: ['http', 'https'],
      tags: [tag],
    });
    // Create a plugin without instance_name (as Kong Manager, decK, or plain create() would)
    const preExisting = await kong.routes.plugins(route.id).create({
      name: 'correlation-id',
      config: {
        header_name: 'X-Pre-Existing',
        echo_downstream: true,
      },
    });
    expect(preExisting.instance_name).toBeNull();

    try {
      const first = await kong.apply(
        {
          services: [{ name: serviceName, host: 'upstream', port: 8080 }],
          routes: [
            {
              name: routeName,
              service: { name: serviceName },
              paths: route.paths ?? [],
              protocols: ['http', 'https'],
            },
          ],
          plugins: [
            {
              name: 'correlation-id',
              instance_name: pluginInstance,
              route: { name: routeName },
              config: { header_name: 'X-Pre-Existing' },
            },
          ],
        },
        { tag },
      );

      expect(first.changes).toEqual([
        { type: 'services', key: serviceName, action: 'unchanged' },
        { type: 'routes', key: routeName, action: 'unchanged' },
        {
          type: 'plugins',
          key: pluginInstance,
          action: 'update',
          fields: ['instance_name', 'tags'],
        },
      ]);

      const adopted = await kong.plugins.get(pluginInstance);
      expect(adopted.id).toBe(preExisting.id);
      expect(adopted.instance_name).toBe(pluginInstance);
      expect(adopted.tags).toContain(tag);
      expect(adopted.config).toMatchObject({
        header_name: 'X-Pre-Existing',
        echo_downstream: true,
      });

      // Second run is idempotent with zero write requests
      resetCounts();
      const second = await kong.apply(
        {
          services: [{ name: serviceName, host: 'upstream', port: 8080 }],
          routes: [
            {
              name: routeName,
              service: { name: serviceName },
              paths: route.paths ?? [],
              protocols: ['http', 'https'],
            },
          ],
          plugins: [
            {
              name: 'correlation-id',
              instance_name: pluginInstance,
              route: { name: routeName },
              config: { header_name: 'X-Pre-Existing' },
            },
          ],
        },
        { tag },
      );
      expect(second.summary).toEqual({ create: 0, update: 0, unchanged: 3, delete: 0 });
      expect(writeCount()).toBe(0);
    } finally {
      await deleteIgnoringNotFound(() => kong.plugins.delete(preExisting.id));
      await deleteIgnoringNotFound(() => kong.routes.delete(route.id));
      await deleteIgnoringNotFound(() => kong.services.delete(service.id));
    }
  });

  it('prunes dropped managed entities and targets while leaving untagged and other-tag entities untouched', async () => {
    const kong = liveKong();
    const tagA = unique('apply-prune-a');
    const tagB = unique('apply-prune-b');
    const keepSvc = unique('prune-keep');
    const dropSvc = unique('prune-drop');
    const untaggedSvc = unique('prune-untagged');
    const otherTagSvc = unique('prune-other');
    const upstreamName = `${unique('prune-up')}.example.invalid`;

    const untagged = await kong.services.create({
      name: untaggedSvc,
      host: 'upstream',
      port: 8080,
    });
    const otherTagged = await kong.services.create({
      name: otherTagSvc,
      host: 'upstream',
      port: 8080,
      tags: [tagB],
    });

    try {
      await kong.apply(
        {
          upstreams: [{ name: upstreamName }],
          targets: [
            { upstream: upstreamName, target: '10.0.2.1:8080', weight: 100 },
            { upstream: upstreamName, target: '10.0.2.2:8080', weight: 100 },
          ],
          services: [
            { name: keepSvc, host: 'upstream', port: 8080 },
            { name: dropSvc, host: 'upstream', port: 8080 },
          ],
        },
        { tag: tagA },
      );

      // Add an untagged target directly on the same upstream
      const untaggedTarget = await kong.upstreams.targets(upstreamName).create({
        target: '10.0.2.9:8080',
        weight: 100,
      });

      const pruned = await kong.apply(
        {
          upstreams: [{ name: upstreamName }],
          targets: [{ upstream: upstreamName, target: '10.0.2.1:8080', weight: 100 }],
          services: [{ name: keepSvc, host: 'upstream', port: 8080 }],
        },
        { prune: true, tag: tagA },
      );

      expect(pruned.summary).toEqual({ create: 0, update: 0, unchanged: 3, delete: 2 });
      expect(pruned.changes).toEqual(
        expect.arrayContaining([
          { type: 'services', key: dropSvc, action: 'delete' },
          { type: 'targets', key: `${upstreamName}/10.0.2.2:8080`, action: 'delete' },
        ]),
      );

      // Dropped managed entities are gone
      await expect(kong.services.find(dropSvc)).resolves.toBeUndefined();
      const remainingTargets = await kong.upstreams.targets(upstreamName).all();
      expect(remainingTargets.map((t) => t.target)).not.toContain('10.0.2.2:8080');

      // Kept, untagged, and other-tag entities are untouched
      expect(await kong.services.find(keepSvc)).toBeDefined();
      expect(await kong.services.find(untagged.id)).toBeDefined();
      expect(await kong.services.find(otherTagged.id)).toBeDefined();
      expect(remainingTargets.some((t) => t.id === untaggedTarget.id)).toBe(true);
    } finally {
      await kong.apply({}, { prune: true, tag: tagA });
      await deleteIgnoringNotFound(() => kong.services.delete(untagged.id));
      await deleteIgnoringNotFound(() => kong.services.delete(otherTagged.id));
    }
  });

  it('expands every service URL shape identically to what Kong stores', async () => {
    const kong = liveKong();
    const { target } = getLiveEnv();
    const cases: Array<ServiceInput & { url: string }> = [
      { url: 'http://example.com' },
      { url: 'http://example.com/' },
      { url: 'https://example.com' },
      { url: 'grpc://example.com' },
      { url: 'grpcs://example.com' },
      { url: 'tcp://example.com' },
      { url: 'tls://example.com' },
      { url: 'udp://example.com' },
      { url: 'tcp://example.com:9000' },
      { url: 'http://example.com/a/../b' },
      { url: 'http://example.com/a%20b' },
      { url: 'http://example.com/p?x=1' },
      { url: 'http://example.com/p#frag' },
      { url: 'http://EXAMPLE.com' },
      { url: 'http://[::1]:8080/x' },
      { url: 'http://user:pw@example.com/x' },
      { url: 'http://a.example.com:81/x', host: 'b.example.com' },
      {
        url: 'http://a.example.com:81/x',
        protocol: 'https',
        port: 99,
        path: '/y',
      },
    ];
    if (target === 'ee-3.14') {
      cases.push({ url: 'ws://example.com' }, { url: 'wss://example.com' });
    }
    const createdIds: string[] = [];

    try {
      for (const input of cases) {
        const created = await kong.services.create({
          name: unique('url-check'),
          ...input,
        });
        createdIds.push(created.id);

        const expandedInput = expandServiceInput(input);
        const expected = expandServiceUrl(input.url);
        expect(expected).toBeDefined();
        expect({
          protocol: created.protocol,
          host: created.host,
          port: created.port,
          path: created.path,
        }).toEqual(expected);
        expect({
          protocol: expandedInput.protocol,
          host: expandedInput.host,
          port: expandedInput.port,
          path: expandedInput.path,
        }).toEqual(expected);
      }

      if (target === 'oss-3.9') {
        for (const wsUrl of ['ws://example.com', 'wss://example.com']) {
          const err = await captureHttpError(
            kong.services.create({ name: unique('url-ws'), url: wsUrl }),
          );
          expect(err.status).toBe(400);
        }
      }

      // Invalid URLs pass through to Kong and receive 400
      for (const invalidUrl of [
        'HTTP://example.com/x',
        'example.com/x',
        'http://example.com:abc/x',
      ]) {
        const payload = expandServiceInput({ name: unique('url-bad'), url: invalidUrl });
        const err = await captureHttpError(kong.services.create(payload));
        expect(err.status).toBe(400);
      }
    } finally {
      for (const id of createdIds) {
        await deleteIgnoringNotFound(() => kong.services.delete(id));
      }
    }
  });

  it('normalizes portless, hostname, and IPv6 target addresses so re-apply is unchanged with zero writes', async () => {
    const { kong, resetCounts, writeCount } = createCountingKong();
    const tag = unique('apply-tgt-norm');
    const upstreamName = `${unique('tgt-norm-up')}.example.invalid`;

    const config: ApplyConfig = {
      upstreams: [{ name: upstreamName }],
      targets: [
        { upstream: upstreamName, target: '10.0.0.5', weight: 100 },
        { upstream: upstreamName, target: 'example.com', weight: 100 },
        { upstream: upstreamName, target: '::1', weight: 100 },
        { upstream: upstreamName, target: '[2001:DB8::1]:81', weight: 50 },
      ],
    };

    try {
      const first = await kong.apply(config, { tag });
      expect(first.summary).toEqual({ create: 5, update: 0, unchanged: 0, delete: 0 });

      resetCounts();
      const second = await kong.apply(config, { tag, prune: true });
      expect(second.summary).toEqual({ create: 0, update: 0, unchanged: 5, delete: 0 });
      expect(second.changes.every((c) => c.action === 'unchanged')).toBe(true);
      expect(writeCount()).toBe(0);
    } finally {
      await kong.apply({}, { prune: true, tag });
    }
  });

  it('compares maps whole so removing a key from a map updates Kong and removes the key', async () => {
    const { kong, resetCounts, writeCount } = createCountingKong();
    const tag = unique('apply-map');
    const serviceName = unique('map-svc');
    const routeName = unique('map-rt');
    const pluginInstance = unique('map-http-log');
    const routePath = `/${unique('map-p')}`;

    const initialConfig: ApplyConfig<['http-log']> = {
      services: [{ name: serviceName, host: 'upstream', port: 8080 }],
      routes: [
        {
          name: routeName,
          service: { name: serviceName },
          paths: [routePath],
          protocols: ['http', 'https'],
          headers: { 'x-keep': ['yes'], 'x-drop': ['gone'] },
        },
      ],
      plugins: [
        {
          name: 'http-log',
          instance_name: pluginInstance,
          service: { name: serviceName },
          config: {
            http_endpoint: 'https://logs.example.com/ingest',
            headers: { 'x-a': '1', 'x-b': '2' },
          },
        },
      ],
    };

    const reducedConfig: ApplyConfig<['http-log']> = {
      services: [{ name: serviceName, host: 'upstream', port: 8080 }],
      routes: [
        {
          name: routeName,
          service: { name: serviceName },
          paths: [routePath],
          protocols: ['http', 'https'],
          headers: { 'x-keep': ['yes'] },
        },
      ],
      plugins: [
        {
          name: 'http-log',
          instance_name: pluginInstance,
          service: { name: serviceName },
          config: {
            http_endpoint: 'https://logs.example.com/ingest',
            headers: { 'x-a': '1' },
          },
        },
      ],
    };

    try {
      const first = await kong.apply(initialConfig, { tag });
      expect(first.summary).toEqual({ create: 3, update: 0, unchanged: 0, delete: 0 });

      const updated = await kong.apply(reducedConfig, { tag });
      expect(updated.changes).toEqual([
        { type: 'services', key: serviceName, action: 'unchanged' },
        { type: 'routes', key: routeName, action: 'update', fields: ['headers'] },
        { type: 'plugins', key: pluginInstance, action: 'update', fields: ['config'] },
      ]);

      const freshRoute = await kong.routes.get(routeName);
      expect(freshRoute.headers).toEqual({ 'x-keep': ['yes'] });

      const freshPlugin = await kong.plugins.get(pluginInstance);
      expect(Reflect.get(freshPlugin.config, 'headers')).toEqual({ 'x-a': '1' });

      resetCounts();
      const third = await kong.apply(reducedConfig, { tag });
      expect(third.summary).toEqual({ create: 0, update: 0, unchanged: 3, delete: 0 });
      expect(writeCount()).toBe(0);
    } finally {
      await kong.apply({}, { prune: true, tag });
    }
  });

  it('documents the idempotency limit when Kong rewrites a deprecated plugin field alias', async () => {
    const kong = liveKong();
    const tag = unique('apply-limit');
    const serviceName = unique('limit-svc');
    const pluginInstance = unique('limit-otel');

    // Kong rewrites deprecated `config.endpoint` on opentelemetry into `config.traces_endpoint`
    // and omits `endpoint` from the stored config, so applying the deprecated alias reports
    // `update` on every run (using `traces_endpoint` directly is idempotent).
    const config: ApplyConfig<['opentelemetry']> = {
      services: [{ name: serviceName, host: 'upstream', port: 8080 }],
      plugins: [
        {
          name: 'opentelemetry',
          instance_name: pluginInstance,
          service: { name: serviceName },
          config: {
            endpoint: 'https://otel.example.com/v1/traces',
          },
        },
      ],
    };

    try {
      const first = await kong.apply(config, { tag });
      expect(first.summary).toEqual({ create: 2, update: 0, unchanged: 0, delete: 0 });

      const second = await kong.apply(config, { tag });
      expect(second.changes).toEqual([
        { type: 'services', key: serviceName, action: 'unchanged' },
        { type: 'plugins', key: pluginInstance, action: 'update', fields: ['config'] },
      ]);
    } finally {
      await kong.apply({}, { prune: true, tag });
    }
  });
});
