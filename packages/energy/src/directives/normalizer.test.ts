import { describe, expect, test } from "bun:test";

import type { DirectiveInterpretation, Scenario } from "../index.ts";
import { baselineDirectives, normalizeDirectives } from "../index.ts";

function makeScenario(): Scenario {
  return {
    battery: {
      capacity_kwh: 10,
      initial_energy_kwh: 5,
      max_charge_kwh_per_hour: 10,
      max_discharge_kwh_per_hour: 10,
      minimum_energy_kwh: 2,
    },
    hours: Array.from({ length: 24 }, (_, hour) => ({
      demand_kwh: 4,
      hour,
      solar_kwh: 5,
      tariff_bdt_per_kwh: 2,
    })),
    operator_notes: ["a", "b"],
    scenario_id: "s1",
  };
}

function solar(
  note_index: number,
  factor = 0.5,
  applies = true
): DirectiveInterpretation {
  return {
    applies,
    directive_type: "solar_reduction",
    explanation: "",
    note_index,
    structured_adjustment: {
      effective_solar_factor: factor,
      type: "solar_reduction",
    },
  };
}

function reserve(
  note_index: number,
  minimum_reserve_kwh: number
): DirectiveInterpretation {
  return {
    applies: true,
    directive_type: "minimum_battery_reserve",
    explanation: "",
    note_index,
    structured_adjustment: {
      minimum_reserve_kwh,
      type: "minimum_battery_reserve",
    },
  };
}

function chargeWindow(
  note_index: number,
  hour_start: number,
  hour_end: number
): DirectiveInterpretation {
  return {
    applies: true,
    directive_type: "no_charge_window",
    explanation: "",
    note_index,
    structured_adjustment: { hour_end, hour_start, type: "no_charge_window" },
  };
}

function dischargeWindow(
  note_index: number,
  hour_start: number,
  hour_end: number
): DirectiveInterpretation {
  return {
    applies: true,
    directive_type: "no_discharge_window",
    explanation: "",
    note_index,
    structured_adjustment: {
      hour_end,
      hour_start,
      type: "no_discharge_window",
    },
  };
}

function gridWindow(
  note_index: number,
  hour_start: number,
  hour_end: number,
  limit: number
): DirectiveInterpretation {
  return {
    applies: true,
    directive_type: "max_grid_window",
    explanation: "",
    note_index,
    structured_adjustment: {
      hour_end,
      hour_start,
      max_grid_import_kwh: limit,
      type: "max_grid_window",
    },
  };
}

function noOp(note_index: number): DirectiveInterpretation {
  return {
    applies: false,
    directive_type: "no_op",
    explanation: "",
    note_index,
    structured_adjustment: null,
  };
}

describe("normalizeDirectives", () => {
  test("returns baseline values when no interpretations are applied", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({ interpretations: [], scenario });
    expect(result.effective_solar_factor).toEqual(
      Array.from({ length: 24 }, () => 1)
    );
    expect(result.minimum_reserve).toEqual(Array.from({ length: 24 }, () => 2));
    expect(result.charge_allowed).toEqual(
      Array.from({ length: 24 }, () => true)
    );
    expect(result.discharge_allowed).toEqual(
      Array.from({ length: 24 }, () => true)
    );
    expect(result.max_grid_import).toEqual(
      Array.from({ length: 24 }, () => Number.POSITIVE_INFINITY)
    );
  });

  test("applies solar reductions multiplicatively", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [solar(0, 0.5), solar(1, 0.4)],
      scenario,
    });
    expect(result.effective_solar_factor).toEqual(
      Array.from({ length: 24 }, () => 0.2)
    );
  });

  test("ignores an inactive directive", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [{ ...solar(0, 0.25), applies: false }, noOp(1)],
      scenario,
    });
    expect(result.effective_solar_factor.every((factor) => factor === 1)).toBe(
      true
    );
  });

  test("takes the maximum of overlapping battery reserve directives", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [reserve(0, 4), reserve(1, 3)],
      scenario,
    });
    expect(result.minimum_reserve).toEqual(Array.from({ length: 24 }, () => 4));
  });

  test("disables charging in the specified window only", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [chargeWindow(0, 5, 10)],
      scenario,
    });
    expect(result.charge_allowed.slice(0, 5)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(result.charge_allowed.slice(5, 10)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(result.charge_allowed.slice(10)).toEqual(
      Array.from({ length: 14 }, () => true)
    );
  });

  test("disables discharging in the specified window only", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [dischargeWindow(0, 12, 24)],
      scenario,
    });
    expect(result.discharge_allowed.slice(0, 12)).toEqual(
      Array.from({ length: 12 }, () => true)
    );
    expect(result.discharge_allowed.slice(12)).toEqual(
      Array.from({ length: 12 }, () => false)
    );
  });

  test("caps grid imports with overlapping windows", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [gridWindow(0, 0, 24, 8), gridWindow(1, 0, 6, 4)],
      scenario,
    });
    expect(result.max_grid_import.slice(0, 6)).toEqual(
      Array.from({ length: 6 }, () => 4)
    );
    expect(result.max_grid_import.slice(6)).toEqual(
      Array.from({ length: 18 }, () => 8)
    );
  });

  test("baselineDirectives matches normalizeDirectives with no interpretations", () => {
    const scenario = makeScenario();
    expect(baselineDirectives(scenario)).toEqual(
      normalizeDirectives({ interpretations: [], scenario })
    );
  });
});
