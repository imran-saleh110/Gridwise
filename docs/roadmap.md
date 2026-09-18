# Roadmap — Production implementation

Energy-optimization challenge. The browser is never responsible for
optimization or business rules; all of that lives behind the API.

## 0. Target architecture

```
Next.js Web
    │
    │ tRPC / HTTP
    ▼
Hono API
    │
    ▼
Optimization Service
    │
    ├── 1. Request validation
    │
    ├── 2. LLM directive interpreter
    │       └── Structured JSON output
    │
    ├── 3. Directive validator
    │
    ├── 4. Directive normalizer
    │
    ├── 5. Optimization model
    │
    ├── 6. Solver
    │
    └── 7. Independent schedule validator
    │
    ▼
Structured response
```

**Architectural rule:** the LLM proposes structured directives; deterministic
TypeScript code decides whether those directives are valid. The optimizer never
consumes raw LLM output. This follows the challenge's guardrail model.

## Phase 1 — Lock down the domain model

Establish the canonical TypeScript domain types before building UI or LLM calls.

`Scenario`:

```
Scenario
├── scenario_id
├── operator_notes[]   (1–3 non-empty)
├── hours[24]          (exactly 24, covering 0..23)
└── battery
```

`Hour`:

```
Hour
├── hour               (0..23)
├── demand_kwh
├── solar_kwh
└── tariff_bdt_per_kwh
```

`Battery`:

```
Battery
├── capacity_kwh
├── initial_energy_kwh
├── minimum_energy_kwh
├── max_charge_kwh_per_hour
└── max_discharge_kwh_per_hour
```

The request must enforce exactly 24 hourly entries covering `0..23`, with 1–3
non-empty operator notes.

`Directive` — a discriminated union. These six are the only allowed types:

```
solar_reduction
minimum_battery_reserve
no_charge_window
no_discharge_window
max_grid_window
no_op
```

`OptimizationPlan`:

```
OptimizationPlan
├── hourly_plan[24]
├── total_grid_kwh
├── total_cost_bdt
├── peak_grid_kwh
└── plan_summary
```

## Phase 2 — Request validation

Strict Zod schemas at the API boundary, before the LLM is called. Validate:

- `scenario_id`
- `operator_notes.length`
- note strings are non-empty
- exactly 24 hours; hours are exactly `0..23`
- numeric fields are finite
- non-negative energy values
- valid battery configuration
- battery `capacity`/`initial`/`reserve` relationships

Response semantics: **400** for malformed requests, **422** for semantically
invalid but structurally valid requests (both are explicit in the challenge).

## Phase 3 — Production LLM interpretation service

Dedicated domain service — do not put the LLM call inside the Hono route.

```
DirectiveInterpreter
    └── interpret(note) -> DirectiveInterpretation
```

Route shape, conceptually:

```
route
  → controller
      → optimization service
          → directive interpreter
          → directive validator
          → optimizer
          → schedule validator
```

### LLM output

Force structured output matching the discriminated union. Every note must
produce exactly one result:

```
note_index
applies
directive_type
structured_adjustment
explanation
```

Ordering must remain `0,1,...,N-1`.

### Prompt design

The system prompt must state:

- only six directive types exist
- irrelevant notes are `no_op`
- never invent unsupported directives
- never modify demand
- never modify tariff
- never modify battery parameters
- hours are `[start, end)`
- hours must be sorted and unique
- solar factor means the *remaining fraction*, not the reduction percentage
- output must follow the schema

The model does not perform optimization — it only interprets language.

## Phase 4 — Deterministic directive validator

One of the most important components. Validates the LLM result independently.

- **Mapping:** every input note appears exactly once; no duplicate
  `note_index`; indexes are valid; output ordering is correct.
- **Directive type:** must be one of the six.
- **Hours:** `0 <= hour <= 23`, integer, unique, ascending.
- **Solar reduction:** `0 <= factor <= 1`.
- **Battery reserve:** finite, `>= 0`, `<= battery.capacity_kwh`.
- **Grid limit:** finite, `>= 0`.
- **Applies semantics:**
  - `no_op`: `applies = false`, `structured_adjustment = null`
  - everything else: `applies = true`, `structured_adjustment != null`

