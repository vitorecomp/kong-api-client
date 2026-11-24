# kong-api-client

TypeScript client for the self-hosted Kong Gateway Admin API with zero runtime dependencies.

## Requirements

- Node.js **22.12** or later
- ESM (`import { Kong } from 'kong-api-client'`); CommonJS `require('kong-api-client')` also works on Node 22.12+

## Install

```bash
npm install kong-api-client
```

## Quick start

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({
  adminUrl: 'http://localhost:8001',
});

const service = await kong.services.upsert('billing', {
  name: 'billing',
  url: 'http://billing.internal:8080',
});

const route = await kong.services.routes(service.id).upsert('billing-route', {
  name: 'billing-route',
  paths: ['/billing'],
  protocols: ['http', 'https'],
});

console.log(service.id, route.id);
```

## What is covered

- **Admin API resources**: typed CRUD, `find`, `upsert`, pagination (`list`, `iterate`, `all`), tag filters, nested collections, and singletons across Kong's first-class resources. See the [Resources guide](./docs/resources.md) and [Endpoint Coverage](./docs/endpoints.md).
- **Non-resource Admin endpoints**: node status and metrics, schema inspection and validation, tags, cache, DB-less config, dynamic log levels, clustering, ACME, proxy-cache, and upstream health. See the [Admin Endpoints guide](./docs/admin-endpoints.md).
- **45 first-class plugins**: generated TypeScript config interfaces, idempotent `kong.plugins.enable()`, scope lookup (`findOnScope`), plugin metadata (`PLUGINS`), typed `PluginCollection` methods, and [plugin reference pages](./docs/plugins/index.md) grouped by category. See the [Plugins guide](./docs/plugins.md).
- **Declarative apply & cleanup**: idempotent `kong.apply()` across 10 resource types in dependency order (`dryRun`, tag-scoped `prune`, plugin adoption, `KongApplyError`) plus `kong.deleteAll({ confirm: 'delete-everything' })` for test gateways. See the [Declarative Apply guide](./docs/apply.md).
- **AI Gateway helpers**: `kong.ai.llmRoute()` plus typed helpers for `ai-proxy`, `ai-prompt-guard`, `ai-prompt-decorator`, `ai-prompt-template`, `ai-request-transformer`, and `ai-response-transformer`. See the [AI Gateway guide](./docs/ai.md).
- **Errors & escape hatch**: structured error classes ([Error Handling guide](./docs/errors.md)) and `kong.request()` for endpoints outside the first-class surface.

## Guides

- [Getting Started](./docs/getting-started.md)
- [Resources](./docs/resources.md)
- [Plugins](./docs/plugins.md)
- [Admin Endpoints](./docs/admin-endpoints.md)
- [Declarative Apply](./docs/apply.md)
- [AI Gateway](./docs/ai.md)
- [Endpoint Coverage](./docs/endpoints.md)
- [Error Handling](./docs/errors.md)
- [Migration from 2.x](./docs/migration.md)
- [Plugin Reference](./docs/plugins/index.md)

## Supported Kong versions

Tested live against:

- **Kong 3.9** (open source, `kong:3.9.5`)
- **Kong Gateway 3.14** (`kong/kong-gateway:3.14.0.18`) running **without a license**

Features that require an Enterprise license (workspaces, RBAC, consumer groups, licensed plugins) are out of scope.

## Documentation

Full guides, plugin reference, and API documentation: [https://vitorecomp.github.io/kong-api-client/](https://vitorecomp.github.io/kong-api-client/)

## License

MIT — see [LICENSE](./LICENSE).

The recorded Kong schemas (`schemas/kong-3.9/`) and the field descriptions derived from them are licensed under the Apache License 2.0 — see [NOTICE](./NOTICE) and [LICENSES/Apache-2.0.txt](./LICENSES/Apache-2.0.txt).
