---
title: Admin Endpoints
group: Guides
---

# Admin Endpoints

In addition to CRUD resource collections, `Kong` exposes typed namespaces for Kong's non-resource Admin API endpoints and adds specialised methods to `kong.upstreams` and `kong.plugins`.

Several of these endpoints depend on how the gateway is configured (database mode, DB-less mode, hybrid Control Plane, DNS client, or an enabled plugin). Each section below states what Kong requires and what Kong answers when those prerequisites are absent.

## Overview and gateway requirements

| API                                      | Endpoints                                                              | Gateway requirement                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `kong.node`                              | `/`, `/status`, `/endpoints`, `/timers`, `/metrics`                    | Any running Kong node                                                                                           |
| `kong.node.dnsStatus()`                  | `/status/dns`                                                          | New DNS client enabled (`KONG_NEW_DNS_CLIENT=on`); returns `501` on legacy DNS                                  |
| `kong.schemas`                           | `/schemas/{name}`, `/schemas/plugins/*`, `/schemas/vaults/*`           | Any running Kong node                                                                                           |
| `kong.tags`                              | `/tags`, `/tags/{tag}`                                                 | Any running Kong node (read-only)                                                                               |
| `kong.cache`                             | `/cache`, `/cache/{key}`                                               | Any running Kong node                                                                                           |
| `kong.config`                            | `/config` (`GET`, `POST`)                                              | **DB-less mode only** (`KONG_DATABASE=off`); returns `400` on database-backed nodes                             |
| `kong.debug`                             | `/debug/node/log-level*`, `/debug/cluster/log-level/*`                 | Any running Kong node                                                                                           |
| `kong.clustering`                        | `/clustering/data-planes`, `/clustering/status`                        | **Hybrid Control Plane only** (`KONG_ROLE=control_plane`); returns `400` otherwise                              |
| `kong.acme`                              | `/acme`, `/acme/certificates*`                                         | `acme` plugin configured (`404` otherwise); `POST /acme` also needs ACME CA & HTTP-01 port 80 (`400` otherwise) |
| `kong.proxyCache`                        | `/proxy-cache`, `/proxy-cache/{key}`, `/proxy-cache/{id}/caches/{key}` | `proxy-cache` plugin enabled (`404` for uncached keys)                                                          |
| `kong.upstreams` health & target history | `/upstreams/{u}/health`, `/targets/all`, `/targets/{t}/...`            | Active balancer with healthchecks for health states (`HEALTHCHECKS_OFF` otherwise)                              |
| `kong.plugins` inspection                | `/plugins/enabled`, `/plugins/schema/{name}`                           | Any running Kong node                                                                                           |

## Node metadata, status, timers, and metrics (`kong.node`)

Inspect the running node's version, edition, health, registered endpoints, timers, DNS client stats, and Prometheus metrics:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const info = await kong.node.info(); // GET /
console.log(info.version, info.edition, info.node_id);

const status = await kong.node.status(); // GET /status
console.log(status.database.reachable, status.server.total_requests);

const endpoints = await kong.node.endpoints(); // GET /endpoints
const timers = await kong.node.timers(); // GET /timers
const metricsText = await kong.node.metrics(); // GET /metrics (plain text)

console.log(endpoints.data.length, timers.worker.count, metricsText.length);
```

### DNS status (`kong.node.dnsStatus()`)

`GET /status/dns` requires Kong's new DNS client (`KONG_NEW_DNS_CLIENT=on`). When Kong runs with the legacy DNS client, Kong answers `501 Not Implemented`.

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const dns = await kong.node.dnsStatus(); // GET /status/dns
console.log(dns.worker.id, dns.stats);
```

## Schema inspection and validation (`kong.schemas`)

Inspect entity, plugin, and vault schemas or validate payloads without writing them to Kong. Validation returns `200` (`{ message: 'schema validation successful' }`) or throws `KongHttpError` with `status: 400`, `kongName: 'schema violation'`, and `fields`:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const serviceSchema = await kong.schemas.entity('services');
const entityCheck = await kong.schemas.validateEntity('services', {
  host: 'example.com',
  port: 80,
});