These are explicitly part of the judge's validation requirements.

## Phase 5 — Directive normalization

Do not let the optimizer consume natural-language-derived objects directly.
Convert validated directives into a normalized constraint representation:

```
effective_solar_factor[24]
minimum_reserve[24]
charge_allowed[24]
discharge_allowed[24]
max_grid_import[24]
```

Start from a neutral baseline and apply directives deterministically:

```
effective_solar_factor = [1, 1, ..., 1]
minimum_reserve       = base reserve
charge_allowed        = true
discharge_allowed     = true
max_grid_import       = Infinity
```

Effects (exactly per the specification):

- `solar_reduction` → `effective_solar[h] *= factor`
- `no_charge_window` → `charge_allowed[h] = false`
- `no_discharge_window` → `discharge_allowed[h] = false`
- `max_grid_window` → `max_grid_import[h] = specified value`

This gives the optimizer a clean mathematical input.

## Phase 6 — Optimization model

Per-hour decision variables:

```
grid[h]
solar_used[h]
battery_charge[h]
battery_discharge[h]
battery_energy[h]
```

**Energy balance (hard constraint), each hour:**

```
grid + solar_used + battery_discharge = demand + battery_charge
```

**Solar:** `0 <= solar_used[h] <= effective_solar[h]`

**Battery transition:**

```
E_after = E_before + charge - discharge
```

with `minimum_energy <= E_after <= capacity`.

**Charge/discharge limits:**
`charge <= max_charge_kwh_per_hour`, `discharge <= max_discharge_kwh_per_hour`.

**End-of-day neutrality (critical):** `E_23 = initial_energy`. The optimizer
cannot simply empty the battery to reduce grid consumption.

**Operator constraints:** apply `minimum_battery_reserve`, `no_charge_window`,
`no_discharge_window`, `max_grid_window` directly to the model.

**Objective — minimize `Σ grid[h] × tariff[h]`** (total grid electricity cost).

## Phase 7 — Solver integration

No heuristics such as "charge when cheap, discharge when expensive" — that
fails hidden cases. Use a proper optimization solver behind an abstraction:

```
EnergyOptimizer
    optimize(scenario, normalizedDirectives)
       │
       └── Solver implementation
```

Keep the rest of the application unaware of the solver implementation.

## Phase 8 — Independent schedule validator

Completely separate from the optimizer. Do not assume "the solver returned it,
therefore it is valid." Replay the plan hour-by-hour.

- **Structure:** exactly 24 entries, hours `0..23`, no duplicates.
- **Energy:** `grid + solar + discharge = demand + charge` each hour.
- **Solar:** `solar_used <= effective_solar`.
- **Battery:** check every transition; `minimum <= energy <= capacity`;
  hourly charge/discharge limits.
- **Directive enforcement:** explicitly replay minimum reserve, no-charge,
  no-discharge, max-grid, and solar-reduction constraints.
- **End state:** `final_energy == initial_energy`.
- **Aggregates:** recalculate `total_grid_kwh`, `total_cost_bdt`,
  `peak_grid_kwh`. Do not trust values supplied by an optimizer or controller —
  the judge independently recalculates these.

## Phase 9 — API implementation

Endpoints:

- `GET /health` → `{ "status": "ok" }`
- `POST /optimize-energy` → takes the scenario, returns:
  - `scenario_id`
  - `directive_interpretation`
  - `hourly_plan`
  - `total_grid_kwh`
  - `total_cost_bdt`
  - `peak_grid_kwh`
  - `plan_summary`

These fields are part of the canonical response contract.

`/optimize-energy` belongs under `apps/api/src/routes/` — the scaffold reserves
plain Hono routes for health checks and other non-tRPC HTTP interfaces.

## Phase 10 — Application/service organization

Recommended backend layout:

