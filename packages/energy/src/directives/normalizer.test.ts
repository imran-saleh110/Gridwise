import { describe, expect, test } from "bun:test";

import type { DirectiveInterpretation, Scenario } from "../index.ts";
import { baselineDirectives, normalizeDirectives } from "../index.ts";

const ALL_HOURS = Array.from({ length: 24 }, (_, hour) => hour);

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
  hours: readonly number[] = ALL_HOURS
): DirectiveInterpretation {
  return {
    applies: true as const,
    directive_type: "solar_reduction" as const,
    explanation: "",
    note_index,
    structured_adjustment: { factor, hours: [...hours] },
  };
}

function reserve(
  note_index: number,
  minimum_energy_kwh: number,
  hours: readonly number[] = ALL_HOURS
): DirectiveInterpretation {
  return {
    applies: true as const,
    directive_type: "minimum_battery_reserve" as const,
    explanation: "",
    note_index,
    structured_adjustment: { hours: [...hours], minimum_energy_kwh },
  };
}

function chargeWindow(
  note_index: number,
  hours: readonly number[]
): DirectiveInterpretation {
  return {
    applies: true as const,
    directive_type: "no_charge_window" as const,
    explanation: "",
    note_index,
    structured_adjustment: { hours: [...hours] },
  };
}

function dischargeWindow(
  note_index: number,
  hours: readonly number[]
): DirectiveInterpretation {
  return {
    applies: true as const,
    directive_type: "no_discharge_window" as const,
    explanation: "",
    note_index,
    structured_adjustment: { hours: [...hours] },
  };
}

function gridWindow(
  note_index: number,
  hours: readonly number[],
  limit: number
): DirectiveInterpretation {
  return {
    applies: true as const,
    directive_type: "max_grid_window" as const,
    explanation: "",
    note_index,
    structured_adjustment: { hours: [...hours], max_grid_kwh: limit },
  };
}

function noOp(note_index: number): DirectiveInterpretation {
  return {
    applies: false as const,
    directive_type: "no_op" as const,
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
    expect(result.max_grid_kwh).toEqual(
      Array.from({ length: 24 }, () => Number.POSITIVE_INFINITY)
    );
  });

  test("applies solar reductions only to the listed hours", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [solar(0, 0.5, [4, 5, 6])],
      scenario,
    });
    for (const hour of [4, 5, 6]) {
      expect(result.effective_solar_factor[hour]).toBe(0.5);
    }
    for (const hour of [0, 1, 2, 3, 7, 23]) {
      expect(result.effective_solar_factor[hour]).toBe(1);
    }
  });

  test("combines overlapping solar reductions multiplicatively", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [solar(0, 0.5, ALL_HOURS), solar(1, 0.4, ALL_HOURS)],
      scenario,
    });
    expect(result.effective_solar_factor).toEqual(
      Array.from({ length: 24 }, () => 0.2)
    );
  });

  test("ignores an inactive directive", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [
        {
          ...solar(0, 0.25, ALL_HOURS),
          applies: false,
        } as unknown as DirectiveInterpretation,
        noOp(1),
      ],
      scenario,
    });
    expect(result.effective_solar_factor.every((factor) => factor === 1)).toBe(
      true
    );
  });

  test("takes the maximum of overlapping battery reserve directives", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [reserve(0, 4, ALL_HOURS), reserve(1, 3, ALL_HOURS)],
      scenario,
    });
    expect(result.minimum_reserve).toEqual(Array.from({ length: 24 }, () => 4));
  });

  test("applies a reserve directive only to the listed hours", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [reserve(0, 4, [2, 3])],
      scenario,
    });
    expect(result.minimum_reserve[2]).toBe(4);
    expect(result.minimum_reserve[3]).toBe(4);
    expect(result.minimum_reserve[0]).toBe(2);
    expect(result.minimum_reserve[23]).toBe(2);
  });

  test("disables charging only in the specified hours", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [chargeWindow(0, [5, 6, 7, 8, 9])],
      scenario,
    });
    for (const hour of [5, 6, 7, 8, 9]) {
      expect(result.charge_allowed[hour]).toBe(false);
    }
    for (const hour of [4, 10]) {
      expect(result.charge_allowed[hour]).toBe(true);
    }
  });

  test("disables discharging only in the specified hours", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [dischargeWindow(0, [12, 13, 14, 15])],
      scenario,
    });
    for (const hour of [12, 13, 14, 15]) {
      expect(result.discharge_allowed[hour]).toBe(false);
    }
    for (const hour of [11, 16]) {
      expect(result.discharge_allowed[hour]).toBe(true);
    }
  });

  test("caps grid imports to the tightest overlapping limit", () => {
    const scenario = makeScenario();
    const result = normalizeDirectives({
      interpretations: [
        gridWindow(0, ALL_HOURS, 8),
        gridWindow(1, ALL_HOURS.slice(0, 6), 4),
      ],
      scenario,
    });
    expect(result.max_grid_kwh.slice(0, 6)).toEqual(
      Array.from({ length: 6 }, () => 4)
    );
    expect(result.max_grid_kwh.slice(6)).toEqual(
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
