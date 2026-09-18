import type { NormalizedDirectives } from "../directives/normalized.ts";
import { validateScenario } from "../directives/validator.ts";
import type { Battery, Hour, Scenario } from "../domain/scenario.ts";
import { DirectiveValidationError } from "../errors/directive-validation-error.ts";
import {
  createEnergySolver,
  type EnergySolver,
  type LpConstraint,
  type LpModel,
  type LpSolution,
  type LpVariable,
} from "./solver.ts";

export interface HourlyPlanEntry {
  readonly battery_charge_kwh: number;
  readonly battery_discharge_kwh: number;
  readonly battery_energy_kwh: number;
  readonly demand_kwh: number;
  readonly grid_cost_bdt: number;
  readonly grid_kwh: number;
  readonly hour: number;
  readonly solar_used_kwh: number;
}

export interface PlanSummary {
  readonly final_battery_energy_kwh: number;
  readonly minimum_battery_energy_kwh: number;
  readonly peak_battery_energy_kwh: number;
  readonly start_battery_energy_kwh: number;
  readonly total_battery_charge_kwh: number;
  readonly total_battery_discharge_kwh: number;
  readonly total_demand_kwh: number;
  readonly total_solar_available_kwh: number;
  readonly total_solar_used_kwh: number;
}

export interface OptimizationPlan {
  readonly hourly_plan: readonly HourlyPlanEntry[];
  readonly peak_grid_kwh: number;
  readonly plan_summary: PlanSummary;
  readonly scenario_id: string;
  readonly total_cost_bdt: number;
  readonly total_grid_kwh: number;
}

export interface OptimizeInput {
  readonly normalized: NormalizedDirectives;
  readonly scenario: Scenario;
}

export interface OptimizeResult {
  readonly normalized: NormalizedDirectives;
  readonly plan: OptimizationPlan;
}

export interface EnergyOptimizer {
  optimize: (input: OptimizeInput) => Promise<OptimizeResult>;
  readonly solver: EnergySolver;
}

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
        upper: normalized.max_grid_import[hour] ?? Number.POSITIVE_INFINITY,
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

function planFromSolution(
  scenario: Scenario,
  solution: LpSolution
): OptimizationPlan {
  const value = (name: string) => solution.values.get(name) ?? 0;
  const paddedName = (prefix: string, hour: number) =>
    `${prefix}_${padded(hour)}`;

  const hourly: HourlyPlanEntry[] = [];
  for (const hour of HOURLY) {
    const entry = scenario.hours[hour];
    if (!entry) {
      continue;
    }
    const grid = value(paddedName("grid", hour));
    const solar = value(paddedName("solar", hour));
    const charge = value(paddedName("charge", hour));
    const discharge = value(paddedName("discharge", hour));
    hourly.push({
      battery_charge_kwh: charge,
      battery_discharge_kwh: discharge,
      battery_energy_kwh: value(paddedName("battery", hour)),
      demand_kwh: entry.demand_kwh,
      grid_cost_bdt: grid * entry.tariff_bdt_per_kwh,
      grid_kwh: grid,
      hour: entry.hour,
      solar_used_kwh: solar,
    });
  }

  const totalGrid = hourly.reduce((sum, entry) => sum + entry.grid_kwh, 0);
  const totalCost = hourly.reduce((sum, entry) => sum + entry.grid_cost_bdt, 0);
  const peakGrid = hourly.reduce(
    (max, entry) => Math.max(max, entry.grid_kwh),
    0
  );
  const demand = hourly.reduce((sum, entry) => sum + entry.demand_kwh, 0);
  const solarAvailable = scenario.hours.reduce(
    (sum, entry) => sum + entry.solar_kwh,
    0
  );
  const solarUsed = hourly.reduce(
    (sum, entry) => sum + entry.solar_used_kwh,
    0
  );
  const batteryEnergies = hourly.map((entry) => entry.battery_energy_kwh);
  const startBattery = batteryEnergies[0] ?? 0;
  const finalBattery = batteryEnergies.at(-1) ?? 0;

  return {
    hourly_plan: hourly,
    peak_grid_kwh: roundMoney(peakGrid),
    plan_summary: {
      final_battery_energy_kwh: roundMoney(finalBattery),
      minimum_battery_energy_kwh: roundMoney(Math.min(...batteryEnergies)),
      peak_battery_energy_kwh: roundMoney(Math.max(0, ...batteryEnergies)),
      start_battery_energy_kwh: roundMoney(startBattery),
      total_battery_charge_kwh: roundMoney(
        hourly.reduce((sum, entry) => sum + entry.battery_charge_kwh, 0)
      ),
      total_battery_discharge_kwh: roundMoney(
        hourly.reduce((sum, entry) => sum + entry.battery_discharge_kwh, 0)
      ),
      total_demand_kwh: roundMoney(demand),
      total_solar_available_kwh: roundMoney(solarAvailable),
      total_solar_used_kwh: roundMoney(solarUsed),
    },
    scenario_id: scenario.scenario_id,
    total_cost_bdt: roundMoney(totalCost),
    total_grid_kwh: roundMoney(totalGrid),
  };
}

function roundMoney(value: number): number {
  if (Math.abs(value) < 1e-9) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

export function createEnergyOptimizer(solver: EnergySolver): EnergyOptimizer {
  return {
    async optimize(input: OptimizeInput): Promise<OptimizeResult> {
      const { scenario, normalized } = input;

      const scenarioCheck = validateScenario(scenario);
      if (!scenarioCheck.ok) {
        throw new DirectiveValidationError(
          `Scenario is invalid: ${scenarioCheck.failures.map((f) => f.message).join("; ")}`,
          scenarioCheck.failures
        );
      }

      const model = buildOptimizationLp(scenario, normalized);
      const solution = await solver.solve(model);

      return {
        normalized,
        plan: planFromSolution(scenario, solution),
      };
    },
    solver,
  };
}

export async function optimize(
  scenario: Scenario,
  normalized: NormalizedDirectives
): Promise<OptimizationPlan> {
  const optimizer = createEnergyOptimizer(await createEnergySolver());
  return (await optimizer.optimize({ normalized, scenario })).plan;
}
