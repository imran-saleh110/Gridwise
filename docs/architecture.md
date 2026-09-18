# Architecture

This repo is a Turborepo monorepo with two apps and three shared packages. The
rule of thumb: **apps compose, packages own logic, features slice vertically.**

## Adding a feature

1. Define/extend tables in `packages/db/src/schema.ts` and push or migrate.
2. Add a repository in `packages/db/src/repositories/`.
3. Add a Zod schema + controller + router under
   `packages/trpc/src/server/features/<name>` and mount it in `router.ts`.
4. Build the UI under `apps/web/src/features/<name>` using the tRPC client.
5. Add tests next to the code (`bun test`) and run `bun run check`.

See `docs/architecture.md` for the full request flow and conventions.


## Request flow

A single click travels through every layer:

```
React component (apps/web/src/features/<name>)
  -> trpc.<router>.<procedure>            @repo/trpc client + TanStack Query
    -> POST /trpc/<router>.<procedure>    apps/api (Hono + @hono/trpc-server)
      -> procedure                         packages/trpc/.../<name>.router.ts
        -> controller                      packages/trpc/.../<name>.controller.ts
          -> repository                    packages/db/src/repositories
            -> Drizzle -> Neon Postgres
```

Responses are serialized with superjson, so `Date` and other rich values survive
the trip. The client and server share the same `AppRouter` type; there is no
hand-written API contract to keep in sync.

For plain HTTP (health checks, webhooks, file streaming) Hono routes live in
`apps/api/src/routes` and answer with the `{ data, meta }` / `{ error }`
envelopes described in `docs/api-conventions.md`.

## Packages

### `@repo/db`

- `src/schema.ts` — Drizzle tables, the single source of truth for the DB.
- `src/index.ts` — lazy `db()` singleton over `drizzle-orm/neon-http`. It reads
  `DATABASE_URL` on first use (`src/env.ts`) so importing the package never
  requires a connection.
- `src/repositories/` — the only place that speaks Drizzle. Classes are private;
  a singleton instance is exported per repository.
- `drizzle.config.ts` — reads the root `.env` for `drizzle-kit` commands.

### `@repo/trpc`

- `src/server/trpc.ts` — `initTRPC` with the superjson transformer, the shared
  `router` and `publicProcedure`. Add auth/rate-limit middleware here later.
- `src/server/context.ts` — the per-request `Context` (`requestId` today).
- `src/server/features/<name>/` — the feature slice:
  - `<name>.schema.ts` — Zod input/output schemas.
  - `<name>.controller.ts` — business logic, calls repositories.
  - `<name>.router.ts` — thin tRPC procedures that validate and delegate.
- `src/server/router.ts` — mounts every feature router under `appRouter`.
- `src/client.ts` / `src/server-client.ts` — tRPC React and server-side clients.

The package has two entry points: `@repo/trpc` (client) and `@repo/trpc/server`
(server), so the browser bundle never pulls in the router.

### `@repo/ui`

- `src/components/` — vendored shadcn/ui primitives (Base UI + Tailwind v4),
  imported as `@repo/ui/components/<name>`.
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge), imported as
  `@repo/ui/lib/utils`.
- `src/styles/globals.css` — the design tokens (the source of truth). Apps
  import it once from their global CSS and add a `@source` for this package.
- `components.json` — shadcn CLI config; apps also have one so the CLI routes
  generated files here. See `docs/design-system.md` for tokens and workflow.

### `apps/api`

- `src/app.ts` — builds the Hono app: `/health` routes, the tRPC mount at
  `/trpc/*`, plus `notFound`/`onError` handlers that emit the error envelope.
  Tests import this directly and call `app.request(...)`.
- `src/index.ts` — Bun entry (`export default { port, fetch }`) for local/runtime.
- `vercel/api/[[...route]]/route.ts` — `hono/vercel` adapter for deployment.

### `apps/web`

- `src/app` — routing, layout, global CSS and error boundaries only.
- `src/features/<name>` — components, hooks and styles for one domain.
- `src/lib/trpc` — provider, query client, client/server tRPC instances and the
  `NEXT_PUBLIC_API_URL` config. Components are client components only where they
  need interactivity.

## Database workflow

`packages/db/src/schema.ts` is the single source of truth. For quick dev
iterations use `bun run db:push`; for anything that ships, run
`bun run db:generate` and commit the SQL under `packages/db/drizzle`, then
`bun run db:migrate`.

Repositories (`packages/db/src/repositories`) are the only place that touches
Drizzle. Controllers in `@repo/trpc` call repositories; routers expose
procedures; the web app only ever calls tRPC.

## Conventions

- `docs/typescript-conventions.md` — strict types, `interface` for object shapes,
  explicit extensions on relative imports.
- `docs/api-conventions.md` — controller/repository split and response envelopes.
- `docs/nextjs-conventions.md` — server-first components and feature folders.
- `docs/css-conventions.md` — plain CSS, low-specificity class names.
- `docs/testing.md` — `bun test`, Hono `app.request()`, `renderToStaticMarkup`.

## Quality gates

`bun run check` runs lint, typecheck, test and build across the workspace in
dependency order; CI runs the same command plus `fallow audit`.

Biome config (`biome.jsonc`) extends the Ultracite `core`, `type-aware`, `next`
and `react` presets, with three documented overrides:

- `noUnresolvedImports` is off repo-wide. The type-aware resolver cannot read
  packages out of Bun's isolated per-workspace `node_modules`, producing false
  positives; `tsc` (which runs in `check`) is the authority for import validity.
- `noBarrelFile` is off for the package entry points (`@repo/trpc`,
  `@repo/trpc/server`, `@repo/db/repositories`) — those barrels *are* the public
  API surface.
- Selected `a11y`/`suspicious` rules are off under
  `packages/ui/src/components/**` (`noLabelWithoutControl`,
  `useSemanticElements`, `noArrayIndexKey`, `noDoubleEquals`, `noLeakedRender`,
  `noUnnecessaryConditions`). These are vendored shadcn primitives whose
  canonical patterns trip conservative rules; keeping them untouched means
  `shadcn add` stays idempotent. Re-evaluate after a shadcn upgrade.

Fallow is configured in `fallow.toml`; `fallow audit --quiet` fails CI on dead
code or unmaintainable files.

