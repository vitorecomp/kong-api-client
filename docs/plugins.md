---
title: Plugins
group: Guides
---

# Plugins

Kong plugins add authentication, traffic control, logging, transformations, security, and AI gateway behaviour to services, routes, consumers, or the entire gateway. `kong-api-client` provides a typed plugin API built around `kong.plugins`, nested plugin collections, and compile-time configuration types for all 45 first-class Kong Gateway plugins.

## First-class plugins and custom plugins

Every open-source plugin bundled with Kong 3.9 (all 45 are also present on Kong Gateway 3.14) has:

- **Typed configuration (`ConfigOf<N>`):** passing a known plugin name literal to `enable()`, `create()`, `upsert()`, or `update()` narrows both the accepted `config` object and the returned `plugin.config` — catching unknown fields, missing required properties, and invalid enum values at compile time.
- **A generated reference page:** each plugin has a page under [All Plugins](./plugins/index.md) listing its supported scopes, protocols, targets, a working example, and every configuration field.
- **Live test coverage:** all 45 plugins are validated and round-tripped (`create`, `get`, `update`, `delete`, `find`) against both Kong 3.9 and Kong Gateway 3.14, and representative plugins are verified end-to-end through the proxy.

Any other plugin — custom Lua/Go/Python plugins, third-party plugins, or Enterprise-only plugins outside the 45 — works through the exact same methods; its `config` type simply falls back to `Record<string, unknown>`:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

// First-class plugin: `config` is checked as `HttpLogConfig`, and the return type is `Plugin<'http-log'>`
const logPlugin = await kong.plugins.enable('http-log', {
  on: { route: 'public-api' },
  config: {
    http_endpoint: 'https://logs.example.com/ingest',
    method: 'POST',
    timeout: 10_000,
  },
});
console.log(logPlugin.config.http_endpoint);

// Custom or unknown plugin: `config` is typed as `Record<string, unknown>`
const custom = await kong.plugins.enable('my-company-audit', {
  on: { service: 'orders' },
  config: {
    destination: 'audit.example.com',
    sample_rate: 0.25,
  },
});
console.log(custom.config.destination);
```

## Enabling plugins with `kong.plugins.enable()`

`kong.plugins.enable(name, options?)` is the recommended way to configure a plugin. It is safe to run repeatedly in startup scripts, CI jobs, or reconciliation loops:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const plugin = await kong.plugins.enable('rate-limiting', {
  on: { route: 'public-api' },
  config: {
    minute: 60,
    policy: 'local',
    hide_client_headers: false,
  },
  enabled: true,
  protocols: ['http', 'https'],
  tags: ['team:platform'],
});

console.log(plugin.id, plugin.instance_name);
// e.g. "<uuid>", "rate-limiting.route.public-api"
```

### Options

| Option         | Type                                    | Description                                                                                  |
| -------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `on`           | `PluginScope`                           | Scope (`{ service?, route?, consumer? }`) to attach the plugin to. Omit for a global plugin. |
| `config`       | `ConfigOf<N>`                           | Plugin configuration, typed from `name` when known or `Record<string, unknown>` otherwise.   |
| `instanceName` | `string`                                | Explicit Kong `instance_name`. Defaults to a name derived from `name` and `on`.              |
| `enabled`      | `boolean`                               | Whether the plugin is active.                                                                |
| `protocols`    | `NonNullable<PluginInput['protocols']>` | Protocols on which the plugin runs (for example `['http', 'https']`).                        |
| `tags`         | `string[]`                              | Tags attached to the plugin entity.                                                          |
| `signal`       | `AbortSignal`                           | Optional abort signal for the underlying HTTP requests.                                      |

### Idempotency and `PUT` semantics

Under the hood, `enable()` upserts the plugin by `instance_name` (`PUT /plugins/{instanceName}`). Calling `enable()` again with the same plugin name and scope (or the same `instanceName`) keeps the same plugin `id`, does not create duplicates, and updates the configuration in place.

Because `enable()` uses `PUT`, fields omitted from `config` or top-level options (`enabled`, `protocols`, `tags`) reset to Kong's defaults. If you want to change only one configuration field while leaving the rest untouched, use `update()` instead.