const pluginSchema = await kong.schemas.plugin('key-auth');
const pluginCheck = await kong.schemas.validatePlugin({
  name: 'key-auth',
  config: { key_names: ['X-API-Key'] },
});

const vaultSchema = await kong.schemas.vault('env');
const vaultCheck = await kong.schemas.validateVault({
  name: 'env',
  prefix: 'my-env',
  config: {},
});

console.log(
  serviceSchema.fields.length,
  entityCheck.message,
  pluginSchema.fields.length,
  pluginCheck.message,
  vaultSchema.fields.length,
  vaultCheck.message,
);
```

## Tags (`kong.tags`)

`kong.tags` lists tag associations across all entity types. Kong's `/tags` endpoints are read-only (`POST /tags` is rejected with `400`):

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const allTags = await kong.tags.list({ size: 50 }); // GET /tags
const prodEntities = await kong.tags.entities('env:prod', { size: 50 }); // GET /tags/env:prod

console.log(allTags.data.length, prodEntities.data.length);
```

## Node cache (`kong.cache`)

Inspect or invalidate Kong's node-level entity cache (works on any running Kong node, including DB-less nodes). Kong's `/cache/{key}` endpoint looks up keys without URL-decoding colons, so `kong.cache.get()` and `kong.cache.delete()` preserve literal `:` separators (such as `router:version`). Reading a key that is not currently cached on that node throws `KongHttpError` with status `404`:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const entry = await kong.cache.get('router:version'); // GET /cache/router:version
await kong.cache.delete('router:version'); // DELETE /cache/router:version
await kong.cache.purge(); // DELETE /cache

console.log(entry);
```

## DB-less declarative configuration (`kong.config`)

**Gateway requirement:** DB-less mode (`KONG_DATABASE=off`). Calling `GET /config` or `POST /config` on a database-backed Kong node fails with `400` (`only available when Kong is configured to not use a database`).

`kong.config.load()` accepts either a declarative configuration object or a YAML/JSON string, and supports `{ checkHash: true }` (Kong responds with `304` when the hash is unchanged) and `{ flattenErrors: true }`:

```ts
import { Kong } from 'kong-api-client';

const dbless = new Kong({ adminUrl: 'http://localhost:8001' });

const exported = await dbless.config.get(); // GET /config
console.log(exported.config);

await dbless.config.load(
  {
    _format_version: '3.0',
    services: [{ name: 'api', url: 'http://api.internal:8080' }],
  },
  { flattenErrors: true },
);
```

## Dynamic log levels (`kong.debug`)

Read or change the runtime log level on a single node or across the cluster, with an optional `timeout` (in seconds) before reverting to Kong's configured default:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const current = await kong.debug.getLogLevel(); // GET /debug/node/log-level
await kong.debug.setLogLevel('info', { timeout: 60 }); // PUT /debug/node/log-level/info?timeout=60
await kong.debug.setClusterLogLevel('warn', { timeout: 60 }); // PUT /debug/cluster/log-level/warn?timeout=60

console.log(current.message);
```

## Hybrid-mode clustering (`kong.clustering`)

**Gateway requirement:** Hybrid-mode Control Plane (`KONG_ROLE=control_plane`). On a standalone database or DB-less node, Kong answers both endpoints with `400` (`only available when Kong is configured to run as Control Plane`).

```ts
import { Kong } from 'kong-api-client';

const cp = new Kong({ adminUrl: 'http://localhost:8001' });

const planes = await cp.clustering.dataPlanes({ size: 50 }); // GET /clustering/data-planes
const status = await cp.clustering.status(); // GET /clustering/status

console.log(planes.data.length, Object.keys(status).length);
```

## ACME certificate management (`kong.acme`)

**Gateway requirements:**

