# Design System — GridWise

Energy-optimization interface for a campus microgrid: solar + battery + grid
dispatch over a 24-hour day. The product is a working tool — input a scenario,
run an optimization, inspect the interpretation and the hour-by-hour schedule.

## Concept: control room at dawn

- The interface is a **true black shell** (the pre-dawn grid), lit from above
  by a faint amber glow.
- **Solar gold** is the primary energy — generation, the primary action, focus.
- **Cyan** is stored charge — battery level, success states, energy returned.
- **Violet** is the grid, **coral** is peak/fault, **sky** is informational.
- Energy flows keep fixed hues across charts, chips, sparklines and tables, so
  a value is always recognized by its color.
- Numbers are always set in **tabular figures** — a day of kWh and BDT must line
  up in columns.
- Motion is reserved for what changed: charging shimmer, flow pulse, press
  feedback. No decorative entrance choreography.

Reference implementation: `apps/web/src/app/design-system/` (living preview of
every token and component below).

## Principles

1. **Black is the shell.** Surfaces are distinguished by 1-level luminance
   steps and a 1px inner top-light, not by heavy borders or shadows.
2. **Color means energy.** Amber = solar, cyan = battery, violet = grid, coral
   = fault. Semantic colors (`success`, `warning`, `destructive`) reuse the
   energy hues so nothing reads arbitrary.
3. **Data outranks decoration.** Density and legibility of the 24-hour table
   beat visual flair. Use tabular figures, right-aligned numerics, dense rows.
4. **One bold moment.** The signature glow is reserved for solar-primary and
   battery states only; everything else stays quiet.
5. **Accessible by default.** Visible focus rings, ≥4.5:1 contrast, hover-only
   info also available to keyboard/touch, `prefers-reduced-motion` respected.

## Color tokens

Defined in `packages/ui/src/styles/globals.css` under `:root`. The app is
dark-only; `:root` holds the dark values and `color-scheme: dark` is set.

### Base surfaces (luminance steps on black)

| Token           | Hex       | Use                                              |
| --------------- | --------- | ------------------------------------------------ |
| `--background`  | `#050505` | Page shell                                       |
| `--card`        | `#0b0c0d` | Cards, tiles, panels                             |
| `--popover`     | `#101113` | Menus, dialogs, tooltips, drops                  |
| `--sidebar`     | `#080909` | Navigation rail                                  |
| `--secondary`   | `#16181a` | Secondary surface, secondary buttons             |
| `--accent`      | `#1b1e20` | Hover/reinforced surface, active rows            |
| `--muted`       | `#121417` | Tracks, disabled shells, list roots              |
| `--foreground`  | `#eef1f3` | Primary text                                     |
| `--muted-foreground` | `#98a1a7` | Secondary text, captions (≈7:1 on black) |
| `--border`      | `#1c1f22` | Hairline borders and rules                       |
| `--input`       | `#24272b` | Input borders and filled shells                  |

### Semantic color

| Token            | Hex       | Meaning                                |
| ---------------- | --------- | -------------------------------------- |
| `--primary`      | `#f5a524` | Solar gold — primary action, generation |
| `--success`      | `#2fdfa2` | Battery cyan — stored charge, healthy   |
| `--warning`      | `#ffcf5c` | Caution, near-limit, mid charge         |
| `--destructive`  | `#ff6555` | Fault, infeasible, over budget          |
| `--info`         | `#7fc7ff` | Guidance, new information               |
| `--ring`         | `#f5a524` | Focus ring                              |

Foreground pairs: `--primary-foreground #201000`,
`--success-foreground #051f16`, `--warning-foreground #2b2100`,
`--destructive-foreground #2b0a05`, `--info-foreground #081f33`.

### Chart palette (energy flows of one day)

| Token      | Hex       | Series             |
| ---------- | --------- | ------------------ |
| `chart-1`  | `#f5a524` | Solar              |
| `chart-2`  | `#35e0bf` | Battery            |
| `chart-3`  | `#9d8cff` | Grid import        |
| `chart-4`  | `#e8edf0` | Demand             |
| `chart-5`  | `#ff8f66` | Peak / tariff      |

### Shadows & glows

- `shadow-topline` — 1px inner top-light for raised surfaces on black.
- `shadow-panel` — default tile shadow.
- `shadow-glow-solar`, `shadow-glow-battery`, `shadow-glow-destructive` —
  signature glows; use only to mark the primary/battery aspiration or faults
  (see `glow` on `Stat`).

## Typography

Loaded via `next/font/google` in `apps/web/src/app/layout.tsx`.

| Role    | Family        | Application                                 |
| ------- | ------------- | ------------------------------------------- |
| Display | `Space Grotesk` (var `--font-display`) | Headings, big numbers, KPI values |
| Body/UI | `Inter` (var `--font-sans`) | Everything else, tables, forms      |
| Mono    | `JetBrains Mono` (var `--font-mono`) | IDs, request refs, code          |

Rules:

- Headings and note text: `font-display tracking-tight`, `text-wrap: balance`.
- **All numeric data: `tabular-nums`.** Required for tables, stats, battery
  labels, costs.