```
apps/api/
└── src/
    ├── routes/
    │   ├── health.ts
    │   └── optimize-energy.ts
    │
    └── ...

packages/
└── energy/
    └── src/
        ├── domain/
        │   ├── scenario.ts
        │   ├── directive.ts
        │   └── plan.ts
        │
        ├── interpreter/
        │   ├── interpreter.ts
        │   ├── prompt.ts
        │   └── schemas.ts
        │
        ├── directives/
        │   ├── validator.ts
        │   └── normalizer.ts
        │
        ├── optimizer/
        │   ├── optimizer.ts
        │   └── solver.ts
        │
        ├── validation/
        │   └── schedule-validator.ts
        │
        └── service/
            └── optimize-energy.ts
```

**Decision:** create a new `packages/energy` package rather than putting the
domain inside `packages/trpc` — the optimizer, directive interpreter and
schedule validator are not inherently HTTP/tRPC concerns. Packages own business
logic; apps compose it.

## Phase 11 — Database

The challenge does not require persistent scenario data; the input is supplied
directly to `/optimize-energy` and the response is generated synchronously.
**Do not introduce DB persistence into the critical optimization path.**

Use Postgres only if the surrounding application needs saved optimization runs,
user accounts, scenario history, analytics, audit history, or dashboard data.
The scaffold's DB layer is already isolated behind repositories.

## Phase 12 — Frontend

The frontend is a testing/visualization interface, not part of the
judging-critical computation.

- **Scenario input:** scenario ID, 24-hour demand table, 24-hour solar table,
  24-hour tariff table, battery configuration, operator notes.
- **Optimize action:** `Optimize Energy`.
- **Interpretation panel:** per note — note, directive, applies, extracted
  values, explanation.
- **Schedule table:** hour, demand, solar, solar used, grid, battery action,
  battery kWh, battery energy, tariff, cost.
- **Summary:** total grid, total cost, peak grid.
- **Validation state:** `VALID` or detailed validation errors.

Demonstrates the actual pipeline during the hackathon rather than a generic
dashboard.

## Phase 13 — Production LLM reliability

LLM layer with: structured output, explicit schema, request timeout, retry
policy with bounded retry count, provider error handling, malformed-response
handling, model configuration via environment variables, server-side-only API
key, request IDs, structured logs.

Do not blindly retry every failure:

- invalid structured output → controlled retry
- temporary provider/network failure → retry with backoff
- unsupported directive after retries → controlled failure
- optimizer infeasible → controlled failure

Malformed/unsupported LLM output must be handled safely — never silently invent
a directive or crash.

## Phase 14 — Testing strategy

Implement features completely first, then test (per the scaffold's development
instructions). Essential tests:

- **Request validation:** 23 hours, 25 hours, duplicate hours, missing hour,
  invalid battery, negative values, empty notes.
- **Directive validation:** every directive; especially `factor = -1`,
  `factor = 1.5`, `hour = 24`, duplicate hours, unsorted hours, reserve >
  capacity, negative grid cap, missing adjustment, `no_op` with `applies =
  true`, non-`no_op` with `applies = false`.
- **LLM interpretation:** a fixed corpus of paraphrases — e.g. "PV output will
  fall to one fifth...", "Solar production drops to 20%...", "80% reduction in
  rooftop generation..." must all resolve to `solar_reduction` with `factor =
  0.2`. Hidden cases use paraphrased language rather than byte-for-byte matches.
- **Optimizer:** solar-only, grid-only, battery charging, battery discharging,
  reserve, no-charge, no-discharge, grid cap, combined directives, end-of-day
  neutrality.
- **Replay validator:** feed intentionally broken schedules and confirm it
  catches them.

## Phase 15 — Public sample-case regression suite

Turn every provided public sample scenario into an automated regression test:

```
request
   ↓
LLM interpretation
   ↓
directive validation
   ↓
optimization
   ↓
schedule validation
   ↓
