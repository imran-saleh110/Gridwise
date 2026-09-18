# DB conventions

The database is **codebase-first**: `packages/db/src/schema.ts` (or the Drizzle
model files it re-exports) is the single source of truth. Never edit the database
schema directly — change the TypeScript schema and let `drizzle-kit` produce the
delta.

## Schema

- Declare tables with the `pgTable("snake_case_table", { ... })` builder from
  `drizzle-orm/pg-core`; the table name is always the plural `snake_case` form
  (e.g. `health_checks`).
- Use camelCase for the TypeScript column key and pass the explicit snake_case
  DB name as the first argument (`createdAt: timestamp("created_at")`). Do not
  rely on auto-mapping unless everything in the table is consistently snake_case.
- Use `uuid("id").primaryKey().defaultRandom()` for primary keys — generated
  client-side, no serial dependency.
- Use `timestamp("...", { withTimezone: true })` for all timestamps and
  `.defaultNow()` for creation time.
- Prefer `varchar(name, { length })` with a bound length over unbounded `text`;
  use `text` only for genuinely unbounded content.
- Model booleans as real booleans, not `"y"`/`"n"`. (Ultracite's
  `noBooleanLiteralCompare` style applies to code, but the DB should be explicit
  too — name boolean columns `is_`, `has_`, `can_`.)
- Add `relations()` only where you actually query across tables; keep them next
  to the tables they describe.
- Export every model so `drizzle-kit` can import it during the diff. Also export
  inferred types with `$inferSelect` / `$inferInsert` — do **not** hand-write
  interfaces that mirror the tables:

```ts
export type HealthCheckRecord = typeof healthChecks.$inferSelect;
export type NewHealthCheck = typeof healthChecks.$inferInsert;
```

- Keep the schema in a small number of files. Split per domain
  (`user.ts`, `post.ts`) only when a table would otherwise dominate a single
  file. `src/schema.ts` re-exports them.

## Repositories

- `src/repositories/` is the **only** place that imports from the `db()` singleton
  and speaks Drizzle.
- One file per table/domain, named `<plural>.repository.ts`
  (`health-checks.repository.ts`).
- Expose a **private class** plus a **singleton instance** — never export the
  class constructor, so callers can't instantiate or mock it ad hoc:

```ts
class HealthChecksRepository {
  // ...
}
export const healthChecksRepository = new HealthChecksRepository();
```

- Repositories return lean data (rows, counts, shapes the controller wants) —
  they do not return Drizzle query promises to be awaited later.
- Prefer the Drizzle query builder over raw SQL strings. Raw SQL is acceptable
  only for genuinely uncased queries; keep it in the query builder API otherwise.
- Use prepared statements via `db.query.<table>.findMany().prepare()` for
  hot-path queries. For `neon-http`, batch unrelated reads with `Promise.all` at
  the controller/service layer so they hit the network concurrently.
- Use the `@neondatabase/serverless` HTTP client (`neon()`) with the **pooled**
  connection string (`-pooler`). Reuse the `db()` singleton — it caches the
  client per process (`src/index.ts`).
- Validate `DATABASE_URL` once with the Zod schema in `src/env.ts`; read it via
  `getDbEnv()` inside `createClient()`, so importing `@repo/db` never requires a
  connection.

## Migrations

- Quick dev iterations: `bun run db:push`. Treat it as ephemeral — it does not
  produce reviewable SQL.
- Anything that ships: `bun run db:generate`, **commit** the generated SQL under
  `packages/db/drizzle`, then `bun run db:migrate`. Never hand-write migration
  SQL and never commit `db:push` state as a replacement for migrations.
- `db:generate` / `db:migrate` / `db:push` / `db:studio` read the **root** `.env`
  via `drizzle.config.ts` (`dotenv.config({ path: "../../.env" })`) — see
  `docs/env-conventions.md`.
- Never edit an already-applied migration. Generate a new one instead. If you
  hand-fix a generated migration in a PR, say so in the PR body.
- Migrations are versioned SQL text, so they should be reviewed like code: one
  migration per logical change, no combined unrelated schema edits.