# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0-rc.1] - Unreleased

### Added

- Complete TypeScript rewrite targeting **Node.js 22.12+** with native `fetch` and zero runtime dependencies (ESM package, also loadable via CommonJS `require()` on Node 22.12+), verified live against **Kong 3.9** (OSS) and **Kong Gateway 3.14** (unlicensed).
- Typed `Kong` client and `Transport` supporting `adminUrl` path prefixes, static or async `headers` factories, configurable `timeoutMs`, custom `fetch`, URL path-segment encoding (`segment()`), and `AbortSignal` cancellation.
- Generated entity and resource clients for all 20 first-class top-level Admin API resources (`services`, `routes`, `consumers`, `plugins`, `upstreams`, `certificates`, `snis`, `caCertificates`, `vaults`, `keys`, `keySets`, `acls`, `basicAuths`, `hmacAuths`, `jwts`, `keyAuths`, `oauth2`, `oauth2Tokens`, `sessions`, `acmeStorage`), nested collections (including `upstreams.targets`), and related singletons — covering 125 of 141 recorded Admin API endpoints through 308 typed operations.
- Recursive `Patch<T>` typing for `update()` (`PATCH`), matching Kong's semantics: nested records merge field by field at any depth while arrays and maps are replaced as a whole.
- Non-resource Admin API namespaces: `kong.node` (including `dnsStatus`), `kong.schemas`, `kong.tags`, `kong.cache`, `kong.config` (DB-less), `kong.debug`, `kong.clustering` (hybrid Control Plane), `kong.acme`, `kong.proxyCache`, plus `kong.upstreams` health/target history/manual health helpers and `kong.plugins` `enabledNames()` and legacy `schema()`.
- Generated config interfaces and `PLUGINS` runtime metadata for all 45 open-source Kong plugins, `PluginCollection` typing `config` from the plugin `name`, idempotent `kong.plugins.enable()` with automatic scope adoption, and `kong.plugins.findOnScope()`.
- Declarative `kong.apply(config, options?)` reconciling 10 resource types in dependency order with field/set/map/URL/target-address diffing, plugin adoption, `dryRun`, tag-scoped `prune`, and `KongApplyError` partial results, plus `kong.deleteAll({ confirm: 'delete-everything' })` for wiping test gateways in reverse dependency order.
- AI Gateway helpers (`kong.ai`): single-call `llmRoute()` plus typed helpers for `ai-proxy`, `ai-prompt-guard`, `ai-prompt-decorator`, `ai-prompt-template`, `ai-request-transformer`, and `ai-response-transformer`.
- Full cursor pagination (`list`, `iterate`, `all`) and `TagFilter` support (`string`, `string[]` / `{ all }`, `{ any }`).
- Structured error hierarchy: `KongError`, `KongHttpError` (with `status`, `method`, `path`, `code`, `kongName`, `fields`, `body`), `KongConnectionError`, `KongTimeoutError`, and `KongApplyError` (`failed`, `result`, `cause`).
- Escape hatch `kong.request()` for calling any Admin API endpoint directly.
- TypeDoc documentation site with hand-written guides (Getting Started, Resources, Plugins, Admin Endpoints, Declarative Apply, AI Gateway, Error Handling, Migration from 2.x), generated Endpoint Coverage matrix, 45 categorized plugin reference pages, API reference, and compile-checked documentation examples.
- Automated package tarball verification (`npm run test:package`) testing packed contents, isolated install, and ESM/CommonJS runtime and type-checking.

### Changed

- Replaced the 2.x default export and flat `add*`/`find*`/`update*`/`delete*` methods with named exports and resource collections (`kong.services`, `kong.routes`, `kong.consumers`, `kong.plugins`, etc.). See `docs/migration.md`.
- Replaced `kong.init()` and `kong.clean()` with `kong.apply(config, options?)` and `kong.deleteAll({ confirm: 'delete-everything' })`.
- Removed client-side entity validation in favour of forwarding payloads to Kong and surfacing Kong's structured errors.

### Fixed

- Updates now send patched fields to Kong via `PATCH`.
- Listing collections via `iterate()` and `all()` now traverses all pages past Kong's 100-item default page size.
- Re-applying an identical declarative configuration via `kong.apply()` is idempotent with zero write requests instead of failing with `409 Conflict` as 2.x `init()` did.
- Returned entities are no longer mutated with a `kongUrl` property.
- Deletion by key works without throwing internal lookup errors.
- Missing or invalid `adminUrl` throws `KongError` consistently.

### Removed

- Removed `axios`, `validator`, Babel, Jest, and the 2.x wrapper classes (`Service`, `Route`, `Consumer`, `Plugin`).
