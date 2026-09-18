import { describe, expect, test } from "bun:test";

import type {
  DirectiveInterpretation,
  EnergySolver,
  OptimizationPlan,
  Scenario,
} from "../index.ts";
import {
  createEnergyOptimizer,
  createEnergySolver,
  normalizeDirectives,
  OptimizationError,
  validateDirectiveInterpretations,
} from "../index.ts";

function makeScenario(
  noteCount = 0,
  overrides: Partial<Scenario> = {}
): Scenario {
  return {
    battery: {
      capacity_kwh: 10,
      initial_energy_kwh: 5,
      max_charge_kwh_per_hour: 10,
      max_discharge_kwh_per_hour: 10,
      minimum_energy_kwh: 0,
    },
    hours: Array.from({ length: 24 }, (_, hour) => ({
      demand_kwh: 3,
      hour,
      solar_kwh: 0,
      tariff_bdt_per_kwh: 10,
    })),
    operator_notes: Array.from(
      { length: noteCount },
      (_, index) => `note ${index}`
    ),
    scenario_id: "s1",
    ...overrides,
  };
}

let solverPromise: Promise<EnergySolver> | null = null;

function getSolver(): Promise<EnergySolver> {
  solverPromise ??= createEnergySolver();
  return solverPromise;
}

async function runOptimization(
  scenario: Scenario,
  interpretations: readonly DirectiveInterpretation[]
) {
  const check = validateDirectiveInterpretations({ interpretations, scenario });
  expect(
    check.ok,
    check.failures.map((failure) => failure.message).join("; ")
  ).toBe(true);
  const normalized = normalizeDirectives({ interpretations, scenario });
  const optimizer = createEnergyOptimizer(await getSolver());
  const result = await optimizer.optimize({ normalized, scenario });
  return result;
}

function expectBalanced(plan: OptimizationPlan) {
  for (const entry of plan.hourly_plan) {
    const net =
      entry.grid_kwh +
      entry.solar_used_kwh +
      entry.battery_discharge_kwh -
      entry.battery_charge_kwh;
    expect(Math.abs(net - entry.demand_kwh)).toBeLessThanOrEqual(1e-6);
  }
}

function expectEndNeutral(plan: OptimizationPlan, initial: number) {
  expect(
    Math.abs(plan.plan_summary.final_battery_energy_kwh - initial)
  ).toBeLessThanOrEqual(1e-6);
}

function gridWindow(
  hour_start: number,
  hour_end: number,
  limit: number
): DirectiveInterpretation {
  return {
    applies: true,
    directive_type: "max_grid_window",
    explanation: "",
    note_index: 0,
    structured_adjustment: {
      hour_end,
      hour_start,
      max_grid_import_kwh: limit,
      type: "max_grid_window",
    },
  };
}

