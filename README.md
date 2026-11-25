# kong-api-client

[![CI](https://github.com/vitorecomp/kong-api-client/actions/workflows/ci.yml/badge.svg)](https://github.com/vitorecomp/kong-api-client/actions/workflows/ci.yml)
[![Docs](https://github.com/vitorecomp/kong-api-client/actions/workflows/docs.yml/badge.svg)](https://vitorecomp.github.io/kong-api-client/)
[![npm version](https://img.shields.io/npm/v/kong-api-client)](https://www.npmjs.com/package/kong-api-client)
![Node.js >= 22.12](https://img.shields.io/badge/node-%3E%3D22.12-339933)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/vitorecomp/kong-api-client/blob/master/LICENSE)

TypeScript SDK for the self-hosted Kong Gateway Admin API — schema-generated types across 125 Admin API endpoints (308 operations), all 45 license-free Kong plugins, AI Gateway helpers (`kong.ai`), and idempotent declarative state reconciliation (`kong.apply`), built on Node's native `fetch` with zero runtime dependencies.

[Documentation Site](https://vitorecomp.github.io/kong-api-client/) · [Getting Started](./docs/getting-started.md) · [Declarative Apply](./docs/apply.md) · [AI Gateway](./docs/ai.md) · [Plugin Reference (45)](./docs/plugins/index.md) · [Endpoint Coverage](./docs/endpoints.md) · [Migration from 2.x](./docs/migration.md)

## Why `kong-api-client`?

- **Zero runtime dependencies:** built on Node's native `fetch` with configurable timeouts, `AbortSignal` cancellation, and both ESM and CommonJS `require()` support on Node 22.12+.
- **Full self-hosted Admin API surface:** 20 top-level resource collections, nested collections and singletons, full cursor pagination (`list`, `iterate`, `all`), and operational namespaces (`node`, `schemas`, `tags`, `cache`, `config`, `debug`, `clustering`, `acme`, `proxyCache`, upstream health).
- **45 typed plugins:** compile-time `ConfigOf<N>` narrowing, `PLUGINS` runtime metadata, and idempotent `kong.plugins.enable()` that adopts existing plugins on a scope instead of failing with `409 Conflict` — plus untyped `Record<string, unknown>` fallback for custom and third-party plugins.
- **AI Gateway helpers:** single-call `kong.ai.llmRoute()` plus typed helpers for Kong's six open-source AI plugins (`ai-proxy`, `ai-prompt-guard`, `ai-prompt-decorator`, `ai-prompt-template`, `ai-request-transformer`, `ai-response-transformer`).
- **Declarative reconciliation:** `kong.apply()` reconciles 10 resource types in dependency order with minimal `PATCH` diffs matching Kong's storage and merge rules, `dryRun` previews, tag-scoped `prune`, and `kong.deleteAll()` for disposable test setups.
- **Kong-authoritative, secret-safe errors:** no client-side validation; Kong's own errors are surfaced via `KongHttpError` (`status`, `code`, `kongName`, per-field `fields`) without storing request headers or bodies.

## Install & Requirements

- **Node.js 22.12** or later

```bash
npm install kong-api-client
```

For `3.0.0-rc.*` pre-releases, install from the `next` dist-tag:

```bash
npm install kong-api-client@next
```

Upgrading from 2.x? See the [Migration from 2.x guide](./docs/migration.md).

The package ships as ESM (`import { Kong } from 'kong-api-client'`) and has no top-level `await`, so CommonJS `require()` also works on Node 22.12+:

```js
const { Kong } = require('kong-api-client');
const kong = new Kong({ adminUrl: 'http://localhost:8001' });
```

## Quick Start

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({
  adminUrl: 'http://localhost:8001',
  headers: () => ({
    'Kong-Admin-Token': process.env.KONG_ADMIN_TOKEN ?? '',
  }),
  timeoutMs: 10_000,
});

const service = await kong.services.upsert('billing', {
  name: 'billing',
  url: 'http://billing.internal:8080',
});

const route = await kong.services.routes(service.id).upsert('billing-v1', {
  name: 'billing-v1',
  paths: ['/v1/billing'],
  protocols: ['http', 'https'],
});

const consumer = await kong.consumers.upsert('alice', {
  username: 'alice',
  custom_id: 'user-42',
});

const credential = await kong.consumers.keyAuth(consumer.id).create({
  key: 'alice-secret-key',
});

// Idempotent enable: `config` is narrowed to RateLimitingConfig
const rateLimit = await kong.plugins.enable('rate-limiting', {
  on: { route: route.id },
  config: {
    minute: 120,
    policy: 'local',
  },
});

console.log({
  serviceId: service.id,
  routeId: route.id,
  credentialKey: credential.key,
  minuteLimit: rateLimit.config.minute,
});
```

## Usage Examples

### Declarative configuration (`kong.apply`)

Reconcile upstreams, targets, services, routes, consumers, and typed plugins in dependency order. Pass `{ dryRun: true }` to preview planned changes with zero writes, or `{ prune: true }` to delete dropped entities carrying your managed tag:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const result = await kong.apply(
  {
    upstreams: [{ name: 'billing-pool.internal', slots: 200 }],
    targets: [
      { upstream: 'billing-pool.internal', target: '10.0.1.1:8080', weight: 100 },
      { upstream: 'billing-pool.internal', target: '10.0.1.2:8080', weight: 100 },
    ],
    services: [{ name: 'billing', url: 'http://billing-pool.internal:8080/v1' }],
    routes: [
      {
        name: 'billing-api',
        service: { name: 'billing' },
        paths: ['/billing'],
        protocols: ['http', 'https'],
      },
    ],
    consumers: [{ username: 'alice', custom_id: 'user-42' }],
    plugins: [
      {
        name: 'correlation-id',
        instance_name: 'billing-correlation-id',
        service: { name: 'billing' },
        config: { header_name: 'X-Request-Id' },
      },
      {
        name: 'rate-limiting',
        instance_name: 'billing-rate-limit',
        route: { name: 'billing-api' },
        config: { minute: 120, policy: 'local' },
      },
    ],
  },
  { prune: true, tag: 'managed-by:billing' },
);

console.log(result.summary);
```

### AI Gateway (`kong.ai`)

Create or update a service, route, and `ai-proxy` plugin in one call with `kong.ai.llmRoute()`, then layer guardrails or prompt plugins on that route:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const chat = await kong.ai.llmRoute({
  name: 'assistant-chat',
  paths: ['/v1/chat'],
  protocols: ['http', 'https'],
  provider: 'openai',
  model: 'gpt-4o-mini',
  auth: {
    headerName: 'Authorization',
    headerValue: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
  },
});

const guard = await kong.ai.promptGuard(
  { route: chat.route.id },
  {
    deny_patterns: ['ignore previous instructions'],
    allow_all_conversation_history: false,
  },
);

console.log(chat.route.id, chat.plugin.config.model.name, guard.id);
```

### CRUD, deep `PATCH` updates (`Patch<T>`), and pagination

`find()` returns `undefined` on `404` while `get()` throws `KongHttpError`. `update()` accepts recursive `Patch<T>` payloads matching Kong's merge rules (nested records merge field by field; arrays and maps replace whole), whereas `upsert()` replaces the entire entity:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

// `find()` returns undefined on 404; `get()` throws KongHttpError
const existing = await kong.services.find('billing');
if (!existing) {
  await kong.services.upsert('billing', {
    name: 'billing',
    host: 'billing.internal',
    port: 8080,
  });
}

// Deep record PATCH: updates `concurrency`, preserves sibling healthcheck fields
await kong.upstreams.update('billing-pool.internal', {
  healthchecks: {
    active: { concurrency: 12 },
  },
});

// Stream every page lazily across Kong's 100-item default page limit
for await (const route of kong.routes.iterate({ tags: ['public'] })) {
  console.log(route.name, route.paths);
}

// Collect all matching services across pages (OR tag filter)
const services = await kong.services.all({ tags: { any: ['billing', 'orders'] } });
console.log(services.length);
```

### Operational Admin APIs & `kong.request()` escape hatch

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const status = await kong.node.status();
const check = await kong.schemas.validatePlugin({
  name: 'key-auth',
  config: { key_names: ['X-API-Key'] },
});
const health = await kong.upstreams.health('billing-pool.internal');

// On DB-less nodes (`KONG_DATABASE=off`)
await kong.config.load({
  _format_version: '3.0',
  services: [{ name: 'api', url: 'http://api.internal:8080' }],
});

// Escape hatch for any Admin API path outside the typed surface
interface CustomStatus {
  database: { reachable: boolean };
}
const raw = await kong.request<CustomStatus>({ method: 'GET', path: '/status' });

console.log(status.server.total_requests, check.message, health.node_id, raw.database.reachable);
```

### Error handling

```ts
import { Kong, KongConnectionError, KongHttpError, KongTimeoutError } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001', timeoutMs: 5_000 });

try {
  await kong.services.create({ host: 'billing.internal', port: 99_999 });
} catch (error) {
  if (error instanceof KongHttpError) {
    console.error(error.status, error.kongName, error.fields);
  } else if (error instanceof KongTimeoutError) {
    console.error(`Timed out after ${error.timeoutMs}ms`);
  } else if (error instanceof KongConnectionError) {
    console.error('Could not reach Kong Admin API:', error.cause);
  } else {
    throw error;
  }
}
```

## Client Surface at a Glance

| Area                       | Properties & Methods                                                                                                                                    | Guide                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Core traffic resources     | `kong.services`, `kong.routes`, `kong.consumers`, `kong.plugins`, `kong.upstreams`                                                                      | [Resources](./docs/resources.md)                                            |
| TLS, crypto & secrets      | `kong.certificates`, `kong.caCertificates`, `kong.snis`, `kong.vaults`, `kong.keys`, `kong.keySets`, `kong.acmeStorage`, `kong.sessions`                | [Resources](./docs/resources.md)                                            |
| Consumer credentials       | `kong.acls`, `kong.basicAuths`, `kong.hmacAuths`, `kong.jwts`, `kong.keyAuths`, `kong.oauth2`, `kong.oauth2Tokens`                                      | [Resources](./docs/resources.md)                                            |
| Nested collections & links | `services.routes()`, `services.plugins()`, `routes.plugins()`, `routes.service()`, `upstreams.targets()`, `consumers.keyAuth()`, `keySets.keys()`, etc. | [Resources](./docs/resources.md) · [Endpoint Coverage](./docs/endpoints.md) |
| Plugins & metadata         | `kong.plugins.enable()`, `kong.plugins.findOnScope()`, typed `PluginCollection`, `PLUGINS` metadata                                                     | [Plugins](./docs/plugins.md)                                                |
| Operational namespaces     | `kong.node`, `kong.schemas`, `kong.tags`, `kong.cache`, `kong.config`, `kong.debug`, `kong.clustering`, `kong.acme`, `kong.proxyCache`, upstream health | [Admin Endpoints](./docs/admin-endpoints.md)                                |
| AI Gateway                 | `kong.ai.llmRoute()`, `proxy()`, `promptGuard()`, `promptDecorator()`, `promptTemplate()`, `requestTransformer()`, `responseTransformer()`              | [AI Gateway](./docs/ai.md)                                                  |
| Declarative & test helpers | `kong.apply(config, options?)`, `kong.deleteAll({ confirm: 'delete-everything' })`                                                                      | [Declarative Apply](./docs/apply.md)                                        |
| Escape hatch               | `kong.request<T>(options)` — raw Admin API requests reusing configured `adminUrl`, `headers`, `timeoutMs`, and error parsing                            | [Getting Started](./docs/getting-started.md)                                |

## Supported Plugins (45)

All 45 license-free plugins bundled with Kong 3.9 and Kong Gateway 3.14 ship with generated TypeScript config interfaces, `PLUGINS` metadata, and individual reference pages under [All Plugins](./docs/plugins/index.md):

| Category                   | Plugins                                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| AI (6)                     | `ai-prompt-decorator`, `ai-prompt-guard`, `ai-prompt-template`, `ai-proxy`, `ai-request-transformer`, `ai-response-transformer`                 |
| Analytics & Monitoring (5) | `datadog`, `opentelemetry`, `prometheus`, `statsd`, `zipkin`                                                                                    |
| Authentication (7)         | `basic-auth`, `hmac-auth`, `jwt`, `key-auth`, `ldap-auth`, `oauth2`, `session`                                                                  |
| Logging (6)                | `file-log`, `http-log`, `loggly`, `syslog`, `tcp-log`, `udp-log`                                                                                |
| Security (4)               | `acme`, `bot-detection`, `cors`, `ip-restriction`                                                                                               |
| Serverless (4)             | `aws-lambda`, `azure-functions`, `post-function`, `pre-function`                                                                                |
| Traffic Control (8)        | `acl`, `proxy-cache`, `rate-limiting`, `redirect`, `request-size-limiting`, `request-termination`, `response-ratelimiting`, `standard-webhooks` |
| Transformations (5)        | `correlation-id`, `grpc-gateway`, `grpc-web`, `request-transformer`, `response-transformer`                                                     |

Custom, third-party, and Enterprise-only plugins work through the exact same `kong.plugins` and `kong.apply()` methods with `config` typed as `Record<string, unknown>`.

## Supported Kong Versions & Good to Know

| Target                        | Image tested                  | Support status                                                                                     |
| ----------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| **Kong 3.9** (OSS)            | `kong:3.9.5`                  | Full live test coverage (308 operations, 45 plugins, AI, `apply`)                                  |
| **Kong Gateway 3.14**         | `kong/kong-gateway:3.14.0.18` | Full live test coverage **without a license**                                                      |
| Enterprise-licensed / Konnect | —                             | Out of scope (workspaces, RBAC, consumer groups, licensed plugins); reachable via `kong.request()` |

**Good to know:**

- **Pass route `protocols` explicitly:** Kong 3.9 defaults routes to `['http', 'https']`, whereas Kong Gateway 3.14 defaults to `['https']`. Specify `protocols` whenever routes should serve plain HTTP proxy traffic on both targets.
- **`update()` (`PATCH`) vs. `upsert()` (`PUT`):** `update()` merges nested records field by field and replaces arrays and maps whole; `upsert()` replaces the entire entity and resets omitted fields to Kong's defaults. On `keys` and `keySets`, Kong rejects `PUT` by `name` with `500`, so `upsert()` requires a UUID `id` (and `PUT` on upstream `targets` never creates a missing target).
- **Automatic plugin adoption:** both `kong.plugins.enable()` and `kong.apply()` adopt an existing plugin of the same name on the target scope (for example one created without an `instance_name`), keeping its `id` and updating it in place instead of failing with `409 Conflict`.

## Documentation, Development, & License

### Guides

Full hosted API reference and guides: [https://vitorecomp.github.io/kong-api-client/](https://vitorecomp.github.io/kong-api-client/)

| Guide                                            | Covers                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| [Getting Started](./docs/getting-started.md)     | Installation, client options, first service/route/consumer/plugin, cancellation, and `kong.request()`              |
| [Resources](./docs/resources.md)                 | All 20 top-level collections, nested collections, singletons, `Patch<T>` merge rules, pagination, and tags         |
| [Plugins](./docs/plugins.md)                     | `kong.plugins.enable()`, scopes, adoption, `findOnScope()`, `PLUGINS` metadata, and proxy propagation notes        |
| [Admin Endpoints](./docs/admin-endpoints.md)     | `node`, `schemas`, `tags`, `cache`, DB-less `config`, `debug`, `clustering`, `acme`, `proxyCache`, upstreams       |
| [Declarative Apply](./docs/apply.md)             | `kong.apply()` order, diff rules, `dryRun`, `prune`, `KongApplyError`, inline vs. variable types, `deleteAll()`    |
| [AI Gateway](./docs/ai.md)                       | `kong.ai.llmRoute()`, dummy service URL, header/param auth, `upstreamUrl`, and all six AI plugin helpers           |
| [Endpoint Coverage](./docs/endpoints.md)         | Complete generated matrix of all 141 recorded endpoints (125 served across 308 operations, 16 excluded)            |
| [Error Handling](./docs/errors.md)               | Error hierarchy (`KongHttpError`, `KongTimeoutError`, `KongConnectionError`, `KongApplyError`) & credential safety |
| [Migration from 2.x](./docs/migration.md)        | Breaking changes, call-by-call upgrade table, before/after examples, and 2.x defects fixed in 3.0                  |
| [Plugin Reference (45)](./docs/plugins/index.md) | Generated configuration field tables, defaults, scopes, protocols, and examples for all 45 plugins                 |

### Development & Contributing

```bash
npm ci
npm run check
npm run build
npm run docs && npm run docs:check
npm run test:package
npm run test:live -- oss-3.9
```

See the [Contributing Guide](https://github.com/vitorecomp/kong-api-client/blob/master/CONTRIBUTING.md) for container engine setup, schema recording, and release steps, and the [Changelog](https://github.com/vitorecomp/kong-api-client/blob/master/CHANGELOG.md) for release notes.

### License

MIT — see [LICENSE](./LICENSE).

The recorded Kong schemas (`schemas/kong-3.9/`) and the field descriptions derived from them are licensed under the Apache License 2.0 — see [NOTICE](./NOTICE) and [LICENSES/Apache-2.0.txt](./LICENSES/Apache-2.0.txt).
