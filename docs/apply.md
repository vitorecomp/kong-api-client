---
title: Declarative Apply
group: Guides
---

# Declarative Apply

`kong.apply(config, options?)` reconciles a declarative TypeScript configuration against a running Kong Gateway. On each run it reads existing entities, creates missing ones, sends minimal `PATCH` requests only for entities whose declared fields differ, leaves matching entities untouched (zero writes on a repeat run), and optionally prunes managed entities removed from the config.

## Complete configuration example

An `ApplyConfig` object can declare any subset of ten Kong resource types. Certificates and CA certificates have no unique name in Kong, so they are identified by a caller-supplied UUID `id`; every other resource uses its natural unique key.

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const certId = '11111111-2222-4333-8444-555555555551';
const caCertId = '11111111-2222-4333-8444-555555555552';

const result = await kong.apply({
  certificates: [
    {
      id: certId,
      cert: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
      key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
    },
  ],
  ca_certificates: [
    {
      id: caCertId,
      cert: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
    },
  ],
  snis: [
    {
      name: 'api.example.com',
      certificate: { id: certId },
    },
  ],
  vaults: [
    {
      prefix: 'app-env',
      name: 'env',
      description: 'Application environment variables',
      config: { prefix: 'APP_' },
    },
  ],
  upstreams: [
    {
      name: 'billing-pool.internal',
      slots: 200,
    },
  ],
  targets: [
    { upstream: 'billing-pool.internal', target: '10.0.1.1:8080', weight: 100 },
    { upstream: 'billing-pool.internal', target: '10.0.1.2:8080', weight: 100 },
  ],
  services: [
    {
      name: 'billing',
      url: 'http://billing-pool.internal:8080/v1',
      retries: 3,
    },
  ],
  routes: [
    {
      name: 'billing-api',
      service: { name: 'billing' },
      paths: ['/billing'],
      // Always pass protocols explicitly: Kong 3.9 defaults to ['http', 'https'],
      // while Kong Gateway 3.14 defaults to ['https'].
      protocols: ['http', 'https'],
    },
  ],
  consumers: [
    {
      username: 'alice',
      custom_id: 'user-42',
    },
  ],
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
});