describe("optimize (end-to-end with HiGHS)", () => {
  test("serves all demand from the grid when there is no solar", async () => {
    const result = await runOptimization(makeScenario(0), []);
    expect(result.plan.total_grid_kwh).toBeCloseTo(72, 2);
    expect(result.plan.total_cost_bdt).toBeCloseTo(720, 2);
    expectBalanced(result.plan);
    expectEndNeutral(result.plan, 5);
  });

  test("consumes free solar first when it covers demand", async () => {
    const scenario = makeScenario(0, {
      battery: {
        capacity_kwh: 10,
        initial_energy_kwh: 5,
        max_charge_kwh_per_hour: 0,
        max_discharge_kwh_per_hour: 0,
        minimum_energy_kwh: 0,
      },
      hours: Array.from({ length: 24 }, (_, hour) => ({
        demand_kwh: 3,
        hour,
        solar_kwh: 5,
        tariff_bdt_per_kwh: 10,
      })),
    });
    const result = await runOptimization(scenario, []);
    expect(result.plan.total_grid_kwh).toBe(0);
    for (const entry of result.plan.hourly_plan) {
      expect(entry.solar_used_kwh).toBe(3);
      expect(entry.battery_energy_kwh).toBe(5);
    }
    expectBalanced(result.plan);
    expectEndNeutral(result.plan, 5);
  });

  test("shifts load out of expensive hours using the battery", async () => {
    const scenario = makeScenario(0, {
      battery: {
        capacity_kwh: 50,
        initial_energy_kwh: 5,
        max_charge_kwh_per_hour: 10,
        max_discharge_kwh_per_hour: 10,
        minimum_energy_kwh: 0,
      },
      hours: Array.from({ length: 24 }, (_, hour) => ({
        demand_kwh: 4,
        hour,
        solar_kwh: 0,
        tariff_bdt_per_kwh: hour < 12 ? 2 : 10,
      })),
    });
    const result = await runOptimization(scenario, []);

    const massiveCost = 12 * 4 * 2 + 12 * 4 * 10;
    expect(result.plan.total_cost_bdt).toBeLessThan(massiveCost);
    expect(result.plan.total_cost_bdt).toBeCloseTo(216, 2);

    const expensiveGrid = result.plan.hourly_plan
      .filter((entry) => entry.hour >= 12)
      .reduce((sum, entry) => sum + entry.grid_kwh, 0);
    expect(Math.abs(expensiveGrid - 3)).toBeLessThanOrEqual(1e-6);

    expectEndNeutral(result.plan, 5);
  });

  test("respects a grid import cap during a window", async () => {
    const scenario = makeScenario(1, {
      hours: Array.from({ length: 24 }, (_, hour) => ({
        demand_kwh: 4,
        hour,
        solar_kwh: 0,
        tariff_bdt_per_kwh: 10,
      })),
    });
    const result = await runOptimization(scenario, [gridWindow(10, 12, 1.5)]);
    for (const entry of result.plan.hourly_plan) {
      if (entry.hour >= 10 && entry.hour < 12) {
        expect(entry.grid_kwh).toBeLessThanOrEqual(1.5 + 1e-6);
      }
    }
    expectEndNeutral(result.plan, 5);
  });

  test("never discharges when discharging is disabled", async () => {
    const scenario = makeScenario(24, {
      hours: Array.from({ length: 24 }, (_, hour) => ({
        demand_kwh: 4,
        hour,
        solar_kwh: 5,
        tariff_bdt_per_kwh: 10,
      })),
    });
    const dischargeBlock = Array.from({ length: 24 }, (_, hour) => ({
      applies: true,
      directive_type: "no_discharge_window",
      explanation: "",
      note_index: hour,
      structured_adjustment: {
        hour_end: hour + 1,
        hour_start: hour,
        type: "no_discharge_window",
      },
    })) as unknown as DirectiveInterpretation[];
    const result = await runOptimization(scenario, dischargeBlock);
    let previousEnergy = result.plan.hourly_plan[0]?.battery_energy_kwh ?? 0;
    for (const entry of result.plan.hourly_plan) {
      expect(entry.battery_discharge_kwh).toBe(0);
      expect(entry.battery_energy_kwh).toBeGreaterThanOrEqual(
        previousEnergy - 1e-6
      );
      previousEnergy = entry.battery_energy_kwh;
    }
  });

  test("throws an INFEASIBLE error when demand cannot be satisfied", async () => {
    const scenario = makeScenario(0, {
      hours: Array.from({ length: 24 }, (_, hour) => ({
        demand_kwh: 3,
        hour,
        solar_kwh: 0,
        tariff_bdt_per_kwh: 10,
      })),
    });
    const noGrid = [
      gridWindow(0, 24, 0),
      ...Array.from({ length: 24 }, (_, hour) => ({
        applies: true,
        directive_type: "no_charge_window",
        explanation: "",
        note_index: hour + 1,
        structured_adjustment: {
          hour_end: hour + 1,
          hour_start: hour,
          type: "no_charge_window",
        },
      })),
      ...Array.from({ length: 24 }, (_, hour) => ({
        applies: true,
        directive_type: "no_discharge_window",
        explanation: "",
        note_index: hour + 25,
        structured_adjustment: {
          hour_end: hour + 1,
          hour_start: hour,
          type: "no_discharge_window",
        },
      })),
    ] as unknown as DirectiveInterpretation[];
    const normalized = normalizeDirectives({
      interpretations: noGrid,
      scenario,
    });
    const optimizer = createEnergyOptimizer(await getSolver());
    const error = await optimizer.optimize({ normalized, scenario }).then(
      () => null,
      (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(OptimizationError);
    expect((error as OptimizationError).code).toBe("INFEASIBLE_MODEL");
  });
});
