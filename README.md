# Smart Campus Energy Optimization

LLM-assisted energy optimization for smart campuses.

This project interprets natural-language operator instructions into structured energy directives and uses a deterministic optimization pipeline to generate a feasible 24-hour campus energy schedule.

The LLM is responsible for **interpreting operator notes**. The actual energy optimization is performed by a deterministic solver, followed by independent schedule validation.

## Features

- Natural-language operator directive interpretation
- Six supported directive types:
  - `solar_reduction`
  - `minimum_battery_reserve`
  - `no_charge_window`
  - `no_discharge_window`
  - `max_grid_window`
  - `no_op`
- 24-hour energy scheduling
- Solar, grid, and battery coordination
- Battery capacity, charge/discharge, and reserve constraints
- Grid-import limits
- End-of-day battery neutrality
- Cost minimization using hourly tariffs
- Independent schedule replay validation
- Structured API errors and request validation
- Server-side LLM integration

## Architecture

```text
Operator
   │
   │ operator notes + 24-hour scenario
   ▼
┌─────────────────────────┐
│       Hono API          │
│  POST /optimize-energy  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Directive Interpreter   │
│       (LLM)             │
└────────────┬────────────┘
             │
             │ structured directives
             ▼
┌─────────────────────────┐
│ Directive Validation &  │
│ Normalization            │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│ Deterministic Optimizer │
│        (Solver)         │
└────────────┬────────────┘
             │
             │ 24-hour plan
             ▼
┌─────────────────────────┐
│ Independent Schedule    │
│ Replay Validator        │
└────────────┬────────────┘
             │
             ▼
       Optimization API
          Response
```

The browser does not perform optimization or business-rule calculations. Optimization logic remains behind the API.

## API

### `GET /health`

Health check endpoint.

### `POST /optimize-energy`

Accepts a campus energy scenario containing:

- `scenario_id`
- `operator_notes`
- 24 hourly energy entries for hours 0–23
- battery configuration

The response contains:

- `scenario_id`
- `directive_interpretation`
- `hourly_plan`
- `total_grid_kwh`
- `total_cost_bdt`
- `peak_grid_kwh`
- `plan_summary`

The API returns exactly 24 hourly plan entries.

## Optimization Model

For each hour, the optimizer determines:

- grid import
- solar usage
- battery charge
- battery discharge
- battery energy

The core energy-balance constraint is:

```
grid + solar_used + battery_discharge
=
demand + battery_charge
```

The optimization objective is:

```
minimize Σ(grid[h] × tariff[h])
```

subject to the scenario, directive, solar, battery, grid, and end-of-day constraints.

The final battery energy must equal the initial battery energy.

## Supported Directives

| Directive | Effect |
|---|---|
| `solar_reduction` | Reduces usable solar by a specified factor during selected hours |
| `minimum_battery_reserve` | Raises the minimum battery energy during selected hours |
| `no_charge_window` | Prevents battery charging during selected hours |
| `no_discharge_window` | Prevents battery discharging during selected hours |
| `max_grid_window` | Limits grid import during selected hours |
| `no_op` | Indicates that no applicable adjustment is required |

The LLM produces structured directives only. Directive output is validated before reaching the optimization stage.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Web | Next.js 16, React 19 |
| API | Hono 4 |
| RPC | tRPC 11 + TanStack Query 5 + superjson |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Monorepo | Turborepo |
| Validation | Zod |
| Lint/format | Ultracite (Biome) |
| LLM | Groq API |
| Deployment | Vercel |

## Repository Layout

```
.
├── apps/
│   ├── web/                         # Next.js frontend
│   │   └── src/
│   │       ├── app/                 # App Router
│   │       ├── features/            # Frontend feature slices
│   │       └── lib/trpc/            # tRPC client
│   │
│   └── api/                         # Hono API
│       ├── src/
│       │   ├── app.ts               # Hono application
│       │   └── routes/              # HTTP routes
│       └── vercel/api/              # Vercel Hono handler
│
├── packages/
│   ├── energy/                      # Energy optimization domain/application layer
│   │   └── src/
│   │       ├── domain/
│   │       ├── schema/
│   │       ├── errors/
│   │       ├── interpreter/
│   │       ├── optimizer/
│   │       ├── validation/
│   │       └── service/
│   │
│   ├── db/                          # Drizzle schema + repositories
│   │   └── src/
│   │       ├── schema.ts
│   │       └── repositories/
│   │
│   └── trpc/                        # tRPC router, controllers and client
│
├── docs/                            # Project/team conventions
├── package.json
├── turbo.json
├── biome.jsonc
└── fallow.toml
```

## Getting Started

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Configure the required values in the appropriate environment files.

The LLM API key must remain server-side and must not use a `NEXT_PUBLIC_` variable.

### 3. Start development

```bash
bun run dev
```

This starts the web and API applications in development mode.

Run a single application with:

```bash
bun run dev:web
```

or:

```bash
bun run dev:api
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Run all applications in watch mode |
| `bun run dev:web` | Run the web application |
| `bun run dev:api` | Run the API application |
| `bun run build` | Build all workspaces |
| `bun run check` | Lint, typecheck, test, and build |
| `bun run lint` | Run Biome checks |
| `bun run fix` | Apply Biome fixes |
| `bun run test` | Run tests across workspaces |
| `bun run fallow` | Run dead-code, duplication, and health analysis |
| `bun run db:push` | Push the Drizzle schema to Neon |
| `bun run db:generate` | Generate database migrations |
| `bun run db:migrate` | Apply database migrations |
| `bun run db:studio` | Open Drizzle Studio |

## Testing

Run the full test suite:

```bash
bun run test
```

Run the complete project checks:

```bash
bun run check
```

The API uses `bun:test` and Hono's request testing pattern for HTTP integration tests.

## Deployment

The web and API applications are designed for Vercel.

The API includes a Hono Vercel handler at:

```
apps/api/vercel/api/[[...route]]/route.ts
```

Configure the required environment variables in the corresponding Vercel projects.

For the web application:

- `NEXT_PUBLIC_API_URL`

For server-side API/LLM configuration, keep credentials in server-only environment variables.

## Design Principles

- LLM interprets; the solver optimizes.
- Business rules stay behind the API.
- Structured LLM output is validated before use.
- Optimization results are independently replay-validated.
- The API exposes a stable contract between the frontend and optimization pipeline.
- Server-side secrets are never exposed to the browser.