- The `acme` plugin must be configured on the gateway; otherwise Kong answers `404` on `/acme/*`.
- `kong.acme.certificates()` (`GET /acme/certificates`) and `kong.acme.certificate(host)` (`GET /acme/certificates/{host}`) inspect certificates managed by the ACME plugin. Note that Kong returns `{}` for `data` when no ACME certificates are stored, so check `Array.isArray(list.data)`.
- `kong.acme.renew()` (`PATCH /acme`) triggers an asynchronous renewal (`202 Accepted`).
- `kong.acme.createCertificate(host, options?)` (`POST /acme`) requires a reachable ACME CA and a publicly reachable HTTP-01 challenge listener on port 80; without those Kong answers `400`.

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const list = await kong.acme.certificates({ invalidOnly: false });
if (Array.isArray(list.data)) {
  for (const cert of list.data) {
    console.log(cert.host, cert.valid, cert.not_after);
  }
}

const single = await kong.acme.certificate('api.example.com');
const renewal = await kong.acme.renew();
await kong.acme.createCertificate('api.example.com', { testHttpChallengeFlow: true });

console.log(single.data.digest, renewal.message);
```

## Proxy cache inspection and purge (`kong.proxyCache`)

**Gateway requirement:** At least one `proxy-cache` plugin enabled (for example with `strategy: 'memory'`). Cache keys come from the `X-Cache-Key` response header returned by Kong's proxy. Requesting or deleting a key that is not cached returns `404`.

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const cacheKey = 'your-x-cache-key';
const pluginId = 'your-proxy-cache-plugin-id';

// Global lookup/delete across all proxy-cache instances
const entry = await kong.proxyCache.get(cacheKey); // GET /proxy-cache/{cacheKey}
await kong.proxyCache.delete(cacheKey); // DELETE /proxy-cache/{cacheKey}

// Scoped to a specific proxy-cache plugin instance
const scoped = await kong.proxyCache.get(cacheKey, pluginId);
await kong.proxyCache.delete(cacheKey, pluginId);

// Purge every cached response across all proxy-cache instances
await kong.proxyCache.purge(); // DELETE /proxy-cache

console.log(entry.status, scoped.ttl);
```

## Upstream health and target history (`kong.upstreams`)

In addition to standard CRUD (`Collection`) and `kong.upstreams.targets(upstream)`, `kong.upstreams` provides:

- `health(upstream, options?)` (`GET /upstreams/{upstream}/health`): per-target runtime health, or aggregate balancer health when `{ balancerHealth: true }` is passed.
- `allTargets(upstream, params?)` (`GET /upstreams/{upstream}/targets/all`): lists active and historical target entries for an upstream.
- `setTargetHealth(upstream, target, health, address?)` (`PUT /upstreams/{upstream}/targets/{target}[/{address}]/{healthy|unhealthy}`): manually overrides target health (all addresses or one resolved `ip:port` address, preserving literal colons as Kong requires).

**Gateway requirement:** Runtime health states (`HEALTHY` / `UNHEALTHY`) and manual overrides require an active balancer — a service whose `host` matches the upstream's `name`, with active or passive healthchecks configured on the upstream (otherwise Kong reports `HEALTHCHECKS_OFF`).

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const targetHealth = await kong.upstreams.health('backend-pool');
const balancerHealth = await kong.upstreams.health('backend-pool', { balancerHealth: true });
const history = await kong.upstreams.allTargets('backend-pool');

await kong.upstreams.setTargetHealth('backend-pool', '192.0.2.10:8080', 'unhealthy');
await kong.upstreams.setTargetHealth(
  'backend-pool',
  '192.0.2.10:8080',
  'healthy',
  '192.0.2.10:8080',
);

console.log(targetHealth.node_id, balancerHealth.data?.health, history.data.length);
```

## Plugin availability and legacy schema (`kong.plugins`)

In addition to `PluginCollection` CRUD, `kong.plugins` provides:

- `enabledNames()` (`GET /plugins/enabled`): returns the array of plugin names available on the Kong node.
- `schema(name)` (`GET /plugins/schema/{name}`): fetches a plugin's config schema via Kong's legacy endpoint (prefer `kong.schemas.plugin(name)` for the full entity schema including scope and protocol constraints).

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const enabled = await kong.plugins.enabledNames();
const legacySchema = await kong.plugins.schema('rate-limiting');

console.log(enabled.includes('rate-limiting'), legacySchema);
```
