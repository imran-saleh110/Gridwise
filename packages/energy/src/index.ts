export type { NormalizedDirectives } from "./directives/normalized.ts";
export {
  baselineDirectives,
  normalizeDirectives,
} from "./directives/normalizer.ts";
export type {
  DirectiveValidationFailure,
  DirectiveValidationFailureCode,
  DirectiveValidationResult,
} from "./directives/validator.ts";
export {
  validateDirectiveInterpretations,
  validateScenario,
} from "./directives/validator.ts";
export type {
  Battery,
  BatteryAction,
  DirectiveInterpretation,
  DirectiveInterpretationList,
  DirectiveType,
  Hour,
  HourlyPlanEntry,
  MaxGridWindowAdjustment,
  MaxGridWindowInterpretation,
  MinimumBatteryReserveAdjustment,
  MinimumBatteryReserveInterpretation,
  NoChargeWindowAdjustment,
  NoChargeWindowInterpretation,
  NoDischargeWindowAdjustment,
  NoDischargeWindowInterpretation,
  NoOpInterpretation,
  OptimizationPlan,
  OptimizationResponse,
  Scenario,
  SolarReductionAdjustment,
  SolarReductionInterpretation,
} from "./domain/index.ts";
export {
  DirectiveInterpretationError,
  DirectiveValidationError,
  EnergyAppError,
  InvalidScenarioError,
  LLMProviderError,
  OptimizationError,
  ScheduleValidationError,
} from "./errors/index.ts";
export type {
  DirectiveInterpreter,
  InterpretDirectivesFn,
} from "./interpreter/index.ts";
export {
  buildOptimizationLp,
  createEnergyOptimizer,
  optimize,
} from "./optimizer/optimizer.ts";
export type {
  EnergySolver,
  LpConstraint,
  LpModel,
  LpSense,
  LpSolution,
  LpSolveStatus,
  LpVariable,
} from "./optimizer/solver.ts";
export {
  createEnergySolver,
  createHiGhsEnergySolver,
} from "./optimizer/solver.ts";
export type {
  BatteryInput,
  DirectiveInterpretationOutput,
  HourInput,
  HourlyPlanEntryOutput,
  OptimizationPlanOutput,
  OptimizationResponseOutput,
  ScenarioInput,
} from "./schema/index.ts";
export {
  batteryActionSchema,
  batterySchema,
  directiveInterpretationSchema,
  hourlyPlanEntrySchema,
  hourSchema,
  maxGridWindowAdjustmentSchema,
  maxGridWindowInterpretationSchema,
  minimumBatteryReserveAdjustmentSchema,
  minimumBatteryReserveInterpretationSchema,
  noChargeWindowAdjustmentSchema,
  noChargeWindowInterpretationSchema,
  noDischargeWindowAdjustmentSchema,
  noDischargeWindowInterpretationSchema,
  noOpInterpretationSchema,
  optimizationPlanSchema,
  optimizationResponseSchema,
  scenarioSchema,
  solarReductionAdjustmentSchema,
  solarReductionInterpretationSchema,
} from "./schema/index.ts";

export {
  type EnergyOptimizer,
  OptimizeEnergyService,
  type OptimizeEnergyServiceDependencies,
  type ScheduleValidator,
} from "./service/index.ts";
export { IndependentScheduleValidator } from "./validation/index.ts";
