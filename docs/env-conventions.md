# Environment variables

Each tool reads its own `.env` file from its own working directory. Copy the
corresponding `.env.example` next to it and fill in real values; real `.env`
files are gitignored, `.env.example` files are committed.

## Where variables live

| File                      | Read by                                                                  | Variables                          |
| ------------------------- | ------------------------------------------------------------------------ | ---------------------------------- |
| `.env` (repo root)        | `packages/db/drizzle.config.ts` via `dotenv.config({ path: "../../.env" })` | `DATABASE_URL`                     |
| `apps/api/.env`           | Bun, when `dev`/`start` run in `apps/api` (Bun auto-loads `.env` from cwd) | `DATABASE_URL`, `PORT`            |
| `apps/web/.env.local`     | Next.js (loads `.env*` from `apps/web`)                                    | `NEXT_PUBLIC_API_URL`              |

## Rules

- `DATABASE_URL` appears in **both** the root `.env` and `apps/api/.env` — they
  must contain the **same** connection string. The root copy feeds `drizzle-kit`;
  the API copy feeds the runtime client. Keep them in sync when you rotate
  credentials.
- Use the **pooled** Neon connection string (`-pooler`) for both.
- A `NEXT_PUBLIC_` prefix means Next.js inlines the value at **build time** into
  the client bundle. Any variable that reaches the browser must be public by
  design — never put secrets, API keys, or DB credentials behind
  `NEXT_PUBLIC_`.
- Server-only secrets in `apps/web` (e.g. third-party keys) belong in
  `.env.local` WITHOUT the `NEXT_PUBLIC_` prefix; Next.js exposes them to server
  code only. Do not import them from client components.
- Name variables in `SCREAMING_SNAKE_CASE`. Group related variables; comment
  each block in the `.env.example` so the schema is self-documenting.
- `.env.example` files must contain **placeholders only** (`user:password@host`)
  — never real credentials. Scrub them if a real value leaks in.
- Real `.env` / `.env.local` files are never committed. Note that `.gitignore`
  covers `.env` and `.env.*.local` but **not** `.env.local` itself — add it if
  web gets any non-public variable (see Troubleshooting below).
- Turborepo does not load `.env` files into task runtimes — the framework or
  dotenv does. Turbo only hashes variables you declare in `turbo.json` (`env` /
  `globalEnv`); Next.js's `NEXT_PUBLIC_*` is covered by Framework Inference.

## Validation

- `packages/db/src/env.ts` validates `DATABASE_URL` with Zod. Mirror this pattern
  for any new required server-side variable: parse it once in a small module (a
  `getXEnv()` function or config file) so invalid config fails fast at startup
  instead of mid-request.
- In the web app, keep a config module (like `apps/web/src/lib/trpc/config.ts`)
  that reads `process.env.*` through one function, applies safe defaults for
  local dev, and throws on missing values where a misconfiguration would cause a
  silent runtime failure (e.g. on Vercel).

## Deploying (Vercel)

- API project: set `DATABASE_URL` in the project's environment variables.
  `PORT` is not used on Vercel.
- Web project: set `NEXT_PUBLIC_API_URL` to the **public** API URL (no trailing
  slash). Remember it is baked in at build time — a change requires a rebuild.
  The config helper intentionally throws when `NEXT_PUBLIC_API_URL` is missing
  and `VERCEL` is set, so a misconfigured web deploy fails loudly.
- Keep local `NEXT_PUBLIC_*` values aligned with deployment URLs so behavior
  (relative vs absolute URLs, CORS) doesn't differ between environments.

## Troubleshooting

- **`apps/web/.env.local` can be committed.** The `.gitignore` pattern
  `.env.*.local` matches `.env.production.local` but not `.env.local` itself
  (no segment between `.env.` and `.local`). Add `.env.local` to `.gitignore`
  before storing anything sensitive there.
- **Migrations can't find the DB.** `drizzle-kit` reads the root `.env`, not
  `apps/api/.env` — make sure a `DATABASE_URL` exists at the repo root.
- **API can't reach the DB.** Bun loads `apps/api/.env`; verify the value there
  matches the root one.
- **NEXT_PUBLIC change has no effect.** Next inlines at build time — restart the
  dev server or rebuild, then hard-refresh.