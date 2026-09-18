import type {
  DirectiveInterpretation,
  DirectiveType,
  NoOpInterpretation,
} from "../domain/directive.ts";
import type { Hour, Scenario } from "../domain/scenario.ts";

// ---------------------------------------------------------------------------
// Validation result types
// ---------------------------------------------------------------------------

export type DirectiveValidationFailureCode =
  | "count_mismatch"
  | "out_of_range_note_index"
  | "duplicate_note_index"
  | "invalid_directive_type"
  | "no_op_applies"
  | "no_op_has_adjustment"
  | "non_no_op_missing_adjustment"
  | "empty_directive_hours"
  | "non_integer_hour"
  | "hour_out_of_bounds"
  | "duplicate_hour"
  | "non_ascending_hours"
  | "solar_factor_out_of_range"
  | "reserve_out_of_range"
  | "grid_limit_out_of_range"
  | "missing_hours"
  | "negative_demand"
  | "negative_solar"
  | "negative_tariff";

export interface DirectiveValidationFailure {
  readonly code: DirectiveValidationFailureCode;
  readonly message: string;
  readonly note_index: number | null;
}

export interface DirectiveValidationResult {
  readonly failures: readonly DirectiveValidationFailure[];
  readonly ok: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function collectUniqueFailures(
  failures: DirectiveValidationFailure[]
): DirectiveValidationFailure[] {
  return [...new Set(failures)];
}

// ---------------------------------------------------------------------------
// Interpretation-level checks
// ---------------------------------------------------------------------------

function validateAdjustmentHours(
  noteIndex: number,
  hours: readonly number[]
): DirectiveValidationFailure[] {
  const failures: DirectiveValidationFailure[] = [];
  if (hours.length === 0) {
    failures.push(
      failure(
        "empty_directive_hours",
        "A directive must list at least one hour.",
        noteIndex
      )
    );
    return failures;
  }

  const seen = new Set<number>();
  let previous = -1;
  for (const hour of hours) {
    if (!isInteger(hour)) {
      failures.push(
        failure(
          "non_integer_hour",
          `Directive hour ${String(hour)} must be an integer.`,
          noteIndex
        )
      );
      continue;
    }
    if (hour < 0 || hour > 23) {
      failures.push(
        failure(
          "hour_out_of_bounds",
          `Directive hour ${hour} must be within [0, 23].`,
          noteIndex
        )
      );
    }
    if (seen.has(hour)) {
      failures.push(
        failure(
          "duplicate_hour",
          `Directive hour ${hour} appears more than once.`,
          noteIndex
        )
      );
    } else {
      seen.add(hour);
      if (hour <= previous) {
        failures.push(
          failure(
            "non_ascending_hours",
            `Directive hours must be ascending, got ${previous} then ${hour}.`,
            noteIndex
          )
        );
      }
    }
    previous = Math.max(previous, hour);
  }
  return failures;
}

type ActiveDirectiveType = Exclude<DirectiveType, "no_op">;

type AppliedInterpretation = Exclude<
  DirectiveInterpretation,
  NoOpInterpretation
>;

const VALID_ACTIVE_DIRECTIVE_TYPES = new Set<ActiveDirectiveType>([
  "solar_reduction",
  "minimum_battery_reserve",
  "no_charge_window",
  "no_discharge_window",
  "max_grid_window",
]);

function validateSolarReductionAdjustment(
  interpretation: AppliedInterpretation
): DirectiveValidationFailure[] {
  if (interpretation.directive_type !== "solar_reduction") {
    return [];
  }
  const adjustment = interpretation.structured_adjustment;
  const failures = validateAdjustmentHours(
    interpretation.note_index,
    adjustment.hours
  );
  if (adjustment.factor < 0 || adjustment.factor > 1) {
    failures.push(
      failure(
        "solar_factor_out_of_range",
        `Solar factor must be within [0, 1], got ${adjustment.factor}.`,
        interpretation.note_index
      )
    );
  }
  return failures;
}

function validateReserveAdjustment(
  interpretation: AppliedInterpretation,
  scenario: Scenario
): DirectiveValidationFailure[] {
  if (interpretation.directive_type !== "minimum_battery_reserve") {
    return [];
  }
  const adjustment = interpretation.structured_adjustment;
  const failures = validateAdjustmentHours(
    interpretation.note_index,
    adjustment.hours
  );
  if (
    adjustment.minimum_energy_kwh < 0 ||
    adjustment.minimum_energy_kwh > scenario.battery.capacity_kwh
  ) {
    failures.push(
      failure(
        "reserve_out_of_range",
        `Reserve must be within [0, ${scenario.battery.capacity_kwh}] kWh, got ${adjustment.minimum_energy_kwh}.`,
        interpretation.note_index
      )
    );
  }
  return failures;
}

function validateWindowAdjustmentHours(
  interpretation: AppliedInterpretation
): DirectiveValidationFailure[] {
  if (
    interpretation.directive_type !== "no_charge_window" &&
    interpretation.directive_type !== "no_discharge_window"
  ) {
    return [];
  }
  return validateAdjustmentHours(
    interpretation.note_index,
    interpretation.structured_adjustment.hours
  );
}

function validateMaxGridWindowAdjustment(
  interpretation: AppliedInterpretation
): DirectiveValidationFailure[] {
  if (interpretation.directive_type !== "max_grid_window") {
    return [];
  }
  const constraint = interpretation.structured_adjustment;
  const failures = validateAdjustmentHours(
    interpretation.note_index,
    constraint.hours
  );
  if (constraint.max_grid_kwh < 0) {
    failures.push(
      failure(
        "grid_limit_out_of_range",
        `Grid limit must be >= 0, got ${constraint.max_grid_kwh}.`,
        interpretation.note_index
      )
    );
  }
  return failures;
}

const ACTIVE_ADJUSTMENT_VALIDATORS: Record<
  ActiveDirectiveType,
  (
    interpretation: AppliedInterpretation,
    scenario: Scenario
  ) => DirectiveValidationFailure[]
> = {
  max_grid_window: validateMaxGridWindowAdjustment,
  minimum_battery_reserve: validateReserveAdjustment,
  no_charge_window: validateWindowAdjustmentHours,
  no_discharge_window: validateWindowAdjustmentHours,
  solar_reduction: validateSolarReductionAdjustment,
};

function validateActiveAdjustment(
  interpretation: AppliedInterpretation,
  scenario: Scenario
): DirectiveValidationFailure[] {
  return ACTIVE_ADJUSTMENT_VALIDATORS[interpretation.directive_type](
    interpretation,
    scenario
  );
}

function validateNoOpRule(
  interpretation: DirectiveInterpretation
): DirectiveValidationFailure[] {
  const failures: DirectiveValidationFailure[] = [];
  if (interpretation.applies) {
    failures.push(
      failure(
        "no_op_applies",
        "A no_op directive must have applies = false.",
        interpretation.note_index
      )
    );
  }
  if (interpretation.structured_adjustment !== null) {
    failures.push(
      failure(
        "no_op_has_adjustment",
        "A no_op directive must not carry a structured adjustment.",
        interpretation.note_index
      )
    );
  }
  return failures;
}

function validateAppliedShape(
  interpretation: AppliedInterpretation
): DirectiveValidationFailure[] | null {
  if (!interpretation.applies) {
    return [];
  }
  if (interpretation.structured_adjustment === null) {
    return [
      failure(
        "non_no_op_missing_adjustment",
        `An applied "${interpretation.directive_type}" directive must carry a structured adjustment.`,
        interpretation.note_index
      ),
    ];
  }
  return null;
}

function validateDirectiveRules(
  interpretation: DirectiveInterpretation,
  scenario: Scenario
): DirectiveValidationFailure[] {
  if (interpretation.directive_type === "no_op") {
    return validateNoOpRule(interpretation);
  }
  if (!VALID_ACTIVE_DIRECTIVE_TYPES.has(interpretation.directive_type)) {
    return [
      failure(
        "invalid_directive_type",
        `Unknown directive type "${interpretation.directive_type}".`,
        interpretation.note_index
      ),
    ];
  }
  const shapeFailures = validateAppliedShape(interpretation);
  if (shapeFailures) {
    return shapeFailures;
  }
  return validateActiveAdjustment(interpretation, scenario);
}

// ---------------------------------------------------------------------------
// List-level checks
// ---------------------------------------------------------------------------

function checkNoteCoverage(
  interpretations: readonly DirectiveInterpretation[],
  noteCount: number
): DirectiveValidationFailure[] {
  if (interpretations.length !== noteCount) {
    return [
      failure(
        "count_mismatch",
        `Expected exactly ${noteCount} interpretations (one per operator note), got ${interpretations.length}.`
      ),
    ];
  }
  return [];
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
    failures: collectUniqueFailures(failures),
    ok: failures.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Scenario validation
// ---------------------------------------------------------------------------

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
    failures: collectUniqueFailures(failures),
    ok: failures.length === 0,
  };
}
