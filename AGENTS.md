# Project

<!-- TODO: describe what this project is about. Empty for now. -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Project structure & where to put what

Turborepo monorepo. Rule of thumb: **apps compose, packages own logic, features slice vertically.**

- `apps/web` — Next.js app. Routing/layout/global CSS in `src/app`; domain code in
  `src/features/<name>`; tRPC provider and client config in `src/lib/trpc`.
- `apps/api` — Hono server. Hono app/adapters in `src/`, plain HTTP routes in
  `src/routes`.
- `packages/db` — Drizzle schema, `db()` singleton and repositories (the only place
  that speaks Drizzle).
- `packages/trpc` — shared types + feature slices: `src/server/features/<name>/`
  holds `<name>.schema.ts` (Zod), `<name>.controller.ts` (business logic) and
  `<name>.router.ts` (thin procedures). Register routers in `src/server/router.ts`.
- `packages/ui` — shared UI: shadcn/ui primitives in `src/components`, `cn()` in
  `src/lib`, and design tokens in `src/styles/globals.css`. Import with
  `@repo/ui/components/<name>`; add components with the shadcn CLI from `apps/web`.

See `docs/architecture.md` for the full request flow and package responsibilities.

---

## Ultracite & Biome

This project uses **Ultracite**, a zero-config preset enforcing strict code quality
via **Biome**. Run these before committing:

- Format/fix: `bun x ultracite fix`
- Check: `bun x ultracite check`
- Diagnose: `bun x ultracite doctor`
- Full workspace gates: `bun run check` (lint, typecheck, test, build)

Config lives in `biome.jsonc` (extends Ultracite `core`, `type-aware`, `next`,
`react`). Documented overrides are described in `docs/architecture.md` > Quality
gates.

---

## Fallow

Fallow is the dead-code / maintainability audit. It traces imports from the entry
points configured in `fallow.toml` (web app, API and package indexes) and flags
unreachable code and duplicated logic.

- Audit: `bun run fallow`
- Dry-run fixes: `bun run fallow:fix` (or `bunx fallow fix --dry-run`)
- CI gate: `.github/workflows/ci.yml` runs `bunx fallow audit --quiet` after the
  `check` gates; a failure blocks the pipeline.

Run the audit after any significant refactor or before opening a PR. If it flags
a legitimately public entry (e.g. a barrel that is a package's API surface),
adjust `fallow.toml` — do not silence it ad hoc. Fallow's cache lives in
`.fallow/` (gitignored).

---

## Rules for task execution

The project is structured in a way to promote parallelism. All of our team members intend to ship features simultaneously. Look into `docs/roadmap.md` for the list of features to be implemented.
Anytime I tell you to start working on a feature, start working on that feature alone. Try to refrain from changing files outside your feature scope unless you have to. After a feature has been completed
thoroughly test it with the tools available like ultracite, biome and fallow. For business logic write unit tests if necessary. Do not do premature testing, we don't have much time for too much testing. Always start testing after a feature has been implemented completely, not before.

If the feature works, commit it to git. Notice if it passes the precommit checks. Do what you are told to do at that instance, do not assume more work.

---

## Conventions — read these when

| Read                              | When you are                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `docs/karpathy-guidelines.md`     | Use when writing, reviewing, or refactoring code to avoid overcomplication         |
| `docs/roadmap.md`                 | Use when you want to get an idea about where we are in the project currently       |
| `docs/architecture.md`            | Adding a package, changing request flow, or wondering where code belongs.          |
| `docs/typescript-conventions.md`  | Writing any TypeScript: types, unions, narrowing, error handling.                  |
| `docs/frontend-conventions.md`    | When doing frontend design work                                                    |
| `docs/design-system.md`           | When you need to refer to the design language                                      |
| `docs/api-conventions.md`         | Adding/changing API routes, controllers, repositories, or response envelopes.      |
| `docs/nextjs-conventions.md`      | Building UI in `apps/web`: server vs client components, data fetching, routing.    |
| `docs/db-conventions.md`          | Working on the Drizzle schema, repositories, or migrations.                        |
| `docs/trpc-conventions.md`        | Adding/changing tRPC procedures, controllers, or feature slices.                   |
| `docs/css-conventions.md`         | Styling components, layout, accessibility, or motion.                              |
| `docs/testing.md`                 | Writing tests or deciding what/ how much to test.                                  |
| `docs/env-conventions.md`         | Adding/changing environment variables, `.env` files, or deployment config.         |

If a convention is not covered by a doc above, follow the patterns of nearby code.

DO NOT CHANGE THE DOCS.

You may write the roadmap.md and design-system.md. Not any other doc.
