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
  OptimizationError,
} from "../index.ts";

const ALL_HOURS = Array.from({ length: 24 }, (_, hour) => hour);

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
  const optimizer = createEnergyOptimizer(await getSolver());
  return optimizer.optimize(scenario, interpretations);
}

function expectBalanced(plan: OptimizationPlan, scenario: Scenario) {
  const demandOf = (hour: number) =>
    scenario.hours.find((entry) => entry.hour === hour)?.demand_kwh ?? 0;
  for (const entry of plan.hourly_plan) {
    const charge = entry.battery_action === "charge" ? entry.battery_kwh : 0;
    const discharge =
      entry.battery_action === "discharge" ? entry.battery_kwh : 0;
    const net = entry.grid_kwh + entry.solar_used_kwh + discharge - charge;
    expect(Math.abs(net - demandOf(entry.hour))).toBeLessThanOrEqual(1e-6);
  }
}

function expectEndNeutral(plan: OptimizationPlan, initial: number) {
  const final = plan.hourly_plan[23]?.battery_energy_after_kwh;
  expect(Math.abs((final ?? 0) - initial)).toBeLessThanOrEqual(1e-6);
}

function gridWindow(hours: readonly number[], limit: number) {
  return {
    applies: true,
    directive_type: "max_grid_window",
    explanation: "",
    note_index: 0,
    structured_adjustment: { hours: [...hours], max_grid_kwh: limit },
  } as DirectiveInterpretation;
}

function noCharge(hour: number) {
  return {
    applies: true as const,
    directive_type: "no_charge_window" as const,
    explanation: "",
    structured_adjustment: { hours: [hour] },
  };
}

function noDischarge(hour: number) {
  return {
    applies: true as const,
    directive_type: "no_discharge_window" as const,
    explanation: "",
    structured_adjustment: { hours: [hour] },
  };
}

describe("optimize (end-to-end with HiGHS)", () => {
  test("serves all demand from the grid when there is no solar", async () => {
    const scenario = makeScenario(0);
    const plan = await runOptimization(scenario, []);
    expect(plan.total_grid_kwh).toBeCloseTo(72, 2);
    expect(plan.total_cost_bdt).toBeCloseTo(720, 2);
    expect(typeof plan.plan_summary).toBe("string");
    expectBalanced(plan, scenario);
    expectEndNeutral(plan, 5);
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
    const plan = await runOptimization(scenario, []);
    expect(plan.total_grid_kwh).toBe(0);
    for (const entry of plan.hourly_plan) {
      expect(entry.solar_used_kwh).toBe(3);
      expect(entry.battery_energy_after_kwh).toBe(5);
      expect(entry.battery_action).toBe("idle");
    }
    expectBalanced(plan, scenario);
    expectEndNeutral(plan, 5);
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
    const plan = await runOptimization(scenario, []);

    const massiveCost = 12 * 4 * 2 + 12 * 4 * 10;
    expect(plan.total_cost_bdt).toBeLessThan(massiveCost);
    expect(plan.total_cost_bdt).toBeCloseTo(216, 2);

    const expensiveGrid = plan.hourly_plan
      .filter((entry) => entry.hour >= 12)
      .reduce((sum, entry) => sum + entry.grid_kwh, 0);
    expect(Math.abs(expensiveGrid - 3)).toBeLessThanOrEqual(1e-6);

    expectEndNeutral(plan, 5);
  });

  test("respects a grid import cap during listed hours", async () => {
    const scenario = makeScenario(1, {
      hours: Array.from({ length: 24 }, (_, hour) => ({
        demand_kwh: 4,
        hour,
        solar_kwh: 0,
        tariff_bdt_per_kwh: 10,
      })),
    });
    const plan = await runOptimization(scenario, [gridWindow([10, 11], 1.5)]);
    for (const entry of plan.hourly_plan) {
      if (entry.hour >= 10 && entry.hour <= 11) {
        expect(entry.grid_kwh).toBeLessThanOrEqual(1.5 + 1e-6);
      }
    }
    expectEndNeutral(plan, 5);
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
    const blocks = Array.from({ length: 24 }, (_, hour) => ({
      ...noDischarge(hour),
      note_index: hour,
    }));
    const plan = await runOptimization(scenario, blocks);
    let previousEnergy = plan.hourly_plan[0]?.battery_energy_after_kwh ?? 0;
    for (const entry of plan.hourly_plan) {
      expect(entry.battery_action).not.toBe("discharge");
      expect(entry.battery_energy_after_kwh).toBeGreaterThanOrEqual(
        previousEnergy - 1e-6
      );
      previousEnergy = entry.battery_energy_after_kwh;
    }
  });

  test("throws an OptimizationError when demand cannot be satisfied", async () => {
    const scenario = makeScenario(49);
    const interpretations: DirectiveInterpretation[] = [
      gridWindow(ALL_HOURS, 0),
      ...Array.from({ length: 24 }, (_, hour) => ({
        ...noCharge(hour),
        note_index: hour + 1,
      })),
      ...Array.from({ length: 24 }, (_, hour) => ({
        ...noDischarge(hour),
        note_index: hour + 25,
      })),
    ];

    const optimizer = createEnergyOptimizer(await getSolver());
    const error = await optimizer.optimize(scenario, interpretations).then(
      () => null,
      (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(OptimizationError);
  });
});