response schema validation
```

Keep these runnable locally. Do not hard-code the exact schedule — multiple
optimal schedules can be valid; the judge evaluates validity/cost, not
byte-for-byte JSON equality.

## Phase 16 — Observability

Structured logging around: `request_id`, `scenario_id`, LLM request duration,
LLM retry count, directive validation result, optimization duration, solver
status, schedule validation result, total cost.

Never log: API keys, secrets, full provider credentials, or unnecessary
sensitive request data. For a hackathon, simple structured server logs suffice.

## Phase 17 — Error handling

Explicit application errors:

```
InvalidScenarioError
DirectiveInterpretationError
DirectiveValidationError
OptimizationError
ScheduleValidationError
LLMProviderError
```

Map them at the Hono boundary:

- `400` → malformed request
- `422` → semantic request problem
- `500` → controlled internal/provider/solver failure

Never return raw stack traces. Matches the challenge's API requirements.

## Phase 18 — Deployment

The scaffold targets Vercel for both apps. Before deploying:

```
bun run check
bun run fallow
bun run build
```

(`bun run check` = lint + typecheck + test + build; CI also runs the Fallow
audit.)

Configure: `LLM_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT`, `NEXT_PUBLIC_API_URL`,
`DATABASE_URL`. Only variables that genuinely belong to the frontend go behind
`NEXT_PUBLIC_`. The LLM key must remain server-side.

## Phase 19 — Final integration test

Before submission, run:

1. Health check
2. Known sample scenario
3. Paraphrased directives
4. No-op notes
5. Combined directives
6. Malformed LLM output
7. Invalid request
8. Optimizer failure
9. Schedule replay

Then verify the final JSON against the specification. The final output must
contain both the interpretation and the 24-hour plan.

## Team division

### Four-teammate division

Do not split into "frontend/backend/LLM/database" — unnecessary dependencies.
Split around the actual domain boundaries.

### Teammate A — Domain, validation, API

- Domain models & request/response schemas
- Request validation
- API contract implementation
- `GET /health`
- `POST /optimize-energy` route/controller
- Error handling and HTTP response mapping
- API integration tests
- Final API integration

Depends on: domain types from the shared domain package.

### Teammate B — LLM interpretation

- LLM directive interpretation
- LLM provider integration
- Structured-output schema
- Interpretation system prompt
- All six directive types
- Note-by-note interpretation
- LLM retries/timeouts
- LLM failure handling
- Directive interpretation test corpus
- Paraphrase robustness tests

Depends on: shared directive/domain types from Teammate A.

Heads up: Teammate C consumes B's validated interpretation, but B can
implement almost everything independently using mocked scenarios.

### Teammate C — Optimization engine

- Energy optimization engine
- Directive normalization
- 24-hour optimization model
- Solver integration
- Battery constraints
- Solar constraints
- Grid constraints
- Cost objective
- End-of-day battery neutrality
- Combined-directive handling
- Optimizer tests

Depends on: the normalized directive interface.

C does not need the actual LLM — use manually constructed directive objects
while developing.

### Teammate D — Validator, frontend, integration

- Independent schedule replay validator
- Energy-balance validation
- Battery transition validation
- Directive compliance validation
- Aggregate recalculation
- Scenario test fixtures
- Next.js scenario input UI
- Operator-note UI
- Interpretation visualization
- 24-hour schedule visualization
- Final integration/regression testing

Depends on: optimizer output contract from Teammate C for the final UI
integration.

D can develop the validator independently using handcrafted plans and build the
frontend against the agreed response schema before the optimizer is finished.

### Parallel development order

```
                    ┌── Teammate A ── API + schemas
                    │
                    ├── Teammate B ── LLM interpreter
                    │
START ──────────────┼── Teammate C ── optimizer
                    │
                    └── Teammate D ── validator + frontend

                             ↓
                        Integration
                             ↓
                   Public sample tests
                             ↓
                    Paraphrase testing
                             ↓
                  Hidden-case simulation
                             ↓
                        Deployment
```

### Frozen interfaces

The critical interfaces must be agreed before coding:

```
Scenario
DirectiveInterpretation
NormalizedDirectives
OptimizationPlan
ValidationResult
```

Once these are frozen, the four people can work largely independently.