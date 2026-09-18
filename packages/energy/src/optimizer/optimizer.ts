import type { NormalizedDirectives } from "../directives/normalized.ts";
import { normalizeDirectives } from "../directives/normalizer.ts";
import {
  type DirectiveValidationFailure,
  validateDirectiveInterpretations,
  validateScenario,
} from "../directives/validator.ts";
import type { DirectiveInterpretation } from "../domain/directive.ts";
import type {
  BatteryAction,
  HourlyPlanEntry,
  OptimizationPlan,
} from "../domain/plan.ts";
import type { Battery, Hour, Scenario } from "../domain/scenario.ts";
import {
  DirectiveValidationError,
  InvalidScenarioError,
} from "../errors/index.ts";
import {
  createEnergySolver,
  type EnergySolver,
  type LpConstraint,
  type LpModel,
  type LpSolution,
  type LpVariable,
} from "./solver.ts";

const HOURS = 24;
const HOURLY = Array.from({ length: HOURS }, (_, hour) => hour);

function padded(hour: number): string {
  return String(hour).padStart(2, "0");
}

const gridName = (hour: number) => `grid_${padded(hour)}`;
const solarName = (hour: number) => `solar_${padded(hour)}`;
const chargeName = (hour: number) => `charge_${padded(hour)}`;
const dischargeName = (hour: number) => `discharge_${padded(hour)}`;
const batteryName = (hour: number) => `battery_${padded(hour)}`;

function makeRow(
  name: string,
  coefficients: readonly (readonly [string, number])[],
  lower = 0,
  upper = 0
): LpConstraint {
  return { coefficients: new Map(coefficients), lower, name, upper };
}

// ---------------------------------------------------------------------------
// LP model construction
// ---------------------------------------------------------------------------

function hourVariables(
  scenario: Scenario,
  normalized: NormalizedDirectives
): LpVariable[] {
  const { battery } = scenario;
  const variables: LpVariable[] = [];
  for (const hour of HOURLY) {
    const entry = scenario.hours[hour];
    if (!entry) {
      continue;
    }
    variables.push(
      {
        cost: entry.tariff_bdt_per_kwh,
        lower: 0,
        name: gridName(hour),
        upper: normalized.max_grid_kwh[hour] ?? Number.POSITIVE_INFINITY,
      },
      {
        cost: 0,
        lower: 0,
        name: solarName(hour),
        upper: (normalized.effective_solar_factor[hour] ?? 1) * entry.solar_kwh,
      },
      {
        cost: 0,
        lower: 0,
        name: chargeName(hour),
        upper: battery.max_charge_kwh_per_hour,
      },
      {
        cost: 0,
        lower: 0,
        name: dischargeName(hour),
        upper: battery.max_discharge_kwh_per_hour,
      },
      {
        cost: 0,
        lower: Math.max(
          battery.minimum_energy_kwh,
          normalized.minimum_reserve[hour] ?? 0
        ),
        name: batteryName(hour),
        upper: battery.capacity_kwh,
      }
    );
  }
  return variables;
}

function balanceRow(hour: number, entry: Hour): LpConstraint {
  return makeRow(
    `balance_${padded(hour)}`,
    [
      [gridName(hour), 1],
      [solarName(hour), 1],
      [dischargeName(hour), 1],
      [chargeName(hour), -1],
    ],
    entry.demand_kwh,
    entry.demand_kwh
  );
}

function transitionRow(hour: number, battery: Battery): LpConstraint {
  if (hour === 0) {
    return makeRow(
      "transition_00",
      [
        [batteryName(0), 1],
        [chargeName(0), -1],
        [dischargeName(0), 1],
      ],
      battery.initial_energy_kwh,
      battery.initial_energy_kwh
    );
  }
  return makeRow(`transition_${padded(hour)}`, [
    [batteryName(hour), 1],
    [batteryName(hour - 1), -1],
    [chargeName(hour), -1],
    [dischargeName(hour), 1],
  ]);
}

function ruleRows(
  kind: "charge" | "discharge",
  hour: number,
  allowed: boolean
): LpConstraint[] {
  if (allowed) {
    return [];
  }
  const variable = kind === "charge" ? chargeName(hour) : dischargeName(hour);
  return [makeRow(`${kind}_rule_${padded(hour)}`, [[variable, 1]])];
}

function hourlyConstraints(
  scenario: Scenario,
  normalized: NormalizedDirectives
): LpConstraint[] {
  const constraints: LpConstraint[] = [];
  for (const hour of HOURLY) {
    const entry = scenario.hours[hour];
    if (!entry) {
      continue;
    }
    constraints.push(balanceRow(hour, entry));
    constraints.push(transitionRow(hour, scenario.battery));
    constraints.push(
      ...ruleRows("charge", hour, normalized.charge_allowed[hour] ?? true)
    );
    constraints.push(
      ...ruleRows("discharge", hour, normalized.discharge_allowed[hour] ?? true)
    );
  }
  return constraints;
}

function boundaryRow(battery: Battery): LpConstraint {
  return makeRow(
    "battery_final",
    [[batteryName(HOURS - 1), 1]],
    battery.initial_energy_kwh,
    battery.initial_energy_kwh
  );
}

