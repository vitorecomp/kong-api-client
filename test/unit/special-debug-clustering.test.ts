import { describe, expect, it } from 'vitest';
import { KongError } from '../../src/errors.js';
import type { Page } from '../../src/pagination.js';
import {
  ClusteringApi,
  type ClusteringDataPlane,
  type ClusteringStatus,
} from '../../src/special/clustering.js';
import { DebugApi, type LogLevelResponse } from '../../src/special/debug.js';
import { Transport } from '../../src/transport.js';
import { createFakeFetch } from '../support/fake-fetch.js';

function makeTransport() {
  const fake = createFakeFetch();
  const transport = new Transport({
    adminUrl: 'http://localhost:8001',
    fetch: fake.fetch,
  });
  return { fake, transport };
}

describe('DebugApi', () => {
  it('reads and updates node and cluster log levels with optional timeout', async () => {
    const { fake, transport } = makeTransport();
    const debug = new DebugApi(transport);
    const current: LogLevelResponse = { message: 'log level: notice' };
    const changed: LogLevelResponse = { message: 'log level changed' };
    fake.json(current).json(changed).json(changed).json(changed).json(changed);

    const controller = new AbortController();
    await expect(debug.getLogLevel({ signal: controller.signal })).resolves.toEqual(current);
    await expect(debug.setLogLevel('info')).resolves.toEqual(changed);
    await expect(
      debug.setLogLevel('debug', { timeout: 30, signal: controller.signal }),
    ).resolves.toEqual(changed);
    await expect(debug.setClusterLogLevel('warn')).resolves.toEqual(changed);
    await expect(
      debug.setClusterLogLevel('error', { timeout: 60, signal: controller.signal }),
    ).resolves.toEqual(changed);

    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/debug/node/log-level',
    });
    expect(fake.requests[0]?.signal).toBeDefined();

    expect(fake.requests[1]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/debug/node/log-level/info',
      body: undefined,
    });

    const nodeTimeoutUrl = new URL(fake.requests[2]!.url);
    expect(fake.requests[2]?.method).toBe('PUT');
    expect(nodeTimeoutUrl.pathname).toBe('/debug/node/log-level/debug');
    expect(nodeTimeoutUrl.searchParams.get('timeout')).toBe('30');
    expect(fake.requests[2]?.signal).toBeDefined();

    expect(fake.requests[3]).toMatchObject({
      method: 'PUT',
      url: 'http://localhost:8001/debug/cluster/log-level/warn',
      body: undefined,
    });

    const clusterTimeoutUrl = new URL(fake.requests[4]!.url);
    expect(fake.requests[4]?.method).toBe('PUT');
    expect(clusterTimeoutUrl.pathname).toBe('/debug/cluster/log-level/error');
    expect(clusterTimeoutUrl.searchParams.get('timeout')).toBe('60');
    expect(fake.requests[4]?.signal).toBeDefined();
  });

  it('encodes custom log levels and rejects empty strings', async () => {
    const { fake, transport } = makeTransport();
    const debug = new DebugApi(transport);
    fake.json({ message: 'ok' });

    await debug.setLogLevel('custom/level');
    expect(fake.requests[0]?.url).toBe('http://localhost:8001/debug/node/log-level/custom%2Flevel');

    await expect(debug.setLogLevel('')).rejects.toThrow(KongError);
    await expect(debug.setClusterLogLevel('')).rejects.toThrow(KongError);
    expect(fake.requests).toHaveLength(1);
  });
});

describe('ClusteringApi', () => {
  it('lists data planes with and without pagination params', async () => {
    const { fake, transport } = makeTransport();
    const clustering = new ClusteringApi(transport);
    const page: Page<ClusteringDataPlane> = {
      data: [
        {
          id: 'dp-1',
          ip: '10.0.0.2',
          hostname: 'dp-host',
          last_seen: 1700000000,
          config_hash: 'abc123',
          version: '3.9.5',
          sync_status: 'normal',
        },
      ],
      next: null,
    };
    fake.json(page).json(page);

    const controller = new AbortController();
    await expect(clustering.dataPlanes()).resolves.toEqual(page);
    await expect(
      clustering.dataPlanes({ size: 50, offset: 'tok-1' }, { signal: controller.signal }),
    ).resolves.toEqual(page);

    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/clustering/data-planes',
    });
    const url = new URL(fake.requests[1]!.url);
    expect(url.pathname).toBe('/clustering/data-planes');
    expect(url.searchParams.get('size')).toBe('50');
    expect(url.searchParams.get('offset')).toBe('tok-1');
    expect(fake.requests[1]?.signal).toBeDefined();
  });

  it('fetches clustering status via GET /clustering/status', async () => {
    const { fake, transport } = makeTransport();
    const clustering = new ClusteringApi(transport);
    const status: ClusteringStatus = {
      'dp-1': {
        config_hash: 'abc123',
        hostname: 'dp-host',
        ip: '10.0.0.2',
        last_seen: 1700000000,
      },
    };
    fake.json(status);

    const controller = new AbortController();
    await expect(clustering.status({ signal: controller.signal })).resolves.toEqual(status);

    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/clustering/status',
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });
});
