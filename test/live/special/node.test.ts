import { describe, expect, it } from 'vitest';
import { getLiveEnv, liveDblessKong, liveKong } from '../../support/live.js';

const EXPECTED_VERSION_PREFIX: Record<'oss-3.9' | 'ee-3.14', string> = {
  'oss-3.9': '3.9.',
  'ee-3.14': '3.14.',
};

const EXPECTED_EDITION: Record<'oss-3.9' | 'ee-3.14', string> = {
  'oss-3.9': 'community',
  'ee-3.14': 'enterprise',
};

describe('live special: node endpoints', () => {
  const env = getLiveEnv();
  const kong = liveKong();
  const dbless = liveDblessKong();

  it('returns node metadata matching the target via GET /', async () => {
    const info = await kong.node.info();

    expect(info.version.startsWith(EXPECTED_VERSION_PREFIX[env.target])).toBe(true);
    expect(info.edition).toBe(EXPECTED_EDITION[env.target]);
    expect(info.tagline).toBe('Welcome to kong');
    expect(typeof info.node_id).toBe('string');
    expect(info.node_id.length).toBeGreaterThan(0);
    expect(typeof info.hostname).toBe('string');
    expect(typeof info.lua_version).toBe('string');
    expect(typeof info.configuration).toBe('object');
    expect(typeof info.plugins.available_on_server).toBe('object');
    expect(Array.isArray(info.plugins.enabled_in_cluster)).toBe(true);
    expect(typeof info.pids.master).toBe('number');
  });

  it('returns node health status via GET /status', async () => {
    const status = await kong.node.status();

    expect(status.database.reachable).toBe(true);
    expect(status.server.total_requests).toBeGreaterThanOrEqual(1);
    expect(status.server.connections_active).toBeGreaterThanOrEqual(1);
    expect(status.memory.workers_lua_vms.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(status.memory.lua_shared_dicts).length).toBeGreaterThan(0);
  });

  it('returns DNS status via GET /status/dns on the DB-less instance', async () => {
    const dns = await dbless.node.dnsStatus();

    expect(typeof dns.worker.id).toBe('number');
    expect(dns.worker.count).toBeGreaterThanOrEqual(1);
    expect(typeof dns.stats).toBe('object');
    expect(dns.stats).not.toBeNull();
  });

  it('lists registered Admin API endpoints via GET /endpoints', async () => {
    const endpoints = await kong.node.endpoints();

    expect(Array.isArray(endpoints.data)).toBe(true);
    expect(endpoints.data).toContain('/');
    expect(endpoints.data).toContain('/status');
    expect(endpoints.data).toContain('/services');
    expect(endpoints.data).toContain('/plugins/enabled');
  });

  it('returns timer runtime info via GET /timers', async () => {
    const timers = await kong.node.timers();

    expect(typeof timers.worker.id).toBe('number');
    expect(timers.worker.count).toBeGreaterThanOrEqual(1);
    expect(typeof timers.stats).toBe('object');
    expect(timers.stats).not.toBeNull();
  });

  it('returns Prometheus metrics text via GET /metrics', async () => {
    const metrics = await kong.node.metrics();

    expect(typeof metrics).toBe('string');
    expect(metrics).toContain('kong_datastore_reachable');
  });
});