export function buildOptimizationLp(
  scenario: Scenario,
  normalized: NormalizedDirectives
): LpModel {
  return {
    constraints: [
      ...hourlyConstraints(scenario, normalized),
      boundaryRow(scenario.battery),
    ],
    sense: "Minimize",
    variables: hourVariables(scenario, normalized),
  };
}

// ---------------------------------------------------------------------------
// Solution -> canonical plan
// ---------------------------------------------------------------------------

function roundValue(value: number): number {
  if (Math.abs(value) < 1e-9) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function batteryActionOf(
  charge: number,
  discharge: number
): {
  readonly action: BatteryAction;
  readonly batteryKwh: number;
} {
  const net = discharge - charge;
  if (net > 1e-9) {
    return { action: "discharge", batteryKwh: roundValue(net) };
  }
  if (net < -1e-9) {
    return { action: "charge", batteryKwh: roundValue(-net) };
  }
  return { action: "idle", batteryKwh: 0 };
}

function composeSummary(input: {
  readonly solarUsed: number;
  readonly totalCharge: number;
  readonly totalCost: number;
  readonly totalDemand: number;
  readonly totalGrid: number;
}): string {
  const { solarUsed, totalCharge, totalCost, totalDemand, totalGrid } = input;
  const solarCoverage =
    totalDemand > 0 ? Math.round((solarUsed / totalDemand) * 100) : 0;
  return `Cost-minimal dispatch over 24h: ${roundValue(totalGrid)} kWh from grid (${solarCoverage}% of demand met by ${roundValue(solarUsed)} kWh solar), battery cycled ${roundValue(totalCharge)} kWh — total cost ${roundValue(totalCost)} BDT.`;
}

function planFromSolution(
  scenario: Scenario,
  solution: LpSolution
): OptimizationPlan {
  const value = (name: string) => solution.values.get(name) ?? 0;
  const paddedName = (prefix: string, hour: number) =>
    `${prefix}_${padded(hour)}`;

  const hourly: HourlyPlanEntry[] = [];
  let peakGrid = 0;
  let solarUsedTotal = 0;
  let totalCharge = 0;
  let totalCost = 0;
  let totalDemand = 0;
  let totalGrid = 0;

  for (const hour of HOURLY) {
    const entry = scenario.hours[hour];
    if (!entry) {
      continue;
    }
    const grid = roundValue(value(paddedName("grid", hour)));
    const solar = roundValue(value(paddedName("solar", hour)));
    const charge = value(paddedName("charge", hour));
    const discharge = value(paddedName("discharge", hour));
    const action = batteryActionOf(charge, discharge);
    hourly.push({
      battery_action: action.action,
      battery_energy_after_kwh: roundValue(value(paddedName("battery", hour))),
      battery_kwh: action.batteryKwh,
      grid_kwh: grid,
      hour: entry.hour,
      solar_used_kwh: solar,
    });

    totalGrid += grid;
    totalCost += grid * entry.tariff_bdt_per_kwh;
    totalDemand += entry.demand_kwh;
    solarUsedTotal += solar;
    peakGrid = Math.max(peakGrid, grid);
    if (action.action === "charge") {
      totalCharge += action.batteryKwh;
    }
  }

  return {
    hourly_plan: hourly,
    peak_grid_kwh: roundValue(peakGrid),
    plan_summary: composeSummary({
      solarUsed: solarUsedTotal,
      totalCharge,
      totalCost: roundValue(totalCost),
      totalDemand,
      totalGrid,
    }),
    total_cost_bdt: roundValue(totalCost),
    total_grid_kwh: roundValue(totalGrid),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function assertionMessage(
  failures: readonly DirectiveValidationFailure[]
): string {
  return failures.map((item) => item.message).join("; ");
}

export function createEnergyOptimizer(solver: EnergySolver) {
  return {
    name: solver.name,
    async optimize(
      scenario: Scenario,
      interpretations: readonly DirectiveInterpretation[]
    ): Promise<OptimizationPlan> {
      const scenarioCheck = validateScenario(scenario);
      if (!scenarioCheck.ok) {
        throw new InvalidScenarioError(
          "The provided scenario is invalid.",
          assertionMessage(scenarioCheck.failures)
        );
      }

      const directiveCheck = validateDirectiveInterpretations({
        interpretations,
        scenario,
      });
      if (!directiveCheck.ok) {
        throw new DirectiveValidationError(
          "The interpreted directive violates domain rules or constraints.",
          assertionMessage(directiveCheck.failures)
        );
      }

      const normalized = normalizeDirectives({ interpretations, scenario });
      const solution = await solver.solve(
        buildOptimizationLp(scenario, normalized)
      );
      return planFromSolution(scenario, solution);
    },
    solver,
  };
}

export async function optimize(
  scenario: Scenario,
  interpretations: readonly DirectiveInterpretation[]
): Promise<OptimizationPlan> {
  const optimizer = createEnergyOptimizer(await createEnergySolver());
  return optimizer.optimize(scenario, interpretations);
}
