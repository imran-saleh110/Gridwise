# web-scaffold

TODO: Write a concise project description here before submitting.


## Stack

| Layer      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Runtime    | [Bun](https://bun.sh) 1.4                           |
| Web        | Next.js 16 (App Router, Turbopack), React 19        |
| API        | [Hono](https://hono.dev) 4                          |
| RPC        | tRPC 11 + TanStack Query 5 + superjson              |
| Database   | Postgres (Neon) via Drizzle ORM                     |
| Monorepo   | Turborepo                                           |
| Lint/format | Ultracite (Biome) with type-aware rules            |

## Layout

```
.
├── apps/
│   ├── web/                     # Next.js app (Vercel) · @repo/web
│   │   └── src/
│   │       ├── app/             # App Router
│   │       ├── features/        # Feature slices (vertical)
│   │       └── lib/trpc/        # tRPC client wiring
│   └── api/                     # Hono + tRPC server (Vercel) · @repo/api
│       ├── src/app.ts           # Hono app
│       ├── src/routes/          # Plain HTTP routes
│       └── vercel/api/          # Vercel handler
├── packages/
│   ├── db/                      # Drizzle schema + repositories · @repo/db
│   │   └── src/
│   │       ├── schema.ts
│   │       └── repositories/
│   └── trpc/                    # Router, controllers, client · @repo/trpc
│       └── src/
│           ├── client.ts
│           └── server/
│               ├── context.ts
│               ├── router.ts
│               └── features/    # <name>/ = schema + controller + router
├── docs/                        # Team conventions
├── package.json
├── turbo.json
├── biome.jsonc                  # Ultracite (Biome) config
└── fallow.toml                  # Fallow audit entry points
```

## Getting started

```bash
bun install

# Database connection (only needed for anything that touches Postgres)
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

bun run dev                     # web :3000 + api :3001
```

`bun run dev:web` / `bun run dev:api` run a single app.

## Scripts

| Command            | What it does                                             |
| ------------------ | -------------------------------------------------------- |
| `bun run dev`      | Run every app in watch mode                              |
| `bun run build`    | Build every workspace                                    |
| `bun run check`    | Lint + typecheck + test + build (what CI runs)           |
| `bun run lint`     | Biome check                                              |
| `bun run fix`      | Apply safe Biome fixes                                   |
| `bun run test`     | `bun test` across workspaces                             |
| `bun run fallow`   | Dead code, duplication and health report                 |
| `bun run db:push`  | Push the Drizzle schema to Neon (fast path for dev)      |
| `bun run db:generate` / `bun run db:migrate` | Versioned migrations           |
| `bun run db:studio`| Drizzle Studio                                           |


## Deployment

Both apps target Vercel. Set `DATABASE_URL` on the API project and
`NEXT_PUBLIC_API_URL` (the API's public URL + no trailing slash) on the web
project. The API ships a `hono/vercel` handler at
`apps/api/vercel/api/[[...route]]/route.ts`.