### Default `instance_name` and scoping by name or ID

When `instanceName` is omitted, `enable()` derives a deterministic `instance_name` by joining `name` and any scopes present in `on` with `.`, in the order `service`, `route`, `consumer`:

| Scope in `on`                              | Derived `instance_name`                       |
| ------------------------------------------ | --------------------------------------------- |
| omitted (global)                           | `correlation-id`                              |
| `{ route: 'public-api' }`                  | `correlation-id.route.public-api`             |
| `{ service: 'orders', consumer: 'alice' }` | `rate-limiting.service.orders.consumer.alice` |

Each field in `on` accepts either an entity's **UUID** or its secondary lookup key (`service` name, `route` name, `consumer` username). The library detects UUIDs automatically and sends `{ id }` for UUIDs or `{ name }` / `{ username }` otherwise:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const consumer = await kong.consumers.upsert('alice', { username: 'alice' });

// Scope by name / username
await kong.plugins.enable('rate-limiting', {
  on: { service: 'orders', consumer: 'alice' },
  config: { minute: 100, policy: 'local' },
});

// Scope by UUID
await kong.plugins.enable('response-transformer', {
  on: { consumer: consumer.id },
  config: { add: { headers: ['X-Tier:standard'] } },
});
```

### Adopting an existing plugin

Kong allows at most one instance of a given plugin name per exact scope (`service`, `route`, `consumer`, or global). Gateways that already have plugins created through Kong Manager, decK, or plain `create()` often have plugins with `instance_name: null`.

When `enable()` sends `PUT /plugins/{instanceName}` and Kong responds with `409 unique constraint violation` naming a conflicting scope (`name`, `service`, `route`, `consumer`), `enable()` automatically:

1. Finds the existing plugin on that exact scope via `kong.plugins.findOnScope()`.
2. Replaces it in place with `PUT /plugins/{existing.id}`, preserving its `id`, assigning the `instance_name`, and applying the new configuration.

This works for global plugins, single-entity scopes (`service`, `route`, `consumer`), and combined scopes (such as `service` + `consumer`).

### Reusing an explicit `instanceName` across scopes

`instance_name` is globally unique across all plugins on a Kong gateway:

- If you pass an explicit `instanceName` that already belongs to a plugin on Route A, and Route B does **not** yet have a plugin of that `name`, Kong's `PUT /plugins/{instanceName}` updates that named plugin in place and **moves it** to Route B.
- If Route B **already** has another plugin of that `name` (for example an unnamed plugin), `enable()` hits the scope conflict, tries to adopt Route B's plugin under the same `instanceName`, and Kong rejects with `409 unique constraint violation` (`fields: { instance_name }`), leaving both plugins untouched.

### Allowed characters in `instance_name`

Kong validates `instance_name` with its `utf8_name` rule on both Kong 3.9 and Kong Gateway 3.14:

- **Accepted:** ASCII alphanumerics (`A–Z`, `a–z`, `0–9`), `.`, `-`, `_`, `~`, and non-ASCII UTF-8 characters (such as `café`).
- **Rejected:** all other ASCII characters (spaces and punctuation such as `@`, `:`, `+`, `/`). Kong answers `400` (`invalid unique instance_name` on `PUT /plugins/{key}`, `schema violation` on `POST /schemas/plugins/validate`).

Because Kong allows characters like `+` and `@` in consumer usernames, `enable()` automatically replaces disallowed ASCII characters with `-` when deriving a default `instance_name` (so a consumer named `ops+alerts@example.com` produces `rate-limiting.consumer.ops-alerts-example.com`). Explicit `instanceName` values are sent unchanged so Kong validates them directly.

## Finding, nesting, and partially updating plugins

### Finding a plugin by exact scope (`findOnScope`)

Use `kong.plugins.findOnScope(name, scope, options?)` to look up an existing plugin by its `name` and exact resolved entity UUIDs (`PluginScopeIds`), without needing its `id` or `instance_name`:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const service = await kong.services.get('orders');
const consumer = await kong.consumers.get('alice');

// Exact match: scoped to both this service and this consumer, and NOT to any route
const scoped = await kong.plugins.findOnScope('rate-limiting', {
  service: service.id,
  consumer: consumer.id,
});

// Exact match for a global plugin (all scope IDs omitted or null)
const globalCorrelation = await kong.plugins.findOnScope('correlation-id', {});

console.log(scoped?.id, globalCorrelation?.id);
```

