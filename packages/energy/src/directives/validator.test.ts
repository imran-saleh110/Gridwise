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
  factor = 0.5,
  hours: readonly number[] = [0, 1]
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
  minimum_energy_kwh: number
): DirectiveInterpretation {
  return {
    applies: true as const,
    directive_type: "minimum_battery_reserve" as const,
    explanation: "",
    note_index,
    structured_adjustment: {
      hours: [0, 1],
      minimum_energy_kwh,
    },
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

function noOp(note_index: number): DirectiveInterpretation {
  return {
    applies: false as const,
    directive_type: "no_op" as const,
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
      interpretations: [solar(0), chargeWindow(1, [10, 11]), noOp(2)],
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
    const interpretation = {
      ...noOp(0),
      applies: true,
    } as unknown as DirectiveInterpretation;
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
        hours: [0, 1],
      } as unknown as null,
    } as unknown as DirectiveInterpretation;
    const result = validateDirectiveInterpretations({
      interpretations: [interpretation],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("no_op_has_adjustment");
  });

  test("rejects an applied directive without an adjustment", () => {
    const interpretation = {
      ...solar(0),
      structured_adjustment: null,
    } as unknown as DirectiveInterpretation;
    const result = validateDirectiveInterpretations({
      interpretations: [interpretation],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("non_no_op_missing_adjustment");
  });

  test("rejects non-integer hours", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [chargeWindow(0, [0.5, 2] as unknown as number[])],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("non_integer_hour");
  });

  test("rejects hours outside [0,23]", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [chargeWindow(0, [22, 24])],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("hour_out_of_bounds");
  });

  test("rejects an empty hours list", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [chargeWindow(0, [])],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("empty_directive_hours");
  });

  test("rejects duplicate hours", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [chargeWindow(0, [3, 3])],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("duplicate_hour");
  });

  test("rejects hours that are not ascending", () => {
    const result = validateDirectiveInterpretations({
      interpretations: [chargeWindow(0, [5, 4])],
      scenario: makeScenario(1),
    });
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain("non_ascending_hours");
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

  test("rejects a negative grid limit", () => {
    const interpretation: DirectiveInterpretation = {
      applies: true,
      directive_type: "max_grid_window",
      explanation: "",
      note_index: 0,
      structured_adjustment: {
        hours: [0, 1],
        max_grid_kwh: -1,
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
    const inactiveSolar = {
      ...solar(0, 99),
      applies: false,
    } as unknown as DirectiveInterpretation;
    const inactiveCharge = {
      applies: false,
      directive_type: "no_charge_window",
      explanation: "",
      note_index: 1,
      structured_adjustment: { hours: [8] },
    } as unknown as DirectiveInterpretation;
    const result = validateDirectiveInterpretations({
      interpretations: [inactiveSolar, inactiveCharge],
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
