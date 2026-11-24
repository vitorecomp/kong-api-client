---
title: Resources
group: Guides
---

# Resources

`Kong` exposes one typed collection property for every top-level Admin API resource in Kong's open-source surface, plus methods on those resources for nested collections and related singletons.

## Top-level resources

| Property              | Admin API path     | Secondary lookup key                                   |
| --------------------- | ------------------ | ------------------------------------------------------ |
| `kong.services`       | `/services`        | `name`                                                 |
| `kong.routes`         | `/routes`          | `name`                                                 |
| `kong.consumers`      | `/consumers`       | `username`                                             |
| `kong.plugins`        | `/plugins`         | `instance_name`                                        |
| `kong.upstreams`      | `/upstreams`       | `name`                                                 |
| `kong.certificates`   | `/certificates`    | SNI name (`GET`)                                       |
| `kong.snis`           | `/snis`            | `name`                                                 |
| `kong.caCertificates` | `/ca_certificates` | `id` only                                              |
| `kong.vaults`         | `/vaults`          | `prefix`                                               |
| `kong.keys`           | `/keys`            | `name` (`GET`, `PATCH`, `DELETE`; `PUT` requires `id`) |
| `kong.keySets`        | `/key-sets`        | `name` (`GET`, `PATCH`, `DELETE`; `PUT` requires `id`) |
| `kong.acls`           | `/acls`            | `id` only                                              |
| `kong.basicAuths`     | `/basic-auths`     | `username`                                             |
| `kong.hmacAuths`      | `/hmac-auths`      | `username`                                             |
| `kong.jwts`           | `/jwts`            | `key`                                                  |
| `kong.keyAuths`       | `/key-auths`       | `key`                                                  |
| `kong.oauth2`         | `/oauth2`          | `client_id`                                            |
| `kong.oauth2Tokens`   | `/oauth2_tokens`   | `access_token`                                         |
| `kong.sessions`       | `/sessions`        | `session_id`                                           |
| `kong.acmeStorage`    | `/acme_storage`    | `id` only                                              |

Kong serves `targets` only underneath an upstream, so targets are accessed exclusively via `kong.upstreams.targets(upstream)` rather than a top-level property. For the complete endpoint-by-endpoint matrix, see [Endpoint Coverage](./endpoints.md).

## Collection operations

Every top-level and nested collection extends `Collection<E, I>`, where `E` is the entity returned by Kong and `I` is the input payload accepted by Kong:

| Method                         | HTTP call               | Notes                                                          |
| ------------------------------ | ----------------------- | -------------------------------------------------------------- |
| `create(input, options?)`      | `POST <base>`           | Creates a new entity.                                          |
| `get(key, options?)`           | `GET <base>/<key>`      | Throws `KongHttpError` (404) when the entity does not exist.   |
| `find(key, options?)`          | `GET <base>/<key>`      | Returns `undefined` on 404; rethrows all other errors.         |
| `update(key, patch, options?)` | `PATCH <base>/<key>`    | Partial update; fields omitted from `patch` keep their values. |
| `upsert(key, input, options?)` | `PUT <base>/<key>`      | Creates or replaces; omitted fields reset to Kong's defaults.  |
| `delete(key, options?)`        | `DELETE <base>/<key>`   | Deletes the entity and resolves to `void`.                     |
| `list(params?, options?)`      | `GET <base>`            | Fetches one page (`Page<E>`).                                  |
| `iterate(params?, options?)`   | `GET <base>` (repeated) | Async generator yielding every entity across all pages.        |
| `all(params?, options?)`       | `GET <base>` (repeated) | Collects every entity across all pages into an array.          |

Keys passed to `get`, `find`, `update`, `upsert`, `delete`, and nested accessors are URL-encoded automatically with `segment()` — reserved and non-ASCII characters (spaces, `/`, `?`, `#`, `%`, `+`, `&`, `:`, and UTF-8 letters such as `café`) are percent-encoded by the library and decoded by Kong on resource paths. Passing an empty string throws `KongError`.

### `update` (`PATCH`) vs. `upsert` (`PUT`)

Kong treats `PATCH` and `PUT` differently:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const created = await kong.services.create({
  name: 'catalog',
  host: 'catalog.internal',
  port: 8080,
  path: '/api',
  retries: 7,
});

// PATCH: changes `retries`, keeps `path: '/api'` and `port: 8080`
const patched = await kong.services.update(created.id, { retries: 3 });
console.log(patched.retries, patched.path); // 3, '/api'

// PUT: replaces the entity — omitted `retries` resets to 5 and `path` resets to null
const replaced = await kong.services.upsert('catalog', {
  name: 'catalog',
  host: 'catalog.internal',
  port: 8080,
});
console.log(replaced.retries, replaced.path); // 5, null
```

### Nested merge rules in `update` (`Patch<T>`)

`update()` accepts `Patch<I>` (exported from `kong-api-client`), matching how Kong merges `PATCH` payloads:

- **Records** (objects with fixed schema fields, such as `upstream.healthchecks.active` or `ai-proxy`'s `config.model.options`) merge **field by field at any depth** — pass only the nested fields you want to change and sibling fields keep their values.
- **Arrays** (such as `tags`, `paths`, or `request-transformer`'s `config.add.headers`) are **replaced as a whole** when included, while sibling fields on the surrounding record keep their values.
- **Maps** (`Record<string, ...>` key-value fields, such as `routes.headers` or `http-log`'s `config.headers`) are **replaced as a whole** when included — omitted keys in that map are removed, while sibling fields outside the map keep their values.

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

// Deep record merge: changes `concurrency`, preserves `http_path` and `timeout`
await kong.upstreams.update('backend-pool', {
  healthchecks: {
    active: { concurrency: 12 },
  },
});

// Deep record merge on a typed plugin: changes `temperature`, preserves `provider`, `name`, and `max_tokens`
await kong.plugins.update<'ai-proxy'>('ai-proxy-plugin-id', {
  config: {
    model: {
      options: { temperature: 0.9 },
    },
  },
});

// Map replacement: replaces the entire `headers` map (previous keys are dropped), preserves `http_endpoint`
await kong.plugins.update<'http-log'>('http-log-plugin-id', {
  config: {
    headers: { 'x-c': '3' },
  },
});

// Array replacement: replaces the entire `headers` array, preserves sibling `querystring`
await kong.plugins.update<'request-transformer'>('req-tx-plugin-id', {
  config: {
    add: {
      headers: ['x-c:3'],
    },
  },
});
```

