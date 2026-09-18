import type { Hour, Scenario } from "../domain/scenario.ts";
import type {
  DirectiveAdjustment,
  DirectiveInterpretation,
  DirectiveValidationFailure,
  DirectiveValidationFailureCode,
  DirectiveValidationResult,
} from "./directive.ts";

const ACTIVE_DIRECTIVE_KINDS = new Set([
  "solar_reduction",
  "minimum_battery_reserve",
  "no_charge_window",
  "no_discharge_window",
  "max_grid_window",
]);

function failure(
  code: DirectiveValidationFailureCode,
  message: string,
  note_index: number | null = null
): DirectiveValidationFailure {
  return { code, message, note_index };
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function checkNoteCoverage(
  interpretations: readonly DirectiveInterpretation[],
  notesCount: number
) {
  if (interpretations.length !== notesCount) {
    return [
      failure(
        "count_mismatch",
        `Expected exactly ${notesCount} interpretations (one per operator note), got ${interpretations.length}.`
      ),
    ];
  }
  return [];
}

type WindowAdjustment = Extract<
  DirectiveAdjustment,
  { readonly hour_start: number; readonly hour_end: number }
>;

function checkWindow(
  interpretation: DirectiveInterpretation,
  adjustment: WindowAdjustment
) {
  const { hour_start: start, hour_end: end } = adjustment;
  if (!(isInteger(start) && isInteger(end))) {
    return failure(
      "non_integer_hour",
      `Hours must be integers, got [${String(start)}, ${String(end)}).`,
      interpretation.note_index
    );
  }
  if (start < 0 || start > 23 || end < 1 || end > 24) {
    return failure(
      "hour_out_of_bounds",
      `Hour window [${start}, ${end}) must satisfy 0 <= start <= 23 and 1 <= end <= 24.`,
      interpretation.note_index
    );
  }
  if (start >= end) {
    return failure(
      "invalid_hour_range",
      `Hour window must satisfy start < end, got [${start}, ${end}).`,
      interpretation.note_index
    );
  }
  return null;
}

function windowFailures(
  interpretation: DirectiveInterpretation,
  adjustment: WindowAdjustment
): DirectiveValidationFailure[] {
  const check = checkWindow(interpretation, adjustment);
  return check ? [check] : [];
}

function validateSolarReduction(
  interpretation: DirectiveInterpretation,
  adjustment: DirectiveAdjustment
): DirectiveValidationFailure[] {
  const factor = (
    adjustment as Extract<
      DirectiveAdjustment,
      { readonly effective_solar_factor: number }
    >
  ).effective_solar_factor;
  if (factor < 0 || factor > 1) {
    return [
      failure(
        "solar_factor_out_of_range",
        `Effective solar factor must be within [0, 1], got ${factor}.`,
        interpretation.note_index
      ),
    ];
  }
  return [];
}

function validateBatteryReserve(
  interpretation: DirectiveInterpretation,
  adjustment: DirectiveAdjustment,
  capacityKwh: number
): DirectiveValidationFailure[] {
  const reserve = (
    adjustment as Extract<
      DirectiveAdjustment,
      { readonly minimum_reserve_kwh: number }
    >
  ).minimum_reserve_kwh;
  if (reserve < 0 || reserve > capacityKwh) {
    return [
      failure(
        "reserve_out_of_range",
        `Minimum battery reserve must be within [0, ${capacityKwh}] kWh, got ${reserve}.`,
        interpretation.note_index
      ),
    ];
  }
  return [];
}

function validateGridWindow(
  interpretation: DirectiveInterpretation,
  adjustment: DirectiveAdjustment
): DirectiveValidationFailure[] {
  const failures = windowFailures(
    interpretation,
    adjustment as WindowAdjustment
  );
  if (failures.length > 0) {
    return failures;
  }
  const limit = (
    adjustment as Extract<
      DirectiveAdjustment,
      { readonly max_grid_import_kwh: number }
    >
  ).max_grid_import_kwh;
  if (limit < 0) {
    failures.push(
      failure(
        "grid_limit_out_of_range",
        `Grid import limit must be >= 0, got ${limit}.`,
        interpretation.note_index
      )
    );
  }
  return failures;
}

function validateActiveAdjustment(
  interpretation: DirectiveInterpretation,
  adjustment: DirectiveAdjustment,
  scenario: Scenario
) {
  switch (interpretation.directive_type) {
    case "solar_reduction":
      return validateSolarReduction(interpretation, adjustment);
    case "minimum_battery_reserve":
      return validateBatteryReserve(
        interpretation,
        adjustment,
        scenario.battery.capacity_kwh
      );
    case "no_charge_window":
    case "no_discharge_window":
      return windowFailures(interpretation, adjustment as WindowAdjustment);
    case "max_grid_window":
      return validateGridWindow(interpretation, adjustment);
    default:
      return [];
  }
}

function validateNoteIndex(
  interpretation: DirectiveInterpretation,
  noteCount: number,
  seen: Set<number>
): DirectiveValidationFailure[] {
  const { note_index } = interpretation;
  if (!isInteger(note_index) || note_index < 0 || note_index >= noteCount) {
    return [
      failure(
        "out_of_range_note_index",
        `note_index ${String(note_index)} is outside [0, ${noteCount}).`,
        isInteger(note_index) ? note_index : null
      ),
    ];
  }
  if (seen.has(note_index)) {
    return [
      failure(
        "duplicate_note_index",
        `note_index ${note_index} appears more than once.`,
        note_index
      ),
    ];
  }
  seen.add(note_index);
  return [];
}

function validateDirectiveRules(
  interpretation: DirectiveInterpretation,
  scenario: Scenario
): DirectiveValidationFailure[] {
  const { note_index, directive_type, applies, structured_adjustment } =
    interpretation;

  if (
    !ACTIVE_DIRECTIVE_KINDS.has(directive_type) &&
    directive_type !== "no_op"
  ) {
    return [
      failure(
        "invalid_directive_type",
        `Unknown directive type "${directive_type}".`,
        note_index
      ),
    ];
  }

  if (directive_type === "no_op") {
    const failures: DirectiveValidationFailure[] = [];
    if (applies) {
      failures.push(
        failure(
          "no_op_applies",
          "A no_op directive must have applies = false.",
          note_index
        )
      );
    }
    if (structured_adjustment !== null) {
      failures.push(
        failure(
          "no_op_has_adjustment",
          "A no_op directive must not carry a structured adjustment.",
          note_index
        )
      );
    }
    return failures;
  }

  if (!applies) {
    return [];
  }

  if (structured_adjustment === null) {
    return [
      failure(
        "non_no_op_missing_adjustment",
        `An applied "${directive_type}" directive must carry a structured adjustment.`,
        note_index
      ),
    ];
  }

  return validateActiveAdjustment(
    interpretation,
    structured_adjustment,
    scenario
  );
}

export function validateDirectiveInterpretations(input: {
  readonly scenario: Scenario;
  readonly interpretations: readonly DirectiveInterpretation[];
}): DirectiveValidationResult {
  const { scenario, interpretations } = input;
  const failures: DirectiveValidationFailure[] = [
    ...checkNoteCoverage(interpretations, scenario.operator_notes.length),
  ];
  if (failures.length > 0) {
    return { failures, ok: false };
  }

  const seen = new Set<number>();
  for (const interpretation of interpretations) {
    failures.push(
      ...validateNoteIndex(interpretation, scenario.operator_notes.length, seen)
    );
  }
  for (const interpretation of interpretations) {
    failures.push(...validateDirectiveRules(interpretation, scenario));
  }

  return {
    failures: [...new Set(failures)],
    ok: failures.length === 0,
  };
}

function validateHourIndex(
  hour: Hour,
  seen: Set<number>,
  previous: number | null,
  failures: DirectiveValidationFailure[]
): number | null {
  if (!isInteger(hour.hour)) {
    failures.push(
      failure("non_integer_hour", "Hour indices must be integers.")
    );
    return previous;
  }
  if (hour.hour < 0 || hour.hour > 23) {
    failures.push(
      failure(
        "hour_out_of_bounds",
        `Hour index ${hour.hour} is outside [0, 23].`
      )
    );
  }
  if (seen.has(hour.hour)) {
    failures.push(
      failure(
        "duplicate_hour",
        `Hour index ${hour.hour} appears more than once.`
      )
    );
  }
  seen.add(hour.hour);
  if (previous !== null && hour.hour <= previous) {
    failures.push(
      failure(
        "non_ascending_hours",
        `Hours must be ascending, got ${previous} then ${hour.hour}.`
      )
    );
  }
  return hour.hour;
}

function validateHourEnergy(
  hour: Hour,
  failures: DirectiveValidationFailure[]
): void {
  if (hour.demand_kwh < 0) {
    failures.push(
      failure("negative_demand", `Hour ${hour.hour} has negative demand.`)
    );
  }
  if (hour.solar_kwh < 0) {
    failures.push(
      failure("negative_solar", `Hour ${hour.hour} has negative solar.`)
    );
  }
  if (hour.tariff_bdt_per_kwh < 0) {
    failures.push(
      failure("negative_tariff", `Hour ${hour.hour} has negative tariff.`)
    );
  }
}

function validateBatteryBounds(
  battery: Scenario["battery"],
  failures: DirectiveValidationFailure[]
): void {
  if (battery.initial_energy_kwh > battery.capacity_kwh) {
    failures.push(
      failure(
        "reserve_out_of_range",
        "Initial battery energy exceeds capacity."
      )
    );
  }
  if (battery.minimum_energy_kwh > battery.capacity_kwh) {
    failures.push(
      failure(
        "reserve_out_of_range",
        "Minimum battery energy exceeds capacity."
      )
    );
  }
}

export function validateScenario(
  scenario: Scenario
): DirectiveValidationResult {
  const failures: DirectiveValidationFailure[] = [];
  const { hours, battery } = scenario;

  if (hours.length !== 24) {
    failures.push(
      failure(
        "missing_hours",
        `Scenario must contain exactly 24 hours, got ${hours.length}.`
      )
    );
    return { failures, ok: false };
  }

  const seen = new Set<number>();
  let previous: number | null = null;
  for (const hour of hours) {
    previous = validateHourIndex(hour, seen, previous, failures);
    validateHourEnergy(hour, failures);
  }
  validateBatteryBounds(battery, failures);

  return {
    failures: [...new Set(failures)],
    ok: failures.length === 0,
  };
}
