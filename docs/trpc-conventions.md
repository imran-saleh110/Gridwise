# tRPC conventions

`@repo/trpc` is the shared RPC layer: **apps compose, packages own logic** (see
`docs/architecture.md`). It has two entry points so the browser never pulls in
the router: `@repo/trpc` (client) and `@repo/trpc/server` (server). Types are a
type-only import on the client — the `AppRouter` is shared, there is no
hand-written API contract to keep in sync.

## Feature slice

New domain logic lives as a vertical slice under
`packages/trpc/src/server/features/<name>/` with three files (copy the `health`
slice as the template):

```
<name>.schema.ts    Zod input/output schemas + inferred input types
<name>.controller.ts  business logic; calls repositories, returns plain data
<name>.router.ts    thin procedures that validate and delegate
```

- **`<name>.schema.ts`** — define every input schema here. Export
  `z.infer<typeof schema>` input types for the controller to import, so the
  controller never re-declares shapes. Export schemas from `src/index.ts` so
  shared client/server validation is possible.
- **`<name>.controller.ts`** — pure business logic. Depends on repositories from
  `@repo/db/repositories`, never on tRPC or Hono. Return plain, serializable
  values. Group related operations in a single exported `controller` object.
- **`<name>.router.ts`** — one exported `router({ ... })`. Procedures must be
  **thin**: `.input(<zodSchema>)` then a one-line delegate to the controller.
  No inline SQL, no ad-hoc validation, no business rules in the router.
- Mount the router in `packages/trpc/src/server/router.ts` under a short
  namespace key (`health: healthRouter`). Callers then use
  `trpc.<name>.<procedure>`.

## Procedures

- Prefer `query` for reads, `mutation` for anything that writes or has side
  effects. There is no internal difference beyond semantics — use the semantics.
- Name procedures with a lowercase verb: `ping`, `history`, `create`, `byId`.
  Avoid HTTP-ism (`getHealth`, `postX`) — this is an RPC, not REST.
- Always validate input with a Zod schema via `.input()`. Never trust raw
  params; enforce bounds in the schema (`z.number().int().min(1).max(100)`) so
  controllers receive already-valid input.
- Keep procedures serializable: superjson (`src/transformer.ts`) preserves
  `Date`, `Map`, `Set`, etc., but avoid returning classes, functions, or
  undefined-heavy objects.
- Return shaped output for the client. It is fine to return the controller's
  result as-is when that shape is already intentional.

## Server plumbing

- `src/server/trpc.ts` — `initTRPC` runs **once** here. Export `router` and
  `publicProcedure` and nothing else. Add auth/rate-limit **middleware** and
  protected procedures in this file, not per-router.
- `src/server/context.ts` — the per-request `Context` interface. Extend it when
  a procedure needs request data (user, headers); derive it in
  `apps/api/src/app.ts` where the Hono request is available.
- `src/server/router.ts` — aggregate of feature routers plus the exported
  `AppRouter` type.

## Clients

- Browser: `src/client.ts` exposes `trpc` via `createTRPCReact<AppRouter>()`.
  The web app consumes it through `apps/web/src/lib/trpc` (provider, query
  client, server-side `serverClient`).
- Server/SSR: `src/server-client.ts` — `createServerClient(url)` returns a
  plain client using `httpBatchLink` and the superjson transformer.
- Never import anything from `@repo/trpc/server` into client bundles; importing
  `AppRouter` as a **type** is erased at compile time and safe.