### Resource-specific Kong behaviours

A few resources deviate from Kong's general `PUT` semantics on both Kong 3.9 and Kong Gateway 3.14:

- **`keys` and `key-sets`**: `get`, `find`, `update` (`PATCH`), and `delete` all accept `name` as well as `id`, but **`upsert` (`PUT`) only works by `id`**. Sending `PUT /keys/{name}`, `PUT /key-sets/{name}`, or `PUT /key-sets/{keySet}/keys/{name}` causes Kong to answer `500 An unexpected error occurred` for both existing and new names (leaving existing entities unchanged and not creating new ones).
- **Upstream `targets`**: `upsert` (`PUT /upstreams/{upstream}/targets/{key}`) **never creates** a missing target — Kong answers `404` when the target address does not exist. On an existing target (keyed by `id` or `host:port`), `PUT` merges like `PATCH`: omitted fields such as `weight` and `tags` keep their existing values instead of resetting to defaults.

## Nested collections

Parent resources provide methods for Kong's nested endpoints. In a nested collection, the parent entity is already identified by the URL, so its foreign-key field is automatically optional in the input type (`NestedInput`):

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

// Targets below an upstream — `upstream` does not need to be repeated in the body
const upstream = await kong.upstreams.upsert('backend-pool', {
  name: 'backend-pool',
});

const target = await kong.upstreams.targets(upstream.name).create({
  target: '192.0.2.10:8080',
  weight: 100,
});

// Credentials below a consumer — `consumer` is supplied by the URL
const consumer = await kong.consumers.upsert('bob', { username: 'bob' });
const acl = await kong.consumers.acls(consumer.username ?? consumer.id).create({
  group: 'admins',
});

console.log(target.id, acl.id);
```

Nested accessors return a plain `Collection` (or `PluginCollection` for nested plugins) rather than the child's top-level resource class, so the type system prevents building nested paths that Kong does not serve.

## Singletons

Related single-entity endpoints (such as `/routes/{route}/service`, `/key-auths/{credential}/consumer`, or `/services/{service}/client_certificate`) return a `Singleton<E, I>` with `get`, `find`, `update`, and `upsert`:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const routeService = kong.routes.service('billing-route');

const current = await routeService.get();
console.log(current.host);

// Partial update of the referenced service
await routeService.update({ retries: 2 });

// Full replacement of the referenced service (omitted fields reset to defaults, including `name`)
await routeService.upsert({
  name: current.name,
  host: current.host,
  port: current.port,
});
```

`Singleton` intentionally has no `delete` method because Kong answers `DELETE` on singleton endpoints with `405 Method Not Allowed`.

## Pagination and tag filtering

Kong returns at most 100 entities per page by default. Use `list()` when you want a single page with its `offset` cursor, `iterate()` to stream entities page by page, or `all()` to collect every matching entity across all pages:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

// Single page
const firstPage = await kong.services.list({ size: 25 });
console.log(firstPage.data.length, firstPage.offset);

// Stream all pages lazily
for await (const consumer of kong.consumers.iterate({ size: 100 })) {
  console.log(consumer.id, consumer.username);
}

// Collect all pages with tag filters
const allProdAndPayments = await kong.services.all({
  tags: ['prod', 'payments'], // array or { all: [...] } -> AND (joined with ',')
});

const eitherTeam = await kong.services.all({
  tags: { any: ['team-a', 'team-b'] }, // OR (joined with '/')
});

console.log(allProdAndPayments.length, eitherTeam.length);
```

Not every Kong entity supports `tags` (for example `oauth2_tokens`, `sessions`, and `acme_storage` do not have a `tags` field).

## Typed plugin collections

`kong.plugins`, `kong.services.plugins(service)`, `kong.routes.plugins(route)`, and `kong.consumers.plugins(consumer)` are instances of `PluginCollection`. The `name` field selects the TypeScript type of `config`:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

// Known plugin name -> `config` is typed as HttpLogConfig
const httpLog = await kong.plugins.create({
  name: 'http-log',
  config: {
    http_endpoint: 'https://logs.example.com/ingest',
    timeout: 5000,
  },
});
console.log(httpLog.config.http_endpoint);

// Custom plugin name -> `config` accepts Record<string, unknown>
const custom = await kong.plugins.create({
  name: 'my-custom-plugin',
  config: {
    custom_option: true,
  },
});
console.log(custom.id);
```

See the [Plugins guide](./plugins.md) for `enable()`, scopes, and `PLUGINS` metadata, or the [Plugin Reference](./plugins/index.md) for all 45 first-class plugins and their config fields.
