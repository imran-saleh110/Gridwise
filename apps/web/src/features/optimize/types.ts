export type DirectiveType =
  | "solar_reduction"
  | "minimum_battery_reserve"
  | "no_charge_window"
  | "no_discharge_window"
  | "max_grid_window"
  | "no_op";

export type BatteryAction = "charge" | "discharge" | "idle";

export interface SolarReductionAdjustment {
  factor: number;
  hours: number[];
}

export interface MinimumBatteryReserveAdjustment {
  hours: number[];
  minimum_energy_kwh?: number;
  reserve_kwh?: number;
}

export interface NoChargeWindowAdjustment {
  hours: number[];
}

export interface NoDischargeWindowAdjustment {
  hours: number[];
}

export interface MaxGridWindowAdjustment {
  hours: number[];
  max_grid_kwh: number;
}

export type StructuredAdjustment =
  | SolarReductionAdjustment
  | MinimumBatteryReserveAdjustment
  | NoChargeWindowAdjustment
  | NoDischargeWindowAdjustment
  | MaxGridWindowAdjustment
  | null;

export interface DirectiveInterpretation {
  applies: boolean;
  directive_type: DirectiveType;
  explanation: string;
  note_index: number;
  structured_adjustment: StructuredAdjustment;
}

export interface HourInput {
  demand_kwh: number;
  hour: number;
  solar_kwh: number;
  tariff_bdt_per_kwh: number;
}

export interface BatteryConfig {
  capacity_kwh: number;
  initial_energy_kwh: number;
  max_charge_kwh_per_hour: number;
  max_discharge_kwh_per_hour: number;
  minimum_energy_kwh: number;
}

export interface ScenarioInput {
  battery: BatteryConfig;
  hours: HourInput[];
  operator_notes: string[];
  scenario_id: string;
}

export interface HourlyPlanItem {
  battery_action: BatteryAction;
  battery_energy_after_kwh: number;
  battery_kwh: number;
  grid_kwh: number;
  hour: number;
  solar_used_kwh: number;
}

export interface OptimizationResponse {
  directive_interpretation: DirectiveInterpretation[];
  hourly_plan: HourlyPlanItem[];
  peak_grid_kwh: number;
  plan_summary: string;
  scenario_id: string;
  total_cost_bdt: number;
  total_grid_kwh: number;
}

export interface SampleCase {
  expected_output: OptimizationResponse;
  id: string;
  input: ScenarioInput;
  label: string;
  rationale?: string;
}

export interface ValidationCheckItem {
  details: string;
  id: string;
  name: string;
  passed: boolean;
}

export interface ScheduleValidationReport {
  checks: ValidationCheckItem[];
  errors: string[];
  isValid: boolean;
  recalculated: {
    peakGrid: number;
    totalCost: number;
    totalGrid: number;
  };
  toleranceDelta: {
    costDelta: number;
    gridDelta: number;
    peakDelta: number;
  };
  warnings: string[];
}
