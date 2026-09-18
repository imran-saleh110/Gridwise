/**
 * Directive domain types for the GridWise energy-optimization challenge.
 *
 * The LLM interprets each operator note and produces one DirectiveInterpretation
 * per note. Six directive types are supported; all others are invalid.
 *
 * Source of truth:
 *   - BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json
 *     (allowed_enums.directive_type, interpretation_rules,
 *      directive_interpretation_required_fields)
 *   - docs/roadmap.md Phase 1 (directive discriminated union)
 *
 * Ownership:
 *   - These types are defined by Teammate A (domain contract).
 *   - Teammate B implements the LLM interpreter that produces
 *     DirectiveInterpretation values.
 *   - Teammate C consumes DirectiveInterpretation (after validation) to build
 *     NormalizedDirectives.
 *   - Teammate D uses the interpretation for schedule validation and
 *     visualization.
 */

// ---------------------------------------------------------------------------
// Directive type literals — the only six allowed values
// ---------------------------------------------------------------------------

export type DirectiveType =
  | "solar_reduction"
  | "minimum_battery_reserve"
  | "no_charge_window"
  | "no_discharge_window"
  | "max_grid_window"
  | "no_op";

/** The only six allowed directive types, as a runtime tuple (for prompts, schemas and validators). */
export const DIRECTIVE_TYPES: readonly DirectiveType[] = [
  "solar_reduction",
  "minimum_battery_reserve",
  "no_charge_window",
  "no_discharge_window",
  "max_grid_window",
  "no_op",
] as const;

// ---------------------------------------------------------------------------
// Structured adjustment shapes — one per directive type
//
// Field names and semantics are taken directly from the public sample cases.
// ---------------------------------------------------------------------------

/**
 * Reduces usable solar output for the listed hours.
 * `factor` is the *remaining fraction* of solar (0–1).
 * e.g. "80% reduction" → factor = 0.2
 */
export interface SolarReductionAdjustment {
  /**
   * Usable fraction of forecasted solar that remains available.
   * Must be in [0, 1].
   */
  readonly factor: number;
  /** Hours (0–23, ascending, unique) over which the reduction applies. */
  readonly hours: readonly number[];
}

/**
 * Raises the minimum allowed battery energy for the listed hours.
 */
export interface MinimumBatteryReserveAdjustment {
  /** Hours (0–23, ascending, unique) over which the reserve applies. */
  readonly hours: readonly number[];
  /**
   * The minimum battery energy level (kWh) that must be maintained at the
   * end of each listed hour.
   */
  readonly minimum_energy_kwh: number;
}

/**
 * Forbids battery charging during the listed hours.
 * battery_kwh must be 0 for all listed hours.
 */
export interface NoChargeWindowAdjustment {
  /** Hours (0–23, ascending, unique) during which charging is forbidden. */
  readonly hours: readonly number[];
}

/**
 * Forbids battery discharging during the listed hours.
 * battery_kwh must be 0 for all listed hours when action is discharge.
 */
export interface NoDischargeWindowAdjustment {
  /** Hours (0–23, ascending, unique) during which discharging is forbidden. */
  readonly hours: readonly number[];
}

/**
 * Caps grid import to `max_grid_kwh` for each listed hour.
 */
export interface MaxGridWindowAdjustment {
  /** Hours (0–23, ascending, unique) during which the grid cap applies. */
  readonly hours: readonly number[];
  /** Maximum grid import allowed per hour in the window (kWh). Must be >= 0. */
  readonly max_grid_kwh: number;
}

// ---------------------------------------------------------------------------
// Discriminated union — DirectiveInterpretation
//
// One entry is produced per operator note, in note_index order (0, 1, …, N-1).
//
// Invariants from the challenge specification:
//   - no_op:      applies === false, structured_adjustment === null
//   - all others: applies === true,  structured_adjustment !== null
// ---------------------------------------------------------------------------

interface DirectiveInterpretationBase {
  /**
   * Human-readable explanation of what the LLM extracted from this note.
   * Free-text; wording does not need to match the reference output byte-for-byte.
   */
  readonly explanation: string;
  /**
   * Zero-based index of the operator note this interpretation corresponds to.
   * Must match the note's position in Scenario.operator_notes exactly.
   */
  readonly note_index: number;
}

export interface SolarReductionInterpretation
  extends DirectiveInterpretationBase {
  readonly applies: true;
  readonly directive_type: "solar_reduction";
  readonly structured_adjustment: SolarReductionAdjustment;
}

export interface MinimumBatteryReserveInterpretation
  extends DirectiveInterpretationBase {
  readonly applies: true;
  readonly directive_type: "minimum_battery_reserve";
  readonly structured_adjustment: MinimumBatteryReserveAdjustment;
}

export interface NoChargeWindowInterpretation
  extends DirectiveInterpretationBase {
  readonly applies: true;
  readonly directive_type: "no_charge_window";
  readonly structured_adjustment: NoChargeWindowAdjustment;
}

export interface NoDischargeWindowInterpretation
  extends DirectiveInterpretationBase {
  readonly applies: true;
  readonly directive_type: "no_discharge_window";
  readonly structured_adjustment: NoDischargeWindowAdjustment;
}

export interface MaxGridWindowInterpretation
  extends DirectiveInterpretationBase {
  readonly applies: true;
  readonly directive_type: "max_grid_window";
  readonly structured_adjustment: MaxGridWindowAdjustment;
}

export interface NoOpInterpretation extends DirectiveInterpretationBase {
  readonly applies: false;
  readonly directive_type: "no_op";
  /** Always null for no_op, per the challenge specification. */
  readonly structured_adjustment: null;
}

/**
 * A single directive interpretation produced by the LLM interpreter for one
 * operator note.
 *
 * This is a discriminated union on `directive_type`. TypeScript narrows the
 * `applies` flag and `structured_adjustment` shape automatically based on the
 * `directive_type` discriminant.
 */
export type DirectiveInterpretation =
  | SolarReductionInterpretation
  | MinimumBatteryReserveInterpretation
  | NoChargeWindowInterpretation
  | NoDischargeWindowInterpretation
  | MaxGridWindowInterpretation
  | NoOpInterpretation;

/**
 * The full set of directive interpretations for one scenario.
 * Ordered by note_index (0, 1, …, N-1).
 * Length must equal Scenario.operator_notes.length.
 */
export type DirectiveInterpretationList = readonly DirectiveInterpretation[];
