---
title: Migration from 2.x
group: Guides
---

# Migration from 2.x

`kong-api-client` 3.0 is a ground-up TypeScript rewrite targeting Kong 3.9 (OSS) and Kong Gateway 3.14 (unlicensed).

## Summary of breaking changes

- **Node.js 22.12+ required**; uses native `fetch` with zero runtime dependencies (`axios` and `validator` are gone).
- **Named exports only**: import `{ Kong }` instead of a default CommonJS class (`const { Kong } = require('kong-api-client')` also works in CommonJS on Node 22.12+).
- **Resource collections instead of flat methods**: `kong.services`, `kong.routes`, `kong.consumers`, `kong.plugins`, and 16 additional Kong resources replace `addService`, `findRoutes`, `updateConsumer`, and so on.
- **Plain JSON objects**: methods accept and return Kong's own JSON shapes directly (no `Service`/`Route`/`Consumer`/`Plugin` wrapper classes, no `.data` nesting, and no mutated `kongUrl` field).
- **No client-side validation**: Kong validates entities itself and returns structured `KongHttpError` details.
- **Full pagination**: `.all()` and `.iterate()` follow Kong's `offset` cursor past the 100-item default page limit.
- **Structured errors**: `KongError`, `KongHttpError`, `KongConnectionError`, and `KongTimeoutError` replace the untyped 2.x `KongError` (`{ type, msg, err }`).

## Call-by-call migration table

### Client and lifecycle

| 2.x call                                                          | 3.0 equivalent                                                                                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `const KongApi = require('kong-api-client')`                      | `import { Kong } from 'kong-api-client'` (or `const { Kong } = require('kong-api-client')`)                                                            |
| `new KongApi({ adminUrl })`                                       | `new Kong({ adminUrl })` (also accepts `headers`, `timeoutMs`, `fetch`)                                                                                |
| `new KongApi({ adminUrl, services, routes, consumers, plugins })` | `new Kong({ adminUrl })`; pass entities to resource methods instead of the constructor                                                                 |
| `kong.init()`                                                     | No direct constructor-array initializer; use idempotent `upsert()` calls on each resource collection                                                   |
| `kong.clean()`                                                    | No direct method on this API surface; fetch with `.all()` and `.delete(id)` in reverse dependency order (`plugins`, `routes`, `consumers`, `services`) |

### Services

| 2.x call                        | 3.0 equivalent                                                  |
| ------------------------------- | --------------------------------------------------------------- |
| `kong.addService(service)`      | `kong.services.create(service)`                                 |
| `kong.addServices(services)`    | `Promise.all(services.map((s) => kong.services.create(s)))`     |
| `kong.findServices()`           | `kong.services.all()` (or `list()` / `iterate()`)               |
| `kong.findService(id)`          | `kong.services.get(idOrName)` or `kong.services.find(idOrName)` |
| `kong.updateService(id, patch)` | `kong.services.update(idOrName, patch)`                         |
| `kong.deleteService(id)`        | `kong.services.delete(idOrName)`                                |

### Routes

| 2.x call                      | 3.0 equivalent                                                               |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `kong.addRoute(route)`        | `kong.routes.create(route)` or `kong.services.routes(service).create(route)` |
| `kong.addRoutes(routes)`      | `Promise.all(routes.map((r) => kong.routes.create(r)))`                      |
| `kong.findRoutes()`           | `kong.routes.all()` (or `kong.services.routes(service).all()`)               |
| `kong.findRoute(id)`          | `kong.routes.get(idOrName)` or `kong.routes.find(idOrName)`                  |
| `kong.updateRoute(id, patch)` | `kong.routes.update(idOrName, patch)`                                        |
| `kong.deleteRoute(id)`        | `kong.routes.delete(idOrName)`                                               |

### Consumers

| 2.x call                         | 3.0 equivalent                                                            |
| -------------------------------- | ------------------------------------------------------------------------- |
| `kong.addConsumer(consumer)`     | `kong.consumers.create(consumer)`                                         |
| `kong.addConsumers(consumers)`   | `Promise.all(consumers.map((c) => kong.consumers.create(c)))`             |
| `kong.findConsumers()`           | `kong.consumers.all()` (or `list()` / `iterate()`)                        |
| `kong.findConsumer(id)`          | `kong.consumers.get(idOrUsername)` or `kong.consumers.find(idOrUsername)` |
| `kong.updateConsumer(id, patch)` | `kong.consumers.update(idOrUsername, patch)`                              |
| `kong.deleteConsumer(id)`        | `kong.consumers.delete(idOrUsername)`                                     |

### Plugins

