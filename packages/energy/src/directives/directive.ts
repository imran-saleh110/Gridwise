export type DirectiveKind =
  | "solar_reduction"
  | "minimum_battery_reserve"
  | "no_charge_window"
  | "no_discharge_window"
  | "max_grid_window"
  | "no_op";

export interface SolarReductionAdjustment {
  readonly effective_solar_factor: number;
  readonly type: "solar_reduction";
}

export interface MinimumBatteryReserveAdjustment {
  readonly minimum_reserve_kwh: number;
  readonly type: "minimum_battery_reserve";
}

export interface NoChargeWindowAdjustment {
  readonly hour_end: number;
  readonly hour_start: number;
  readonly type: "no_charge_window";
}

export interface NoDischargeWindowAdjustment {
  readonly hour_end: number;
  readonly hour_start: number;
  readonly type: "no_discharge_window";
}

export interface MaxGridWindowAdjustment {
  readonly hour_end: number;
  readonly hour_start: number;
  readonly max_grid_import_kwh: number;
  readonly type: "max_grid_window";
}

export type DirectiveAdjustment =
  | SolarReductionAdjustment
  | MinimumBatteryReserveAdjustment
  | NoChargeWindowAdjustment
  | NoDischargeWindowAdjustment
  | MaxGridWindowAdjustment;

export interface DirectiveInterpretation {
  readonly applies: boolean;
  readonly directive_type: DirectiveKind;
  readonly explanation: string;
  readonly note_index: number;
  readonly structured_adjustment: DirectiveAdjustment | null;
}

export type DirectiveValidationFailureCode =
  | "count_mismatch"
  | "duplicate_note_index"
  | "out_of_range_note_index"
  | "invalid_directive_type"
  | "no_op_applies"
  | "no_op_has_adjustment"
  | "non_no_op_missing_adjustment"
  | "non_integer_hour"
  | "hour_out_of_bounds"
  | "invalid_hour_range"
  | "solar_factor_out_of_range"
  | "reserve_out_of_range"
  | "grid_limit_out_of_range"
  | "missing_hours"
  | "duplicate_hour"
  | "non_ascending_hours"
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