console.log(result.summary, result.changes);
```

## Apply order and entity matching

`kong.apply()` processes resource collections in strict dependency order (parents before children):

| Order | Config property   | Matched by                         | Create / update requests                                                                  |
| ----- | ----------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| 1     | `certificates`    | `id` (UUID)                        | `PUT /certificates/{id}` / `PATCH /certificates/{id}`                                     |
| 2     | `ca_certificates` | `id` (UUID)                        | `PUT /ca_certificates/{id}` / `PATCH /ca_certificates/{id}`                               |
| 3     | `snis`            | `name`                             | `PUT /snis/{name}` / `PATCH /snis/{name}`                                                 |
| 4     | `vaults`          | `prefix`                           | `PUT /vaults/{prefix}` / `PATCH /vaults/{prefix}`                                         |
| 5     | `upstreams`       | `name`                             | `PUT /upstreams/{name}` / `PATCH /upstreams/{name}`                                       |
| 6     | `targets`         | Normalized `target` per `upstream` | `POST /upstreams/{upstream}/targets` / `PATCH /upstreams/{upstream}/targets/{id}`         |
| 7     | `services`        | `name`                             | `PUT /services/{name}` / `PATCH /services/{name}`                                         |
| 8     | `routes`          | `name`                             | `PUT /routes/{name}` / `PATCH /routes/{name}`                                             |
| 9     | `consumers`       | `username`                         | `PUT /consumers/{username}` / `PATCH /consumers/{username}`                               |
| 10    | `plugins`         | `instance_name`, else name + scope | `PUT /plugins/{instance_name}` / `PATCH /plugins/{instance_name}` (or `{id}` on adoption) |

Targets are reported in `result.changes` using the key `<upstream>/<target>`.

### Plugin adoption

Every plugin entry in `ApplyConfig` requires an `instance_name`. If Kong has no plugin with that `instance_name`, `apply()` resolves the plugin's declared scope (`service`, `route`, `consumer`, or global when all three are omitted) and calls `kong.plugins.findOnScope(name, scope)` to look for an existing plugin of the same `name` on that exact scope (for example one created earlier via Kong Manager, decK, or plain `create()` without an `instance_name`).

When a match is found, `apply()` **adopts** it rather than hitting a `409 Conflict`: it keeps the plugin's existing `id` and sends `PATCH /plugins/{id}` to set `instance_name`, attach the managed tag, and update any differing fields. Subsequent runs find the plugin directly by `instance_name`.

## Comparison rules

When an entity already exists in Kong, `apply()` compares the declared entry against the stored entity to decide whether a `PATCH` is needed:

- **Declared fields only:** fields you omit from your config are ignored, so Kong defaults and fields managed elsewhere do not cause updates.
- **Records recursively:** nested objects with fixed schema fields (such as `config.queue` or `healthchecks.active`) are compared recursively for declared keys only.
- **Arrays in order:** ordinary arrays (such as `routes.paths`) are compared element by element in order.
- **Sets without order:** fields defined as Kong `set` types in the recorded schemas (for example `tags`, `routes.protocols`, `routes.methods`, `routes.snis`, `plugins.protocols`, `jwt` `config.claims_to_verify`, `key-auth` `config.identity_realms`, and `session` `config.bind`) are compared without regard to order or duplicates — `['https', 'http']` equals `['http', 'https']`.
- **Maps whole:** fields defined as Kong `map` types (for example `routes.headers`, `upstreams.healthchecks.active.headers`, `http-log` `config.headers`, `opentelemetry` `config.headers` and `config.resource_attributes`, `response-ratelimiting` `config.limits`, and `custom_fields_by_lua`) are compared as a whole. Removing a key from a declared map triggers a `PATCH` that replaces the map and removes that key in Kong.
- **`null` equals absent:** declaring a field as `null` matches both `null` and an omitted (`undefined`) field in Kong's stored entity.
- **References by name or `id`:** foreign-key references (`routes.service`, `plugins.service`, `plugins.route`, `plugins.consumer`) may be written using `{ id }`, `{ name }` (for services and routes), or `{ username }` (for consumers). `apply()` resolves name/username references to UUIDs (from entities created or fetched earlier in the run, or by looking up pre-existing external entities) before comparing against Kong's stored `{ id }`.
- **Service `url` shorthand:** before creating or comparing a service, a splittable `url` is expanded into `protocol`, `host`, `port`, and `path` matching Kong's own parser:
  - default port is `443` for `https` and `wss`, and `80` for every other scheme (`http`, `grpc`, `grpcs`, `tcp`, `tls`, `udp`, `ws`);
  - `path` is kept raw up to `?` or `#`, or `null` when absent (no path normalization; query strings and fragments are ignored);
  - userinfo (`user:pw@`) is stripped, hostname case is kept, and IPv6 brackets are stripped from `host` (`http://[::1]:8080/x` → `host: '::1'`);
  - **`url` wins over sibling `protocol`, `host`, `port`, and `path` fields** if both are provided, matching Kong's precedence;
  - an unsplittable `url` (such as `'example.com/x'` or `'http://example.com:abc/x'`) is forwarded untouched so Kong answers with its own `400` validation error.
- **Target addresses:** target addresses are normalized to Kong's canonical stored format during matching, diffing, and pruning — omitted ports default to `:8000` (`'10.0.0.5'` → `'10.0.0.5:8000'`), numeric ports drop leading zeroes (`'localhost:0080'` → `'localhost:80'`), IPv6 literals expand to eight 4-digit lowercase hex groups inside brackets (`'::1'` → `'[0000:0000:0000:0000:0000:0000:0000:0001]:8000'`, `'[2001:DB8::1]:81'` → `'[2001:0db8:0000:0000:0000:0000:0000:0001]:81'`), and hostname case is preserved. Unparseable addresses are left untouched for Kong to validate.
- **Tags and the managed tag:**
  - Every created or updated entity is stamped with the managed tag (default `'managed-by:kong-api-client'`, configurable via `options.tag`).
  - When `tags` is **omitted** on an existing entity, any existing tags on that entity are preserved and `apply()` only ensures the managed tag is present.
  - When `tags` is **declared** (including `tags: []`), the entity's tags are reconciled to exactly those declared tags plus the managed tag (compared as an unordered set).