| 2.x call                       | 3.0 equivalent                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kong.addPlugin(plugin)`       | `kong.plugins.create(plugin)` (or `kong.services.plugins(s).create(...)`, `kong.routes.plugins(r).create(...)`, `kong.consumers.plugins(c).create(...)`) |
| `kong.addPlugins(plugins)`     | `Promise.all(plugins.map((p) => kong.plugins.create(p)))`                                                                                                |
| `kong.findPlugins()`           | `kong.plugins.all()` (or `list()` / `iterate()`)                                                                                                         |
| `kong.findPlugin(id)`          | `kong.plugins.get(idOrInstanceName)` or `kong.plugins.find(idOrInstanceName)`                                                                            |
| `kong.updatePlugin(id, patch)` | `kong.plugins.update(idOrInstanceName, patch)`                                                                                                           |
| `kong.deletePlugin(id)`        | `kong.plugins.delete(idOrInstanceName)`                                                                                                                  |

### Domain entity classes (`Service`, `Route`, `Consumer`, `Plugin`)

In 2.x, internal `src/libs/*.lib.js` classes wrapped entity payloads and exposed static/instance HTTP methods. In 3.0 those wrapper classes are removed; use plain objects typed with the exported entity interfaces (`Service`, `ServiceInput`, `Route`, `RouteInput`, `Consumer`, `ConsumerInput`, `Plugin`, `PluginInput`) and call methods on `Kong`:

| 2.x call                                                                            | 3.0 equivalent                                                                    |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `new Service(data)` / `new Route(data)` / `new Consumer(data)` / `new Plugin(data)` | Plain input object (`ServiceInput`, `RouteInput`, `ConsumerInput`, `PluginInput`) |
| `Entity.findAll(url)`                                                               | `kong.<resource>.all()`                                                           |
| `Entity.findById(url, id)`                                                          | `kong.<resource>.get(key)` or `kong.<resource>.find(key)`                         |
| `Entity.delete(url, id)`                                                            | `kong.<resource>.delete(key)`                                                     |
| `entity.create(url)`                                                                | `kong.<resource>.create(input)`                                                   |
| `entity.update(url)`                                                                | `kong.<resource>.update(key, patch)`                                              |
| `entity.delete(url)`                                                                | `kong.<resource>.delete(key)`                                                     |

### Errors

| 2.x error property              | 3.0 equivalent                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `err instanceof KongError`      | `err instanceof KongError` (base class for all client errors)                                                         |
| `err.type === 'NE'` / `err.msg` | `KongError` / `KongHttpError` / `KongTimeoutError` / `KongConnectionError` `.message`                                 |
| `err.type === 'UN'` / `err.err` | `KongHttpError` (`status`, `method`, `path`, `code`, `kongName`, `fields`, `body`) or `KongConnectionError` (`cause`) |

## Before and after example

### 2.x (CommonJS)

```js
const KongApi = require('kong-api-client');

const kong = new KongApi({ adminUrl: 'http://localhost:8001' });

const service = await kong.addService({
  protocol: 'http',
  host: 'billing.internal',
  port: 8080,
  name: 'billing',
});

await kong.updateService(service.id, { host: 'billing-v2.internal' });
const allConsumers = await kong.findConsumers();
```

### 3.0 (TypeScript / ESM)

```ts
import { Kong, KongHttpError } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const service = await kong.services.create({
  host: 'billing.internal',
  port: 8080,
  name: 'billing',
});

await kong.services.update(service.id, { host: 'billing-v2.internal' });

// Fetches all pages, even when there are more than 100 consumers
const allConsumers = await kong.consumers.all();
console.log(allConsumers.length);

try {
  await kong.services.get('missing-service');
} catch (error) {
  if (error instanceof KongHttpError && error.status === 404) {
    console.log('Not found:', error.path);
  } else {
    throw error;
  }
}
```

## 2.x defects fixed in 3.0

1. **`update*()` ignored new values**: `kong.<resource>.update(key, patch)` sends the provided `patch` payload via `PATCH`.
2. **Lists stopped at 100 items**: `iterate()` and `all()` follow Kong's pagination `offset` until the last page.
3. **Client-side validation rejected valid Kong payloads**: routes with only `headers` and services with only `host` are accepted without client-side rejections.
4. **Errors lost HTTP details**: `KongHttpError` exposes `status`, `method`, `path`, `kongName`, `code`, `fields`, and `body`.
5. **Listing mutated entities with `kongUrl`**: returned entities match Kong's JSON responses verbatim.
6. **Static `Entity.delete()` always threw**: `kong.<resource>.delete(key)` removes the entity cleanly.
7. **Missing `adminUrl` threw `TypeError` in edge cases**: `new Kong(...)` validates `adminUrl` and throws `KongError`.