`findOnScope()` queries the narrowest nested collection (`route`, else `service`, else `consumer`, or `/plugins` across all pages for a global plugin) and checks all three scope axes (`service`, `route`, `consumer`) for an exact match. Pass resolved **UUIDs** (not names or usernames), because Kong returns plugin scope references as `{ id }`.

### Nested plugin collections

In addition to the top-level `kong.plugins`, every scopeable parent resource exposes a nested `PluginCollection`:

- `kong.services.plugins(service)` → `/services/{service}/plugins`
- `kong.routes.plugins(route)` → `/routes/{route}/plugins`
- `kong.consumers.plugins(consumer)` → `/consumers/{consumer}/plugins`

Nested plugin collections provide the same typed `create()`, `upsert()`, `update()`, `get()`, `find()`, `delete()`, `list()`, `iterate()`, and `all()` methods:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

// List every plugin attached to a specific route
const routePlugins = await kong.routes.plugins('public-api').all();
console.log(routePlugins.map((p) => p.name));

// Create a plugin directly under a service (service is supplied by the URL)
const created = await kong.services.plugins('orders').create({
  name: 'key-auth',
  config: {
    key_names: ['X-API-Key'],
    hide_credentials: true,
  },
});
console.log(created.id);
```

### Partial configuration updates with `update()` (`Patch`)

`update()` sends `PATCH` and accepts `Patch<PluginInput<N>>`, which makes nested record fields optional recursively while keeping arrays and maps whole — matching Kong's server-side merge behaviour:

- **Nested records merge field by field at any depth:** you can patch a single field (such as `timeout` or `queue.max_coalescing_delay` on `http-log`, or `model.options.temperature` on `ai-proxy`) without repeating required sibling fields like `http_endpoint` or `model.provider`.
- **Maps and arrays replace as a whole:** patching `config.headers` on `http-log` or `config.add.headers` on `request-transformer` replaces the entire map or array with the value you send.

Pass the plugin name either as a type parameter (`update<'http-log'>`) or in the patch body (`name: 'http-log'`) to get full type checking on `config` and a narrowed return type:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const existing = await kong.plugins.get('http-log.route.public-api');

// Update a single deeply nested record field; `http_endpoint` and other `queue` fields stay intact
const patched = await kong.plugins.update<'http-log'>(existing.id, {
  config: {
    timeout: 5000,
    queue: { max_coalescing_delay: 2 },
  },
});

console.log(patched.config.http_endpoint, patched.config.timeout);
```

## Runtime plugin metadata (`PLUGINS`)

`PLUGINS` is a generated constant keyed by every first-class `PluginName` with each plugin's `category`, `title`, `targets`, `scopes`, and `protocols`. Use it to check scope restrictions or target availability before sending requests:

```ts
import { PLUGINS } from 'kong-api-client';

// Check whether a plugin can be attached to a consumer
const keyAuthAllowsConsumer = PLUGINS['key-auth'].scopes.includes('consumer'); // false
const rateLimitAllowsConsumer = PLUGINS['rate-limiting'].scopes.includes('consumer'); // true
const acmeScopes = PLUGINS.acme.scopes; // ['global']

// Check which Kong targets ship a plugin
const aiProxyTargets = PLUGINS['ai-proxy'].targets; // ['kong-3.9', 'kong-gateway-3.14']

// Find all first-class plugins in a category
const authPlugins = Object.entries(PLUGINS)
  .filter(([, meta]) => meta.category === 'Authentication')
  .map(([name]) => name);

console.log({
  keyAuthAllowsConsumer,
  rateLimitAllowsConsumer,
  acmeScopes,
  aiProxyTargets,
  authPlugins,
});
```

