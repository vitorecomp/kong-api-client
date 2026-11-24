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

- **Admin API resources**: typed CRUD, `find`, `upsert`, pagination (`list`, `iterate`, `all`), tag filters, nested collections, and singletons across Kong's first-class resources. See the [Resources guide](./docs/resources.md).
- **45 first-class plugins**: generated TypeScript config interfaces, plugin metadata (`PLUGINS`), typed `PluginCollection` methods, and [plugin reference pages](./docs/plugins/index.md) grouped by category.
- **Declarative apply & AI helpers**: documented in their guides on the documentation site.
- **Errors & escape hatch**: structured error classes ([Error Handling guide](./docs/errors.md)) and `kong.request()` for endpoints outside the first-class surface.

## Guides

- [Getting Started](./docs/getting-started.md)
- [Resources](./docs/resources.md)
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