- Line lengths: ≤80 characters for prose.
- No ALL-CAPS eyebrows or decorative labels; labels are sentence case and small
  (`text-xs text-muted-foreground`).
- One font per role; never mix display into body copy.

Scale: display `text-4xl` for page hero, `text-2xl` for KPI values, headings
`text-xl`→`text-sm` depending on density, body `text-sm` (default), captions
`text-xs`.

## Spacing & radius

- Base unit 4 (Tailwind scale). Standard control height **h-8**; dense tables
  use **h-9** rows.
- Page gutter: `px-4 sm:px-6 lg:px-8`; working column `max-w-5xl`; app shell up
  to 1440px.
- Section rhythm: `gap-12` between page sections, `gap-4` inside a section,
  `gap-3` inside grouped cards/tools.
- Radius: `rounded-lg` on controls/cards (radius 10px), `rounded-xl` on large
  surfaces, `rounded-full` for pills. Radius grows with hierarchy.

## Layout

- **App shell** — slim left rail (sidebar tokens) + main canvas; rail collapses
  to a top bar under `md`.
- **Dashboard/tool views** — KPI stat band on top (`Stat` grids), then panels
  for interpretation, schedule, summary; panels use `Card`.
- **Data tables** — horizontal scroll on narrow viewports (the `Table` wrapper
  does this), sticky first column optional for the hour column.
- Mobile-first: grids stack by default and widen with `sm:`/`lg:` breakpoints.

## Components

Primitives are shadcn/ui (Base UI) vendored under
`packages/ui/src/components`, imported as `@repo/ui/components/<name>`.

### Core primitives

`Button` · `Badge` · `Card` · `Input` · `Textarea` · `Label` · `Field` ·
`Select` · `Switch` · `Tabs` · `Dialog` · `DropdownMenu` · `Table` ·
`Progress` · `Tooltip` · `Skeleton` · `Alert` · `Separator` · `Sonner`
(toasts)

### Themed components

- **`BatteryLevel`** — segmented battery bar. `value` (0–100), `charging`
  (shimmer), `size`, `label`, `tone` (`auto` maps low→danger, mid→solar-warn,
  high→battery). Exposes full progressbar ARIA. Use anywhere stored energy is
  shown.
- **`Stat`** — KPI tile: `label`, `value`, `unit`, `hint`, `icon`, `tone`
  (`solar | battery | grid | success | warning | destructive | neutral`),
  `glow` (wraps the tile in the tone's glow). Default for the summary band.
- **`EnergyChip`** — state/flow pill: `tone` + `active` (pulses the leading
  dot) + `dot`. Use for charge/discharge/import/validation status.
- **`energy-tone`** — shared tone types and class maps; import from
  `@repo/ui/components/energy-tone`.

### Usage rules

- Extend shadcn variants before forking. Add new primitives with the shadcn CLI
  from `apps/web`, or follow Base UI + `cn()` in the existing style.
- No raw hex in components — always semantic utilities
  (`bg-primary`, `text-muted-foreground`, equivalent chart tones).
- Add new tokens to `:root` in `packages/ui/src/styles/globals.css` and expose
  them via `@theme inline`; ngapps re-export the tokens through that file.

## Interactions & states

- **Hover** — controls: `hover:bg-*` on the filled surface; rows hover at
  `bg-muted/40`. Hover-only info gets a visible resting cue or an ARIA-visible
  alternative.
- **Focus** — `ring` tokens: `focus-visible:ring-3 ring-ring/50` plus
  `border-ring`. Never strip the focus indicator.
- **Press** — buttons scale to 0.97 with asymmetric timing
  (`active:scale-[0.97] active:duration-150`, release `ease-out duration-200`).
- **Disabled** — `opacity-50`, pointer-events off; keep the affordance obvious.
- **Motion** — runs **below 300ms** for UI, 1.6s loop for the charging shimmer,
  2s loop for the flow pulse. Easings: `ease-out` default,
  `ease-out-strong` (`cubic-bezier(0.23,1,0.32,1)`) for menus/modals,
  `ease-swift` for on-screen travel. Animate only `transform`/`opacity`/`color`
  where possible.
- **Reduced motion** — the global `prefers-reduced-motion: reduce` block
  collapses animation duration to near-zero; components further gate ambient
  loops behind `motion-safe:`.
- **Feedback** — every mutation answers: optimizations toast, validation shows
  the `Alert` that explains what to fix, empty states invite the next action.

## Responsive

- `Stat` grid: 1 → 2 (`sm`) → 4 (`lg`) columns.
- Banner/alerts: stack below `lg`.
- Table: horizontal scroll container; keep the sticky hour column usable at
  mobile widths.
- Forms: fields full-width below `md`, inline above.
- Touched targets ≥ 32px; interactive taps never depend on hover.

## Quality bar

- Run `bun x ultracite check` and repo typechecks before committing; the full
  gate is `bun run check` (lint + typecheck + test + build).
- Keep a `@repo/ui` reference page green: `apps/web/src/app/design-system/`.
- Do not duplicate tokens or ad-hoc CSS; utilities and semantic tokens first.