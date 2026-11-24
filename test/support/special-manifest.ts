import type { HttpMethod, Kong } from '../../src/index.js';

/** Manifest entry describing one special Admin API operation for contract verification. */
export interface SpecialEndpoint {
  /** Endpoint path template as declared in `schemas/endpoints.json`, with parameters as `{}`. */
  readonly template: string;
  /** HTTP method sent by this operation. */
  readonly method: HttpMethod;
  /** Invokes the library call for this operation with placeholder arguments. */
  invoke(kong: Kong): Promise<unknown>;
}

/** Manifest of all 41 special Admin API operations across the 36 special endpoint templates. */
export const SPECIAL_ENDPOINTS: readonly SpecialEndpoint[] = [
  {
    template: '/',
    method: 'GET',
    invoke: (kong) => kong.node.info(),
  },
  {
    template: '/status',
    method: 'GET',
    invoke: (kong) => kong.node.status(),
  },
  {
    template: '/status/dns',
    method: 'GET',
    invoke: (kong) => kong.node.dnsStatus(),
  },
  {
    template: '/endpoints',
    method: 'GET',
    invoke: (kong) => kong.node.endpoints(),
  },
  {
    template: '/timers',
    method: 'GET',
    invoke: (kong) => kong.node.timers(),
  },
  {
    template: '/metrics',
    method: 'GET',
    invoke: (kong) => kong.node.metrics(),
  },
  {
    template: '/tags',
    method: 'GET',
    invoke: (kong) => kong.tags.list(),
  },
  {
    template: '/tags/{}',
    method: 'GET',
    invoke: (kong) => kong.tags.entities('example-tag'),
  },
  {
    template: '/cache',
    method: 'DELETE',
    invoke: (kong) => kong.cache.purge(),
  },
  {
    template: '/cache/{}',
    method: 'GET',
    invoke: (kong) => kong.cache.get('example-key'),
  },
  {
    template: '/cache/{}',
    method: 'DELETE',
    invoke: (kong) => kong.cache.delete('example-key'),
  },
  {
    template: '/config',
    method: 'GET',
    invoke: (kong) => kong.config.get(),
  },
  {
    template: '/config',
    method: 'POST',
    invoke: (kong) => kong.config.load({ _format_version: '3.0' }),
  },
  {
    template: '/clustering/data-planes',
    method: 'GET',
    invoke: (kong) => kong.clustering.dataPlanes(),
  },
  {
    template: '/clustering/status',
    method: 'GET',
    invoke: (kong) => kong.clustering.status(),
  },
  {
    template: '/debug/node/log-level',
    method: 'GET',
    invoke: (kong) => kong.debug.getLogLevel(),
  },
  {
    template: '/debug/node/log-level/{}',
    method: 'PUT',
    invoke: (kong) => kong.debug.setLogLevel('info'),
  },
  {
    template: '/debug/cluster/log-level/{}',
    method: 'PUT',
    invoke: (kong) => kong.debug.setClusterLogLevel('info'),
  },
  {
    template: '/schemas/{}',
    method: 'GET',
    invoke: (kong) => kong.schemas.entity('services'),
  },
  {
    template: '/schemas/{}/validate',
    method: 'POST',
    invoke: (kong) => kong.schemas.validateEntity('services', { host: 'example.com' }),
  },
  {
    template: '/schemas/plugins/{}',
    method: 'GET',
    invoke: (kong) => kong.schemas.plugin('key-auth'),
  },
  {
    template: '/schemas/plugins/validate',
    method: 'POST',
    invoke: (kong) => kong.schemas.validatePlugin({ name: 'key-auth' }),
  },
  {
    template: '/schemas/vaults/{}',
    method: 'GET',
    invoke: (kong) => kong.schemas.vault('env'),
  },
  {
    template: '/schemas/vaults/validate',
    method: 'POST',
    invoke: (kong) => kong.schemas.validateVault({ name: 'env', prefix: 'my-env' }),
  },
  {
    template: '/plugins/enabled',
    method: 'GET',
    invoke: (kong) => kong.plugins.enabledNames(),
  },
  {
    template: '/plugins/schema/{}',
    method: 'GET',
    invoke: (kong) => kong.plugins.schema('key-auth'),
  },
  {
    template: '/upstreams/{}/health',
    method: 'GET',
    invoke: (kong) => kong.upstreams.health('example-upstream'),
  },
  {
    template: '/upstreams/{}/targets/all',
    method: 'GET',
    invoke: (kong) => kong.upstreams.allTargets('example-upstream'),
  },
  {
    template: '/upstreams/{}/targets/{}/healthy',
    method: 'PUT',
    invoke: (kong) =>
      kong.upstreams.setTargetHealth('example-upstream', 'example-target', 'healthy'),
  },
  {
    template: '/upstreams/{}/targets/{}/unhealthy',
    method: 'PUT',
    invoke: (kong) =>
      kong.upstreams.setTargetHealth('example-upstream', 'example-target', 'unhealthy'),
  },
  {
    template: '/upstreams/{}/targets/{}/{}/healthy',
    method: 'PUT',
    invoke: (kong) =>
      kong.upstreams.setTargetHealth(
        'example-upstream',
        'example-target',
        'healthy',
        '127.0.0.1:8080',
      ),
  },
  {
    template: '/upstreams/{}/targets/{}/{}/unhealthy',
    method: 'PUT',
    invoke: (kong) =>
      kong.upstreams.setTargetHealth(
        'example-upstream',
        'example-target',
        'unhealthy',
        '127.0.0.1:8080',
      ),
  },
  {
    template: '/acme',
    method: 'POST',
    invoke: (kong) => kong.acme.createCertificate('example.com'),
  },
  {
    template: '/acme',
    method: 'PATCH',
    invoke: (kong) => kong.acme.renew(),
  },
  {
    template: '/acme/certificates',
    method: 'GET',
    invoke: (kong) => kong.acme.certificates(),
  },
  {
    template: '/acme/certificates/{}',
    method: 'GET',
    invoke: (kong) => kong.acme.certificate('example.com'),
  },
  {
    template: '/proxy-cache',
    method: 'DELETE',
    invoke: (kong) => kong.proxyCache.purge(),
  },
  {
    template: '/proxy-cache/{}',
    method: 'GET',
    invoke: (kong) => kong.proxyCache.get('example-cache-key'),
  },
  {
    template: '/proxy-cache/{}',
    method: 'DELETE',
    invoke: (kong) => kong.proxyCache.delete('example-cache-key'),
  },
  {
    template: '/proxy-cache/{}/caches/{}',
    method: 'GET',
    invoke: (kong) => kong.proxyCache.get('example-cache-key', 'example-plugin-id'),
  },
  {
    template: '/proxy-cache/{}/caches/{}',
    method: 'DELETE',
    invoke: (kong) => kong.proxyCache.delete('example-cache-key', 'example-plugin-id'),
  },
];
