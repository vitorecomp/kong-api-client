import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../../support/crud.js';
import { eventually, liveKong, unique } from '../../support/live.js';

describe('live special: plugins and upstreams special endpoints', () => {
  const kong = liveKong();

  it('lists enabled plugins and fetches legacy plugin schema via /plugins/enabled and /plugins/schema/{name}', async () => {
    const enabled = await kong.plugins.enabledNames();
    expect(Array.isArray(enabled)).toBe(true);
    expect(enabled).toContain('key-auth');
    expect(enabled).toContain('proxy-cache');
    expect(enabled).toContain('rate-limiting');

    const schema = await kong.plugins.schema('key-auth');
    expect(Array.isArray(schema.fields)).toBe(true);
    const names = schema.fields.flatMap((entry) => Object.keys(entry));
    expect(names).toContain('key_names');
  });

  it('reads upstream health, lists all targets, and toggles target & address health', async () => {
    const upstreamName = unique('special-up');
    const serviceName = unique('special-up-svc');
    const targetAddress = '127.0.0.1:8080';

    let serviceId: string | undefined;
    let upstreamId: string | undefined;

    try {
      const upstream = await kong.upstreams.create({
        name: upstreamName,
        healthchecks: {
          passive: {
            healthy: { successes: 1 },
            unhealthy: { http_failures: 1, tcp_failures: 1, timeouts: 1 },
          },
        },
      });
      upstreamId = upstream.id;

      const target = await kong.upstreams.targets(upstreamName).create({
        target: targetAddress,
        weight: 100,
      });

      const service = await kong.services.create({
        name: serviceName,
        host: upstreamName,
        port: 80,
      });
      serviceId = service.id;

      // Wait for Kong's balancer to attach to the upstream with healthchecks enabled.
      const initialHealth = await eventually(async () => {
        const health = await kong.upstreams.health(upstreamName);
        const first = health.data[0];
        if (!first || first.health !== 'HEALTHY') {
          throw new Error(`Waiting for HEALTHY target, got ${JSON.stringify(health)}`);
        }
        return health;
      });
      expect(typeof initialHealth.node_id).toBe('string');
      expect(initialHealth.data[0]?.target).toBe(targetAddress);

      const balancerHealth = await kong.upstreams.health(upstreamName, { balancerHealth: true });
      expect(balancerHealth.data?.health).toBe('HEALTHY');

      const allTargets = await kong.upstreams.allTargets(upstreamName);
      expect(allTargets.data.some((t) => t.id === target.id && t.target === targetAddress)).toBe(
        true,
      );

      // Toggle target health without address
      await kong.upstreams.setTargetHealth(upstreamName, target.id, 'unhealthy');
      await eventually(async () => {
        const h = await kong.upstreams.health(upstreamName);
        if (h.data[0]?.health !== 'UNHEALTHY') {
          throw new Error(`Expected UNHEALTHY, got ${h.data[0]?.health}`);
        }
      });

      await kong.upstreams.setTargetHealth(upstreamName, target.id, 'healthy');
      await eventually(async () => {
        const h = await kong.upstreams.health(upstreamName);
        if (h.data[0]?.health !== 'HEALTHY') {
          throw new Error(`Expected HEALTHY, got ${h.data[0]?.health}`);
        }
      });

      // Toggle health for a specific ip:port address (exercises colon preservation)
      await kong.upstreams.setTargetHealth(upstreamName, target.id, 'unhealthy', targetAddress);
      await eventually(async () => {
        const h = await kong.upstreams.health(upstreamName);
        if (h.data[0]?.health !== 'UNHEALTHY') {
          throw new Error(`Expected UNHEALTHY after address override, got ${h.data[0]?.health}`);
        }
      });

      await kong.upstreams.setTargetHealth(upstreamName, target.id, 'healthy', targetAddress);
      await eventually(async () => {
        const h = await kong.upstreams.health(upstreamName);
        if (h.data[0]?.health !== 'HEALTHY') {
          throw new Error(`Expected HEALTHY after address override, got ${h.data[0]?.health}`);
        }
      });
    } finally {
      if (serviceId) {
        await deleteIgnoringNotFound(() => kong.services.delete(serviceId!));
      }
      if (upstreamId) {
        await deleteIgnoringNotFound(() => kong.upstreams.delete(upstreamId!));
      }
    }
  });
});
