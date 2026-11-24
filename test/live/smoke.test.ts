import { describe, expect, it } from 'vitest';
import { eventually, getLiveEnv, getUpstreamRequests, unique } from '../support/live.js';

interface NodeInfo {
  version: string;
}

interface EchoResponse {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

const EXPECTED_VERSION_PREFIX: Record<'oss-3.9' | 'ee-3.14', string> = {
  'oss-3.9': '3.9.',
  'ee-3.14': '3.14.',
};

describe('live smoke test', () => {
  const env = getLiveEnv();

  it('reports the expected Kong version from GET /', async () => {
    const response = await fetch(`${env.adminUrl}/`);
    expect(response.status).toBe(200);
    const info = (await response.json()) as NodeInfo;
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
      const createService = await fetch(`${env.adminUrl}/services`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: serviceName,
          url: `${env.upstreamInternalUrl}/echo`,
        }),
      });
      expect(createService.status).toBe(201);
      serviceCreated = true;

      const createRoute = await fetch(`${env.adminUrl}/services/${serviceName}/routes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: routeName,
          paths: [routePrefix],
          protocols: ['http', 'https'],
        }),
      });
      expect(createRoute.status).toBe(201);
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
        const delRoute = await fetch(`${env.adminUrl}/routes/${routeName}`, {
          method: 'DELETE',
        });
        expect([204, 404]).toContain(delRoute.status);
      }
      if (serviceCreated) {
        const delService = await fetch(`${env.adminUrl}/services/${serviceName}`, {
          method: 'DELETE',
        });
        expect([204, 404]).toContain(delService.status);
      }
    }
  });
});
