// Domain model barrel — re-exports every public type from the energy domain.
// Import as: import type { Scenario, DirectiveInterpretation, ... } from "@repo/energy/domain"

export type {
  DirectiveInterpretation,
  DirectiveInterpretationList,
  DirectiveType,
  MaxGridWindowAdjustment,
  MaxGridWindowInterpretation,
  MinimumBatteryReserveAdjustment,
  MinimumBatteryReserveInterpretation,
  NoChargeWindowAdjustment,
  NoChargeWindowInterpretation,
  NoDischargeWindowAdjustment,
  NoDischargeWindowInterpretation,
  NoOpInterpretation,
  SolarReductionAdjustment,
  SolarReductionInterpretation,
} from "./directive.ts";
export { DIRECTIVE_TYPES } from "./directive.ts";
export type {
  BatteryAction,
  HourlyPlanEntry,
  OptimizationPlan,
  OptimizationResponse,
} from "./plan.ts";
export type {
  Battery,
  Hour,
  Scenario,
} from "./scenario.ts";
