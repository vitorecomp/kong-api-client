# Contributing to `kong-api-client`

Thank you for contributing to `kong-api-client`.

## Setup

Requirements:

- **Node.js 22.12** or later
- **Podman** or **Docker** (only needed for live tests and schema recording)

Install dependencies:

```bash
npm ci
```

## Checks and build

Run the full offline verification suite before committing:

```bash
npm run check
npm run build
```

`npm run check` runs:

1. `npm run typecheck` — `tsc --noEmit` over `src/`, `test/`, and config files
2. `npm run lint` — ESLint (type-checked rules; `any`, floating promises, and misused promises are errors)
3. `npm run format:check` — Prettier check (`npm run format` formats files)
4. `npm run generate:check` — verifies committed generated files match `scripts/generate.mjs`
5. `npm test` — Vitest `unit` and `contract` projects with coverage thresholds

To verify the built npm tarball as an external consumer (packs the tarball, validates contents and manifest entrypoints, installs into an empty temporary project, and runs ESM + CommonJS runtime and `skipLibCheck=false` type-checks):

```bash
npm run test:package
```

To build and verify the documentation site locally:

```bash
npm run docs
npm run docs:check
```

## Live tests and the container engine

Live tests run against real Kong Gateway containers (Postgres + Kong + DB-less Kong + fake upstream) managed by `scripts/kong.sh`:

```bash
npm run test:live -- oss-3.9
npm run test:live -- ee-3.14
```

`npm run test:live` runs two Vitest projects sequentially:

1. **`live`** (`test/live/**`): non-destructive resource, special-endpoint, plugin, AI, and declarative `apply` tests (with strict coverage verification across all 308 operations when run without path filters).
2. **`live-destructive`** (`test/live-destructive/**`): tests `kong.deleteAll({ confirm: 'delete-everything' })` and **wipes every entity on the test gateway**. `scripts/test-live.sh` always finishes `live` before starting `live-destructive` (even when paths from both directories are passed on the CLI). Never run `live-destructive` against a shared or production Kong instance.

You can pass specific test files after the target:

```bash
npm run test:live -- oss-3.9 test/live/resources/services.test.ts
npm run test:live -- oss-3.9 test/live-destructive/delete-all.test.ts
```

Useful environment variables:

- `CONTAINER_ENGINE`: set to `podman` or `docker` (auto-detected if omitted: prefers `podman`, falls back to `docker`).
- `KONG_TEST_PORT_OFFSET`: numeric offset added to all published `127.0.0.1` test ports (default `0`). Useful when running multiple suites in parallel.
- `KEEP=1`: keep containers running after `npm run test:live` exits for interactive debugging. Stop them afterwards with `scripts/kong.sh down <target>`.

Containers and networks created by `scripts/kong.sh` are named with the `kac-<target>-<offset>` prefix; `scripts/kong.sh down <target>` removes only those resources.

## Recording schemas and regenerating code

Generated TypeScript files under `src/generated/`, plugin reference pages under `docs/plugins/`, `docs/endpoints.md`, and `test/support/endpoint-calls.ts` are committed and must never be edited by hand.

To refresh recorded schemas from running test targets:

```bash
scripts/kong.sh up oss-3.9
eval "$(scripts/kong.sh env oss-3.9)"
npm run record -- --admin-url "$KONG_ADMIN_URL" --target kong-3.9
scripts/kong.sh down oss-3.9

scripts/kong.sh up ee-3.14
eval "$(scripts/kong.sh env ee-3.14)"
npm run record -- --admin-url "$KONG_ADMIN_URL" --target kong-gateway-3.14 --structure-only --only-from schemas/kong-3.9
scripts/kong.sh down ee-3.14
```

Then regenerate and verify:

```bash
npm run generate
npm run check
```

Keep `schemas/kong-gateway-3.14/` structure-only (no prose descriptions copied from the Gateway image) and preserve `NOTICE` and `LICENSES/Apache-2.0.txt` for the Kong 3.9 open-source recordings.

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/) with small, focused commits (one logical change per commit):

- `feat:` — new library capability
- `fix:` — bug fix
- `test:` — tests and test harness changes
- `docs:` — documentation, guides, and README changes
- `build:` / `ci:` / `chore:` — tooling, workflows, and maintenance

## Cutting a release

1. Update the version in `package.json`, `src/index.ts` (`VERSION`), and `CHANGELOG.md`.
2. Run `npm run check`, `npm run build`, `npm run test:package`, `npm run docs`, `npm run docs:check`, and `npm run test:live` against both `oss-3.9` and `ee-3.14`.
3. Commit the release preparation, push to `master`, create an annotated tag `v<version>` matching `package.json`, and publish a GitHub Release for that tag.
4. `.github/workflows/publish.yml` verifies that the tag matches `package.json`, runs `npm run check` and `npm run build`, and publishes to npm with `--provenance --access public` (using the `next` dist-tag for pre-release versions such as `3.0.0-rc.1`).