## Result, `dryRun`, `prune`, and `tag`

`kong.apply()` returns an `ApplyResult`:

- `changes`: ordered array of `{ type, key, action, fields? }` entries, where `action` is `'create'`, `'update'`, `'unchanged'`, or `'delete'`, and `fields` lists the top-level fields that differed when `action === 'update'`.
- `summary`: `{ create, update, unchanged, delete }` counts across `changes`.
- `dryRun`: `true` when executed in dry-run mode.

Options (`ApplyOptions`):

- **`dryRun`** (default `false`): reads Kong and computes every planned create, update, unchanged, and delete entry without sending any write request (`POST`, `PUT`, `PATCH`, or `DELETE`).
- **`prune`** (default `false`): after applying, deletes entities carrying `tag` that are no longer present in `config`, in reverse dependency order (`plugins` → `consumers` → `routes` → `services` → `targets` → `upstreams` → `vaults` → `snis` → `ca_certificates` → `certificates`):
  - **Never touches** untagged entities, entities managed under a different `tag`, or resources outside `ApplyConfig` (such as credentials, `keys`, `key-sets`, `sessions`, and `acme_storage`).
  - **Targets per upstream:** Kong only lists targets underneath an upstream, so `prune` checks managed targets on every upstream named in `config.upstreams` or `config.targets`. Dropping an entire managed upstream deletes the upstream and lets Kong cascade-delete its targets.
- **`tag`** (default `'managed-by:kong-api-client'`): scopes ownership when multiple services or teams share one Kong cluster. Running `kong.apply({}, { prune: true, tag })` removes every entity managed under that tag.

```ts
import { Kong, type ApplyConfig } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const config: ApplyConfig = {
  services: [{ name: 'orders', url: 'http://orders.internal:8080' }],
  routes: [
    {
      name: 'orders-v1',
      service: { name: 'orders' },
      paths: ['/v1/orders'],
      protocols: ['http', 'https'],
    },
  ],
};

// Preview changes (including planned deletes) without writing to Kong
const plan = await kong.apply(config, {
  dryRun: true,
  prune: true,
  tag: 'managed-by:orders-team',
});
console.log(plan.dryRun, plan.summary);

// Apply and prune dropped entities owned by the same tag
const applied = await kong.apply(config, {
  prune: true,
  tag: 'managed-by:orders-team',
});
for (const change of applied.changes) {
  console.log(change.action, change.type, change.key, change.fields ?? []);
}
```

## Error handling (`KongApplyError`)

If any step fails (for example Kong rejects an entity with `400 schema violation` or a network error occurs), `kong.apply()` stops immediately and throws `KongApplyError` (a subclass of `KongError`). **Nothing is rolled back** — entities created or updated earlier in the run stay in Kong.

`KongApplyError` exposes:

- `error.failed`: `{ type, key, action }` identifying the step that failed.
- `error.result`: partial `ApplyResult` containing every change completed before the failure.
- `error.cause`: the underlying error (such as `KongHttpError`, `KongTimeoutError`, or `KongConnectionError`).

```ts
import { Kong, KongApplyError, KongHttpError } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

try {
  await kong.apply({
    services: [
      { name: 'svc-1', host: 'svc-1.internal', port: 8080 },
      { name: 'svc-2', host: 'svc-2.internal', port: 99_999 },
    ],
  });
} catch (error) {
  if (error instanceof KongApplyError) {
    console.error('Failed step:', error.failed);
    console.error('Already applied (not rolled back):', error.result.changes);
    if (error.cause instanceof KongHttpError) {
      console.error('Kong error:', error.cause.status, error.cause.fields);
    }
  } else {
    throw error;
  }
}
```

## Typed plugin configs: inline vs. `ApplyConfig` variables

`kong.apply()` uses a `const` tuple type parameter (`ApplyConfig<P>`) for `config.plugins`:

- **Inline config (`kong.apply({ plugins: [...] })`):** TypeScript infers each plugin's literal `name`, so each entry's `config` is checked against that plugin's generated config interface (unknown fields and wrong types fail to compile; custom plugin names fall back to `Record<string, unknown>`).
- **Variable typed `ApplyConfig`:** when a config is stored in a variable annotated as plain `ApplyConfig` (with no type argument, where `P` defaults to `string[]`), plugin names widen to `string` and `config` widens to `Record<string, unknown>`. You still get full checking on `instance_name` and all non-plugin resources, but not on plugin-specific `config` fields.
- **Keeping strict plugin config types on a variable:** specify the plugin-name tuple on `ApplyConfig<[...]>`:

```ts
import { Kong, type ApplyConfig } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

// 1. Inline call: `config` is strictly typed from each plugin's `name`
await kong.apply({
  plugins: [
    {
      name: 'http-log',
      instance_name: 'inline-http-log',
      config: { http_endpoint: 'https://logs.example.com/ingest', timeout: 5000 },
    },
    {
      name: 'my-custom-plugin',
      instance_name: 'inline-custom',
      config: { custom_flag: true },
    },
  ],
});

// 2. Variable with explicit plugin tuple: keeps strict per-plugin `config` checking
const typedConfig: ApplyConfig<['correlation-id', 'cors']> = {
  plugins: [
    {
      name: 'correlation-id',
      instance_name: 'var-correlation-id',
      config: { header_name: 'X-Correlation-Id' },
    },
    {
      name: 'cors',
      instance_name: 'var-cors',
      config: { credentials: false },
    },
  ],
};
await kong.apply(typedConfig);

// 3. Plain `ApplyConfig` variable: accepts dynamic arrays, `config` widens to Record<string, unknown>
const dynamicConfig: ApplyConfig = {
  services: [{ name: 'api', host: 'api.internal', port: 8080 }],
  plugins: [
    {
      name: 'http-log',
      instance_name: 'dynamic-http-log',
      config: { http_endpoint: 'https://logs.example.com/ingest' },
    },
  ],
};
await kong.apply(dynamicConfig);
```

## Known limits

- **Deprecated field aliases rewritten by Kong:** if a plugin schema rewrites a deprecated field into a newer field name and omits the deprecated name from stored responses, `apply()` cannot see the deprecated key in Kong and reports `action: 'update'` on every run. For example, on `opentelemetry`, Kong rewrites deprecated `config.endpoint` into `config.traces_endpoint`; declare `traces_endpoint` directly for zero-write idempotency.
- **Credentials and other resources are outside `apply()`:** consumer credentials (`key-auth`, `basic-auth`, `hmac-auth`, `jwt`, `oauth2`, `oauth2_tokens`, `acls`), `keys`, `key-sets`, `sessions`, and `acme_storage` are not part of `ApplyConfig`. Manage them through the typed resource collections (for example `kong.consumers.keyAuth(consumer).create(...)` or `kong.keys`).
- **Sequential execution:** `apply()` sends requests one entity at a time in dependency order rather than concurrently, so ordering is deterministic and `KongApplyError.result` reflects the exact prefix of changes completed before a failure.

## Wiping a test gateway (`kong.deleteAll`)

> [!WARNING]
> `kong.deleteAll()` deletes **every entity** across all 20 first-class Kong resource collections regardless of tags. It is intended for **test setups and disposable environments only** — never run it against a shared or production gateway.

Because it is destructive, `deleteAll()` requires the literal confirmation `{ confirm: 'delete-everything' }` (enforced by TypeScript and checked at runtime, throwing `KongError` otherwise). It deletes children before parents, paging through every collection until empty (even past Kong's 100-item default page size):

1. `plugins`
2. `oauth2Tokens`
3. `routes`
4. `services`
5. `snis`
6. `upstreams` (Kong cascades deletion of each upstream's targets)
7. `acls`, `basicAuths`, `hmacAuths`, `jwts`, `keyAuths`, `oauth2`
8. `consumers`
9. `keys`
10. `keySets`
11. `certificates`
12. `caCertificates`
13. `vaults`
14. `sessions`
15. `acmeStorage`

It returns `{ deleted }`, a `Record<string, number>` mapping each of those 20 collection keys to the number of entities deleted:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const { deleted } = await kong.deleteAll({ confirm: 'delete-everything' });
console.log(deleted.services, deleted.routes, deleted.consumers);
```
