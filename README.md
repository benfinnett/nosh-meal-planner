# Nosh

[![CI status](https://github.com/benfinnett/nosh-meal-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/benfinnett/nosh-meal-planner/actions/workflows/ci.yml)

## Run the demo with Docker

Install Docker Desktop/Engine with Compose and start its Linux engine. From this repository:

```sh
docker compose up --build -d
```

Open http://localhost:8080. The initial build needs internet access; fonts, icons, and the app run locally afterwards. The API is accessible through the same-origin `/api` proxy. Production deliberately omits development diagnostics and Swagger. Readiness is at `/api/health/ready`.

```sh
docker compose logs api
docker compose down
```

Normal shutdown retains the `nosh-data` volume. Do not use `down -v` unless you explicitly intend to discard its data. The API migrates and seeds before accepting traffic; failure stops startup with a useful log. Existing seed IDs are preserved rather than overwritten.

## Develop locally

Use Node 24 LTS (Node 26 also supported by the selected SQLite prebuild) and pnpm 11.19.0. Enable Corepack if available, or install that pnpm version through your Node package manager. Windows, macOS, and Linux can run the workspace; browser verification here targets Chromium.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:5173. The web server proxies `/api` to port 3001. API and web source changes reload automatically; the contracts package resolves to TypeScript sources in development. SQLite is at `apps/api/data/nosh.sqlite` by default because workspace scripts run from the API package.

The development-only http://localhost:5173/dev/status screen reads the real recipe count from SQLite; http://localhost:5173/api/docs exposes generated OpenAPI. Environment defaults work without a file. `.env.example` documents overrides: export variables in the shell; automatic `.env` loading is not implemented. `DATABASE_PATH` is resolved relative to the API process working directory. `HOST` defaults to loopback locally; Docker sets it to `0.0.0.0`.

For containerized hot reload without a local Node installation:

```sh
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
```

Open http://localhost:8080, including `/dev/status`. Source/public files are mounted; dependencies live in the image, not host `node_modules`. Rebuild after dependency/configuration changes. Use the same `-f` arguments for shutdown. Stop one Compose mode before switching to the other.

## Verify

```sh
pnpm build
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

Playwright starts development servers automatically when needed and tests laptop/mobile viewports. Screenshots and failure traces go into `test-results`. API tests use temporary or in-memory databases. `pnpm format` applies formatting. CI repeats these checks on Node 24; GitHub execution requires a configured remote and pushed repository.

## Storage and resets

`pnpm db:seed` reruns the validated idempotent seed.

For an explicit local fresh demo, **stop the API first**, then run `pnpm db:reset`. It checkpoints and renames the existing SQLite file to a timestamped backup and creates a new seeded database. This resets all application data in that file; the backup remains recoverable. To recover, stop the API and restore the backup as the configured database file. Never reset a running database. For a container demo use a new Compose project/volume or back up the stopped volume before an intentional reset.

For schema changes, see [Database Migrations](docs/DATABASE-MIGRATIONS.md) for generating and applying SQL migrations.

## Architecture

```text
apps/web             React/Vite, Tailwind, Base UI/CVA button, Tabler
packages/contracts   Shared Zod DTOs (no application or database dependencies)
apps/api             Fastify app factory and HTTP server, Drizzle/SQLite adapter
apps/api/migrations  Versioned SQL, tracked atomically in SQLite
```

Only the API accesses storage. Web and API share public contracts, not database rows. Pure domain functions will sit inside API feature modules in Horizon 2. Production contracts compile to JavaScript; development uses source exports for hot reload. ESLint prevents cross-layer imports. Detailed alternatives and rationale live in [SPECIFICATION.md](SPECIFICATION.md).

Native SQLite compatibility is a deliberate pin: `better-sqlite3` 13 required a C++ toolchain on this Windows machine; 12.11.1 installed its prebuilt binary successfully. Docker includes build tools as a fallback. TypeScript 5.9 and ESLint 9 are conservative compatibility pins for the chosen tooling; review upgrades deliberately. Fresh installs on platforms lacking a prebuild may need Python and a C++ compiler.

## Delivery notes

- [Development style guide](docs/STYLE-GUIDE.md)

## Troubleshooting

If ports 5173/3001/8080 are already occupied, stop the conflicting process or adjust the corresponding Vite/API/Compose settings together. If a native-module ABI error appears after changing Node versions, reinstall/rebuild dependencies under the selected Node version. If Docker cannot connect, check that the Linux engine is running.
