import { describe, expect, it } from 'vitest';
import {
  NodeApi,
  type DnsStatus,
  type NodeEndpoints,
  type NodeInfo,
  type NodeStatus,
  type NodeTimers,
} from '../../src/special/node.js';
import { Transport } from '../../src/transport.js';
import { createFakeFetch } from '../support/fake-fetch.js';

function makeNodeApi() {
  const fake = createFakeFetch();
  const transport = new Transport({
    adminUrl: 'http://localhost:8001',
    fetch: fake.fetch,
  });
  return { fake, node: new NodeApi(transport) };
}

describe('NodeApi', () => {
  it('fetches node info via GET / and passes through the result', async () => {
    const { fake, node } = makeNodeApi();
    const payload: NodeInfo = {
      version: '3.9.5',
      edition: 'community',
      tagline: 'Welcome to kong',
      hostname: 'kong-1',
      node_id: 'node-uuid',
      lua_version: 'LuaJIT 2.1.0',
      timers: { running: 10, pending: 1 },
      plugins: {
        available_on_server: { 'key-auth': { version: '3.9.0', priority: 1250 } },
        enabled_in_cluster: ['key-auth'],
      },
      pids: { master: 1, workers: [2, 3] },
      configuration: { database: 'postgres' },
      extra_field: 'kept',
    };
    fake.json(payload);

    const controller = new AbortController();
    const result = await node.info({ signal: controller.signal });

    expect(result).toEqual(payload);
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/',
      body: undefined,
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('fetches node status via GET /status', async () => {
    const { fake, node } = makeNodeApi();
    const payload: NodeStatus = {
      database: { reachable: true },
      server: {
        connections_accepted: 5,
        connections_active: 4,
        connections_handled: 5,
        connections_reading: 0,
        connections_waiting: 1,
        connections_writing: 3,
        total_requests: 5,
      },
      memory: {
        lua_shared_dicts: {
          kong_db_cache: { allocated_slabs: '0.76 MiB', capacity: '128.00 MiB' },
        },
        workers_lua_vms: [{ http_allocated_gc: '46.82 MiB', pid: 1400 }],
      },
    };
    fake.json(payload);

    const controller = new AbortController();
    const result = await node.status({ signal: controller.signal });

    expect(result).toEqual(payload);
    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/status',
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('fetches DNS status via GET /status/dns', async () => {
    const { fake, node } = makeNodeApi();
    const payload: DnsStatus = {
      worker: { id: 0, count: 2 },
      stats: { runs: 12 },
    };
    fake.json(payload);

    const controller = new AbortController();
    const result = await node.dnsStatus({ signal: controller.signal });

    expect(result).toEqual(payload);
    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/status/dns',
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('fetches endpoint templates via GET /endpoints', async () => {
    const { fake, node } = makeNodeApi();
    const payload: NodeEndpoints = {
      data: ['/', '/services', '/routes'],
    };
    fake.json(payload);

    const controller = new AbortController();
    const result = await node.endpoints({ signal: controller.signal });

    expect(result).toEqual(payload);
    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/endpoints',
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('fetches timer stats via GET /timers', async () => {
    const { fake, node } = makeNodeApi();
    const payload: NodeTimers = {
      worker: { id: 1, count: 2 },
      stats: {
        sys: { total: 4 },
        timers: {},
        flamegraph: { running: '' },
      },
    };
    fake.json(payload);

    const controller = new AbortController();
    const result = await node.timers({ signal: controller.signal });

    expect(result).toEqual(payload);
    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/timers',
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('fetches Prometheus metrics text via GET /metrics', async () => {
    const { fake, node } = makeNodeApi();
    const metricsText = '# HELP kong_datastore_reachable\nkong_datastore_reachable 1\n';
    fake.text(metricsText);

    const controller = new AbortController();
    const result = await node.metrics({ signal: controller.signal });

    expect(result).toBe(metricsText);
    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/metrics',
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });
});
