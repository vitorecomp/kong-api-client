import { describe, expect, expectTypeOf, it } from 'vitest';
import { KongError } from '../../src/errors.js';
import type { Target } from '../../src/generated/entities.js';
import { UpstreamsResource } from '../../src/generated/resources.js';
import type { Page } from '../../src/pagination.js';
import { Transport } from '../../src/transport.js';
import {
  UpstreamsApi,
  type UpstreamBalancerHealthResponse,
  type UpstreamHealthResponse,
  type UpstreamTargetsHealthResponse,
} from '../../src/upstreams.js';
import { createFakeFetch } from '../support/fake-fetch.js';

function makeUpstreamsApi() {
  const fake = createFakeFetch();
  const transport = new Transport({
    adminUrl: 'http://localhost:8001',
    fetch: fake.fetch,
  });
  return { fake, upstreams: new UpstreamsApi(transport) };
}

describe('UpstreamsApi', () => {
  it('extends UpstreamsResource and keeps standard collection and nested methods', async () => {
    const { fake, upstreams } = makeUpstreamsApi();
    expect(upstreams).toBeInstanceOf(UpstreamsResource);
    expect(upstreams.basePath).toBe('/upstreams');

    fake.json({ data: [], next: null });
    await upstreams.targets('my-up').list();
    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/upstreams/my-up/targets',
    });
  });

  it('fetches per-target health and aggregate balancer health with proper types', async () => {
    const { fake, upstreams } = makeUpstreamsApi();
    const targetsHealth: UpstreamTargetsHealthResponse = {
      node_id: 'node-1',
      next: null,
      data: [
        {
          id: 't-1',
          created_at: 1700000000,
          updated_at: 1700000000,
          upstream: { id: 'up-1' },
          target: '127.0.0.1:8080',
          weight: 100,
          tags: null,
          health: 'HEALTHY',
        },
      ],
    };
    const balancerHealth: UpstreamBalancerHealthResponse = {
      node_id: 'node-1',
      next: null,
      data: {
        id: 'up-1',
        health: 'HEALTHY',
        balancer_health: 'HEALTHY',
      },
    };
    fake
      .json(targetsHealth)
      .json(balancerHealth)
      .json(targetsHealth)
      .json(balancerHealth)
      .json(targetsHealth)
      .json(targetsHealth);

    const controller = new AbortController();
    const defaultResult = await upstreams.health('up/1');
    expectTypeOf(defaultResult).toEqualTypeOf<UpstreamTargetsHealthResponse>();
    expect(defaultResult).toEqual(targetsHealth);

    const balancerResult = await upstreams.health('up/1', {
      balancerHealth: true,
      signal: controller.signal,
    });
    expectTypeOf(balancerResult).toEqualTypeOf<UpstreamBalancerHealthResponse>();
    expect(balancerResult).toEqual(balancerHealth);

    const pagedResult = await upstreams.health('up-1', {
      balancerHealth: false,
      size: 10,
      offset: 'cur-1',
    });
    expectTypeOf(pagedResult).toEqualTypeOf<UpstreamTargetsHealthResponse>();
    expect(pagedResult).toEqual(targetsHealth);

    const asBool = (value: boolean): boolean => value;
    const unionResult = await upstreams.health('up-1', { balancerHealth: asBool(true) });
    expectTypeOf(unionResult).toEqualTypeOf<UpstreamHealthResponse>();
    expect(unionResult).toEqual(balancerHealth);

    await expect(upstreams.health('up-1', { size: 5 })).resolves.toEqual(targetsHealth);
    await expect(upstreams.health('up-1', { offset: 'cur-2' })).resolves.toEqual(targetsHealth);

    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/upstreams/up%2F1/health',
    });

    const u1 = new URL(fake.requests[1]!.url);
    expect(u1.pathname).toBe('/upstreams/up%2F1/health');
    expect(u1.searchParams.get('balancer_health')).toBe('1');
    expect(fake.requests[1]?.signal).toBeDefined();

    const u2 = new URL(fake.requests[2]!.url);
    expect(u2.pathname).toBe('/upstreams/up-1/health');
    expect(u2.searchParams.get('balancer_health')).toBe('0');
    expect(u2.searchParams.get('size')).toBe('10');
    expect(u2.searchParams.get('offset')).toBe('cur-1');

    const u4 = new URL(fake.requests[4]!.url);
    expect(u4.searchParams.get('size')).toBe('5');
    expect(u4.searchParams.has('balancer_health')).toBe(false);

    const u5 = new URL(fake.requests[5]!.url);
    expect(u5.searchParams.get('offset')).toBe('cur-2');
    expect(u5.searchParams.has('balancer_health')).toBe(false);
  });

  it('lists all targets (including history) with and without pagination params', async () => {
    const { fake, upstreams } = makeUpstreamsApi();
    const page: Page<Target> = {
      data: [
        {
          id: 't-1',
          created_at: 1700000000,
          updated_at: 1700000000,
          upstream: { id: 'up-1' },
          target: '127.0.0.1:8080',
          weight: 100,
          tags: null,
        },
      ],
      next: null,
    };
    fake.json(page).json(page);

    const controller = new AbortController();
    await expect(upstreams.allTargets('up/1')).resolves.toEqual(page);
    await expect(
      upstreams.allTargets(
        'up-1',
        { size: 5, offset: 'o1', tags: ['a', 'b'] },
        { signal: controller.signal },
      ),
    ).resolves.toEqual(page);

    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/upstreams/up%2F1/targets/all',
    });
    const url = new URL(fake.requests[1]!.url);
    expect(url.pathname).toBe('/upstreams/up-1/targets/all');
    expect(url.searchParams.get('size')).toBe('5');
    expect(url.searchParams.get('offset')).toBe('o1');
    expect(url.searchParams.get('tags')).toBe('a,b');
    expect(fake.requests[1]?.signal).toBeDefined();
  });

  it('sets target health for a target or a specific address, preserving colons in address', async () => {
    const { fake, upstreams } = makeUpstreamsApi();
    fake.empty(204).empty(204).empty(204).empty(204);

    const controller = new AbortController();
    await expect(
      upstreams.setTargetHealth('up/1', 'tgt/1', 'healthy', { signal: controller.signal }),
    ).resolves.toBeUndefined();
    await expect(upstreams.setTargetHealth('up-1', 'tgt-1', 'unhealthy')).resolves.toBeUndefined();
    await expect(
      upstreams.setTargetHealth('up-1', 'tgt-1', 'healthy', '127.0.0.1:8080', {
        signal: controller.signal,
      }),
    ).resolves.toBeUndefined();
    await expect(
      upstreams.setTargetHealth('up-1', 'tgt-1', 'unhealthy', '127.0.0.1:8080'),
    ).resolves.toBeUndefined();

    expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'PUT http://localhost:8001/upstreams/up%2F1/targets/tgt%2F1/healthy',
      'PUT http://localhost:8001/upstreams/up-1/targets/tgt-1/unhealthy',
      'PUT http://localhost:8001/upstreams/up-1/targets/tgt-1/127.0.0.1:8080/healthy',
      'PUT http://localhost:8001/upstreams/up-1/targets/tgt-1/127.0.0.1:8080/unhealthy',
    ]);
    expect(fake.requests[0]?.signal).toBeDefined();
    expect(fake.requests[2]?.signal).toBeDefined();
  });

  it('rejects empty path segments without sending requests', async () => {
    const { fake, upstreams } = makeUpstreamsApi();

    await expect(upstreams.health('')).rejects.toThrow(KongError);
    await expect(upstreams.allTargets('')).rejects.toThrow(KongError);
    await expect(upstreams.setTargetHealth('', 't', 'healthy')).rejects.toThrow(KongError);
    await expect(upstreams.setTargetHealth('u', '', 'healthy')).rejects.toThrow(KongError);
    await expect(upstreams.setTargetHealth('u', 't', 'healthy', '')).rejects.toThrow(KongError);
    expect(fake.requests).toHaveLength(0);
  });
});
