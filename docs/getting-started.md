---
title: Getting Started
group: Guides
---

# Getting Started

`kong-api-client` is a TypeScript client for the Admin API of a self-hosted Kong Gateway. It uses Node's built-in `fetch` and has zero runtime dependencies.

## Requirements

- **Node.js 22.12** or later
- **ESM** (`import { Kong } from 'kong-api-client'`) or **CommonJS** (`const { Kong } = require('kong-api-client')` on Node 22.12+, since the package has no top-level `await`)

## Install

```bash
npm install kong-api-client
```

## Creating a client

Pass the Admin API URL in `KongOptions`:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({
  adminUrl: 'http://localhost:8001',
});
```

### Options

- `adminUrl` (required, `string | URL`): Base URL of the Kong Admin API. Trailing slashes are trimmed and any path prefix (for example `https://gateway.example.com/kong-admin`) is preserved on every request. Passing an empty or invalid URL throws `KongError`.
- `headers` (optional): Static headers object or a synchronous/asynchronous function called once per request. Useful for Admin API authentication headers or rotating tokens.
- `timeoutMs` (optional, default `30000`): Per-request timeout in milliseconds. Set to `0` to disable timeouts.
- `fetch` (optional, default `globalThis.fetch`): Custom `fetch` implementation for custom TLS agents, proxies, or tests.

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({
  adminUrl: 'https://gateway.example.com/kong-admin',
  headers: () => ({
    'Kong-Admin-Token': process.env.KONG_ADMIN_TOKEN ?? '',
  }),
  timeoutMs: 10_000,
});
```

## Creating a service, route, consumer, and plugin

Every Kong entity is a plain JSON object matching Kong's Admin API schema (snake_case fields). The client performs no client-side validation — Kong is the authority and any validation errors are returned as `KongHttpError`.

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

// Create or replace a service using Kong's shorthand `url` field
const service = await kong.services.upsert('orders', {
  name: 'orders',
  url: 'http://orders.internal:8080',
  retries: 3,
});

// Create or replace a route attached to that service.
// Always pass `protocols` explicitly: Kong 3.9 defaults to ['http', 'https'],
// while Kong Gateway 3.14 defaults to ['https'].
const route = await kong.services.routes(service.id).upsert('orders-v1', {
  name: 'orders-v1',
  paths: ['/v1/orders'],
  protocols: ['http', 'https'],
});

// Create a consumer and an API key credential for it
const consumer = await kong.consumers.upsert('alice', {
  username: 'alice',
  custom_id: 'user-42',
});

const credential = await kong.consumers.keyAuth(consumer.id).create({
  key: 'example-api-key',
});

// Attach a typed plugin to the route: `config` is checked against RateLimitingConfig
const plugin = await kong.routes.plugins(route.id).create({
  name: 'rate-limiting',
  config: {
    minute: 120,
    policy: 'local',
  },
});

console.log({
  serviceId: service.id,
  routeId: route.id,
  credentialKey: credential.key,
  minuteLimit: plugin.config.minute,
});
```

## Reading, updating, and deleting

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

// `get` throws KongHttpError (status 404) if missing; `find` returns undefined
const existing = await kong.services.find('orders');

if (existing) {
  // `update` sends PATCH: omitted fields keep their existing values
  const patched = await kong.services.update(existing.id, { retries: 5 });
  console.log(patched.retries, patched.host);

  // `delete` sends DELETE and resolves to void
  await kong.services.delete(existing.id);
}
```

## Cancelling requests

Every resource method accepts `{ signal?: AbortSignal }` as its last argument:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });
const controller = new AbortController();

const services = await kong.services.all({ size: 50 }, { signal: controller.signal });
console.log(services.length);
```

## Escape hatch for other Admin API endpoints

Use `kong.request()` to call any Admin API path directly while keeping your configured `adminUrl`, `headers`, `timeoutMs`, and error parsing:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

interface KongStatus {
  database: { reachable: boolean };
}

const status = await kong.request<KongStatus>({
  method: 'GET',
  path: '/status',
});

console.log(status.database.reachable);
```

## Supported Kong versions

`kong-api-client` is generated from and tested live against:

- **Kong 3.9** (open source, `kong:3.9.5`)
- **Kong Gateway 3.14** (`kong/kong-gateway:3.14.0.18`) running **without a license**

Fields or enum values specific to one target are documented in the generated JSDoc comments (for example `Kong Gateway 3.14 only`). Enterprise-only features that require a license (workspaces, RBAC, consumer groups, licensed plugins) are out of scope, though reachable via `kong.request()`.

## Next steps

- [Resources](./resources.md) — collections, nested resources, singletons, pagination, and tag filters
- [Plugins](./plugins.md) — idempotent `kong.plugins.enable()`, scopes, adoption, `findOnScope`, and `PLUGINS` metadata
- [Admin Endpoints](./admin-endpoints.md) — node status, schemas, tags, cache, DB-less config, log levels, clustering, ACME, proxy-cache, and upstream health
- [Declarative Apply](./apply.md) — idempotent `kong.apply()`, diff rules, `dryRun`, `prune`, `KongApplyError`, and `kong.deleteAll()`
- [AI Gateway](./ai.md) — `kong.ai.llmRoute()` and typed helpers for Kong's six AI plugins
- [Endpoint Coverage](./endpoints.md) — every Admin API endpoint and the call that serves it
- [Error Handling](./errors.md) — error classes, Kong validation details, timeouts, and aborts
- [Plugin Reference](./plugins/index.md) — configuration tables for all 45 first-class plugins
- [Migration from 2.x](./migration.md) — call-by-call upgrade table from `kong-api-client` 2.x
