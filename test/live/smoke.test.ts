import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../support/crud.js';
import {
  eventually,
  getLiveEnv,
  getUpstreamRequests,
  liveDblessKong,
  liveKong,
  unique,
} from '../support/live.js';

interface NodeInfo {
  version: string;
}

interface EchoResponse {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

interface ConfigResponse {
  config: string;
}

const EXPECTED_VERSION_PREFIX: Record<'oss-3.9' | 'ee-3.14', string> = {
  'oss-3.9': '3.9.',
  'ee-3.14': '3.14.',
};

describe('live smoke test', () => {
  const env = getLiveEnv();
  const kong = liveKong();
  const dbless = liveDblessKong();

  it('reports the expected Kong version from GET /', async () => {
    const info = await kong.request<NodeInfo>({ path: '/' });
    expect(info.version.startsWith(EXPECTED_VERSION_PREFIX[env.target])).toBe(true);
  });

  it('routes a proxy request through a created service and route to the fake upstream', async () => {
    const serviceName = unique('smoke-svc');
    const routeName = unique('smoke-route');
    const routePrefix = `/${unique('smoke')}`;
    const probeSegment = unique('probe');
    const expectedEchoPath = `/echo/${probeSegment}`;

    let routeCreated = false;
    let serviceCreated = false;

    try {
      const service = await kong.services.create({
        name: serviceName,
        url: `${env.upstreamInternalUrl}/echo`,
      });
      expect(service.name).toBe(serviceName);
      serviceCreated = true;

      const route = await kong.services.routes(serviceName).create({
        name: routeName,
        paths: [routePrefix],
        protocols: ['http', 'https'],
      });
      expect(route.name).toBe(routeName);
      routeCreated = true;

      const echo = await eventually<EchoResponse>(async () => {
        const res = await fetch(`${env.proxyUrl}${routePrefix}/${probeSegment}`, {
          headers: { 'x-smoke-probe': probeSegment },
        });
        if (res.status !== 200) {
          throw new Error(`Expected 200 from proxy, got ${res.status}`);
        }
        return (await res.json()) as EchoResponse;
      });

      expect(echo.method).toBe('GET');
      expect(echo.path).toBe(expectedEchoPath);
      expect(echo.headers['x-smoke-probe']).toBe(probeSegment);

      const recorded = await getUpstreamRequests(expectedEchoPath);
      expect(recorded.length).toBeGreaterThanOrEqual(1);
      expect(
        recorded.some(
          (req) =>
            req.method === 'GET' &&
            req.path === expectedEchoPath &&
            req.headers['x-smoke-probe'] === probeSegment,
        ),
      ).toBe(true);
    } finally {
      if (routeCreated) {
        await deleteIgnoringNotFound(() => kong.routes.delete(routeName));
      }
      if (serviceCreated) {
        await deleteIgnoringNotFound(() => kong.services.delete(serviceName));
      }
    }
  });

  it('reads and applies declarative config on the DB-less Kong instance', async () => {
    const serviceName = unique('dbless-smoke-svc');

    try {
      const configBody = await dbless.request<ConfigResponse>({ path: '/config' });
      expect(typeof configBody.config).toBe('string');

      await dbless.request({
        method: 'POST',
        path: '/config',
        body: {
          _format_version: '3.0',
          services: [
            {
              name: serviceName,
              url: `${env.upstreamInternalUrl}/echo`,
            },
          ],
        },
      });

      const services = await dbless.services.list();
      expect(services.data.some((svc) => svc.name === serviceName)).toBe(true);
    } finally {
      await dbless.request({
        method: 'POST',
        path: '/config',
        body: { _format_version: '3.0' },
      });
    }
  });
});