## Runtime behaviour notes

Keep two Kong gateway behaviours in mind when activating plugins in automated workflows or tests:

- **Short delay before proxy enforcement:** Admin API writes (`enable()`, `create()`, `update()`, `delete()`) return as soon as the configuration is persisted, but Kong's proxy workers reload configuration asynchronously. Proxy requests sent immediately after `enable()` resolves can briefly run without the new plugin. When verifying plugin effects through the proxy, retry or poll briefly until workers pick up the change.
- **Route `protocols` default differs between Kong 3.9 and Kong Gateway 3.14:** creating a route without `protocols` defaults to `['http', 'https']` on Kong 3.9, but defaults to `['https']` on Kong Gateway 3.14 (where plain HTTP requests receive `426 Upgrade Required`). Pass `protocols: ['http', 'https']` explicitly when creating routes that need to serve plain HTTP on both targets.

## Reference pages by category

Browse the full table on [All Plugins](./plugins/index.md), or jump straight to a plugin reference page:

- **AI:** [AI Prompt Decorator](./plugins/ai/ai-prompt-decorator.md), [AI Prompt Guard](./plugins/ai/ai-prompt-guard.md), [AI Prompt Template](./plugins/ai/ai-prompt-template.md), [AI Proxy](./plugins/ai/ai-proxy.md), [AI Request Transformer](./plugins/ai/ai-request-transformer.md), [AI Response Transformer](./plugins/ai/ai-response-transformer.md)
- **Analytics & Monitoring:** [Datadog](./plugins/analytics-monitoring/datadog.md), [OpenTelemetry](./plugins/analytics-monitoring/opentelemetry.md), [Prometheus](./plugins/analytics-monitoring/prometheus.md), [StatsD](./plugins/analytics-monitoring/statsd.md), [Zipkin](./plugins/analytics-monitoring/zipkin.md)
- **Authentication:** [Basic Auth](./plugins/authentication/basic-auth.md), [HMAC Auth](./plugins/authentication/hmac-auth.md), [JWT](./plugins/authentication/jwt.md), [Key Auth](./plugins/authentication/key-auth.md), [LDAP Authentication](./plugins/authentication/ldap-auth.md), [OAuth 2.0 Authentication](./plugins/authentication/oauth2.md), [Session](./plugins/authentication/session.md)
- **Logging:** [File Log](./plugins/logging/file-log.md), [HTTP Log](./plugins/logging/http-log.md), [Loggly](./plugins/logging/loggly.md), [Syslog](./plugins/logging/syslog.md), [TCP Log](./plugins/logging/tcp-log.md), [UDP Log](./plugins/logging/udp-log.md)
- **Security:** [ACME](./plugins/security/acme.md), [Bot Detection](./plugins/security/bot-detection.md), [CORS](./plugins/security/cors.md), [IP Restriction](./plugins/security/ip-restriction.md)
- **Serverless:** [AWS Lambda](./plugins/serverless/aws-lambda.md), [Azure Functions](./plugins/serverless/azure-functions.md), [Post-Function](./plugins/serverless/post-function.md), [Pre-Function](./plugins/serverless/pre-function.md)
- **Traffic Control:** [ACL](./plugins/traffic-control/acl.md), [Proxy Cache](./plugins/traffic-control/proxy-cache.md), [Rate Limiting](./plugins/traffic-control/rate-limiting.md), [Redirect](./plugins/traffic-control/redirect.md), [Request Size Limiting](./plugins/traffic-control/request-size-limiting.md), [Request Termination](./plugins/traffic-control/request-termination.md), [Response Rate Limiting](./plugins/traffic-control/response-ratelimiting.md), [Standard Webhooks](./plugins/traffic-control/standard-webhooks.md)
- **Transformations:** [Correlation ID](./plugins/transformations/correlation-id.md), [gRPC-Gateway](./plugins/transformations/grpc-gateway.md), [gRPC-Web](./plugins/transformations/grpc-web.md), [Request Transformer](./plugins/transformations/request-transformer.md), [Response Transformer](./plugins/transformations/response-transformer.md)
