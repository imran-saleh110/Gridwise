import { describe, expect, test } from "bun:test";

import type { DirectiveInterpretation, Scenario } from "../index.ts";
import {
  validateDirectiveInterpretations,
  validateScenario,
} from "../index.ts";

function makeScenario(
  noteCount: number,
  overrides: Partial<Scenario> = {}
): Scenario {
  const notes = Array.from(
    { length: noteCount },
    (_, index) => `note ${index}`
  );
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
    operator_notes: notes,
    scenario_id: "s1",
    ...overrides,
  };
}

function solar(
  note_index: number,
  effective_solar_factor = 0.5,
  applies = true
): DirectiveInterpretation {
  return {
    applies,
    directive_type: "solar_reduction",
    explanation: "",
    note_index,
    structured_adjustment: { effective_solar_factor, type: "solar_reduction" },
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

function noOp(note_index: number): DirectiveInterpretation {
  return {
    applies: false,
    directive_type: "no_op",
    explanation: "",
    note_index,
    structured_adjustment: null,
  };
}

function codesOf(result: {
  readonly failures: readonly { readonly code: string }[];
}) {
  return result.failures.map((failure) => failure.code);
}

describe("validateDirectiveInterpretations", () => {
  test("accepts a complete, valid mapping", () => {
    const scenario = makeScenario(3);
    const result = validateDirectiveInterpretations({
      interpretations: [solar(0), chargeWindow(1, 10, 12), noOp(2)],
      scenario,
    });
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  test("rejects when interpretation count does not match note count", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [solar(0), solar(1), solar(2)],
      scenario: makeScenario(2),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("count_mismatch");
  });

  test("rejects duplicate note_index", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [solar(0), solar(0)],
      scenario: makeScenario(2),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("duplicate_note_index");
  });

  test("rejects note_index out of range", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [solar(0), solar(7)],
      scenario: makeScenario(2),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("out_of_range_note_index");
  });

  test("rejects an unknown directive type", () => {
    const bogus = {
      ...solar(0),
      directive_type: "moon_dance",
    } as unknown as DirectiveInterpretation;
    const result = validateDirectiveInterpretations({
      interpretations: [bogus],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("invalid_directive_type");
  });

  test("rejects no_op with applies = true", () => {
    const interpretation = { ...noOp(0), applies: true };
    const result = validateDirectiveInterpretations({
      interpretations: [interpretation],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("no_op_applies");
  });

  test("rejects no_op carrying a structured adjustment", () => {
    const interpretation: DirectiveInterpretation = {
      ...noOp(0),
      structured_adjustment: {
        hour_end: 1,
        hour_start: 0,
        type: "no_charge_window",
      },
    };
    const result = validateDirectiveInterpretations({
      interpretations: [interpretation],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("no_op_has_adjustment");
  });

  test("rejects an applied directive without an adjustment", () => {
    const interpretation = { ...solar(0), structured_adjustment: null };
    const result = validateDirectiveInterpretations({
      interpretations: [interpretation],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("non_no_op_missing_adjustment");
  });

  test("rejects non-integer window hours", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [chargeWindow(0, 0.5, 2)],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("non_integer_hour");
  });

  test("rejects hour windows outside [0,24]", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [chargeWindow(0, 22, 25)],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("hour_out_of_bounds");
  });

  test("rejects an empty or inverted hour window", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [chargeWindow(0, 12, 12)],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("invalid_hour_range");
  });

  test("rejects a solar factor outside [0,1]", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [solar(0, 1.5)],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("solar_factor_out_of_range");
  });

  test("rejects a battery reserve above capacity", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [reserve(0, 11)],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("reserve_out_of_range");
  });

  test("rejects a negative grid import limit", () => {
    const interpretation: DirectiveInterpretation = {
      applies: true,
      directive_type: "max_grid_window",
      explanation: "",
      note_index: 0,
      structured_adjustment: {
        hour_end: 3,
        hour_start: 0,
        max_grid_import_kwh: -1,
        type: "max_grid_window",
      },
    };
    const result = validateDirectiveInterpretations({
      interpretations: [interpretation],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("grid_limit_out_of_range");
  });

  test("ignores inactive directives entirely", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [
        { ...solar(0, 99), applies: false },
        {
          applies: false,
          directive_type: "no_charge_window",
          explanation: "",
          note_index: 1,
          structured_adjustment: {
            hour_end: 4,
            hour_start: 8,
            type: "no_charge_window",
          },
        },
      ],
      scenario: makeScenario(2),
    });
    expect(result.ok).toBe(true);
  });
});

describe("validateScenario", () => {
  test("accepts a well-formed scenario", () => {
    expect(validateScenario(makeScenario(0)).ok).toBe(true);
  });

  test("rejects a scenario without 24 hours", () => {
    const scenario = makeScenario(0);
    const truncated = { ...scenario, hours: scenario.hours.slice(0, 23) };
    expect(codesOf(validateScenario(truncated))).toContain("missing_hours");
  });

  test("rejects duplicate hour indices", () => {
    const scenario = makeScenario(0);
    const hours = scenario.hours.map((entry) =>
      entry.hour === 10 ? { ...entry, hour: 3 } : entry
    );
    const mutated = { ...scenario, hours };
    expect(codesOf(validateScenario(mutated))).toContain("duplicate_hour");
  });

  test("rejects hours that are not ascending", () => {
    const scenario = makeScenario(0);
    const hours = [...scenario.hours].reverse();
    const mutated = { ...scenario, hours };
    expect(codesOf(validateScenario(mutated))).toContain("non_ascending_hours");
  });

  test("rejects hour indices outside [0,23]", () => {
    const scenario = makeScenario(0);
    const mutated = {
      ...scenario,
      hours: scenario.hours.map((entry, index) =>
        index === 0 ? { ...entry, hour: 24 } : entry
      ),
    };
    expect(codesOf(validateScenario(mutated))).toContain("hour_out_of_bounds");
  });

  test("rejects negative demand", () => {
    const mutated = makeScenario(0);
    const hours = mutated.hours.map((entry) =>
      entry.hour === 4 ? { ...entry, demand_kwh: -1 } : entry
    );
    expect(codesOf(validateScenario({ ...mutated, hours }))).toContain(
      "negative_demand"
    );
  });

  test("rejects initial battery energy above capacity", () => {
    const scenario = makeScenario(0);
    const mutated = {
      ...scenario,
      battery: { ...scenario.battery, initial_energy_kwh: 12 },
    };
    expect(codesOf(validateScenario(mutated))).toContain(
      "reserve_out_of_range"
    );
  });
});
