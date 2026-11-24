# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0-rc.1] - Unreleased

### Added

- Complete TypeScript rewrite targeting Node.js 22.12+ with native `fetch` and zero runtime dependencies (ESM package, also loadable via CommonJS `require()` on Node 22.12+).
- Typed `Kong` client and `Transport` supporting `adminUrl` path prefixes, static or async `headers` factories, configurable `timeoutMs`, custom `fetch`, and `AbortSignal` cancellation.
- Generated entity and resource clients for Kong's first-class Admin API resources (`services`, `routes`, `consumers`, `plugins`, `upstreams`, `targets`, `certificates`, `snis`, `caCertificates`, `vaults`, `keys`, `keySets`, `acls`, `basicAuths`, `hmacAuths`, `jwts`, `keyAuths`, `oauth2`, `oauth2Tokens`, `sessions`, `acmeStorage`), including nested collections and singletons.
- Generated config interfaces and metadata (`PLUGINS`) for all 45 open-source Kong plugins, with `PluginCollection` typing `config` from the plugin `name`.
- Full cursor pagination (`list`, `iterate`, `all`) and `TagFilter` support (`string`, `string[]` / `{ all }`, `{ any }`).
- Structured error hierarchy: `KongError`, `KongHttpError` (with `status`, `method`, `path`, `code`, `kongName`, `fields`, `body`), `KongConnectionError`, and `KongTimeoutError`.
- Escape hatch `kong.request()` for calling any Admin API endpoint directly.
- TypeDoc documentation site with guides, API reference, and generated plugin reference pages, verified against Kong 3.9 (OSS) and Kong Gateway 3.14 (unlicensed).

### Changed

- Replaced the 2.x default export and flat `add*`/`find*`/`update*`/`delete*` methods with named exports and resource collections (`kong.services`, `kong.routes`, `kong.consumers`, `kong.plugins`, etc.). See `docs/migration.md`.
- Removed client-side entity validation in favour of forwarding payloads to Kong and surfacing Kong's structured errors.

### Fixed

- Updates now send patched fields to Kong via `PATCH`.
- Listing collections via `iterate()` and `all()` now traverses all pages past Kong's 100-item default page size.
- Returned entities are no longer mutated with a `kongUrl` property.
- Deletion by key works without throwing internal lookup errors.
- Missing or invalid `adminUrl` throws `KongError` consistently.

### Removed

- Removed `axios`, `validator`, Babel, Jest, and the 2.x wrapper classes (`Service`, `Route`, `Consumer`, `Plugin`).
