import { z } from "zod";

/**
 * Zod schemas for the 6 canonical directive interpretations.
 * Matches `DirectiveInterpretation` domain discriminated union.
 */
export const solarReductionAdjustmentSchema = z.object({
  factor: z.number().min(0).max(1),
  hours: z.array(z.number().int().min(0).max(23)),
});

export const minimumBatteryReserveAdjustmentSchema = z.object({
  hours: z.array(z.number().int().min(0).max(23)),
  minimum_energy_kwh: z.number().nonnegative(),
});

export const noChargeWindowAdjustmentSchema = z.object({
  hours: z.array(z.number().int().min(0).max(23)),
});

export const noDischargeWindowAdjustmentSchema = z.object({
  hours: z.array(z.number().int().min(0).max(23)),
});

export const maxGridWindowAdjustmentSchema = z.object({
  hours: z.array(z.number().int().min(0).max(23)),
  max_grid_kwh: z.number().nonnegative(),
});

export const solarReductionInterpretationSchema = z.object({
  applies: z.literal(true),
  directive_type: z.literal("solar_reduction"),
  explanation: z.string(),
  note_index: z.number().int().min(0),
  structured_adjustment: solarReductionAdjustmentSchema,
});

export const minimumBatteryReserveInterpretationSchema = z.object({
  applies: z.literal(true),
  directive_type: z.literal("minimum_battery_reserve"),
  explanation: z.string(),
  note_index: z.number().int().min(0),
  structured_adjustment: minimumBatteryReserveAdjustmentSchema,
});

export const noChargeWindowInterpretationSchema = z.object({
  applies: z.literal(true),
  directive_type: z.literal("no_charge_window"),
  explanation: z.string(),
  note_index: z.number().int().min(0),
  structured_adjustment: noChargeWindowAdjustmentSchema,
});

export const noDischargeWindowInterpretationSchema = z.object({
  applies: z.literal(true),
  directive_type: z.literal("no_discharge_window"),
  explanation: z.string(),
  note_index: z.number().int().min(0),
  structured_adjustment: noDischargeWindowAdjustmentSchema,
});

export const maxGridWindowInterpretationSchema = z.object({
  applies: z.literal(true),
  directive_type: z.literal("max_grid_window"),
  explanation: z.string(),
  note_index: z.number().int().min(0),
  structured_adjustment: maxGridWindowAdjustmentSchema,
});

export const noOpInterpretationSchema = z.object({
  applies: z.literal(false),
  directive_type: z.literal("no_op"),
  explanation: z.string(),
  note_index: z.number().int().min(0),
  structured_adjustment: z.null(),
});

export const directiveInterpretationSchema = z.discriminatedUnion(
  "directive_type",
  [
    solarReductionInterpretationSchema,
    minimumBatteryReserveInterpretationSchema,
    noChargeWindowInterpretationSchema,
    noDischargeWindowInterpretationSchema,
    maxGridWindowInterpretationSchema,
    noOpInterpretationSchema,
  ]
);

export type DirectiveInterpretationOutput = z.infer<
  typeof directiveInterpretationSchema
>;

/**
 * Battery action enum schema.
 * Matches domain `BatteryAction` type.
 */
export const batteryActionSchema = z.enum(["charge", "discharge", "idle"]);

/**
 * Single hourly plan entry schema.
 * Matches domain `HourlyPlanEntry` interface.
 */
export const hourlyPlanEntrySchema = z.object({
  battery_action: batteryActionSchema,
  battery_energy_after_kwh: z.number().nonnegative(),
  battery_kwh: z.number().nonnegative(),
  grid_kwh: z.number().nonnegative(),
  hour: z.number().int().min(0).max(23),
  solar_used_kwh: z.number().nonnegative(),
});

export type HourlyPlanEntryOutput = z.infer<typeof hourlyPlanEntrySchema>;

/**
 * Plan schema for the 24-hour solver output.
 * Matches domain `OptimizationPlan` interface.
 */
export const optimizationPlanSchema = z.object({
  hourly_plan: z.array(hourlyPlanEntrySchema).length(24),
  peak_grid_kwh: z.number().nonnegative(),
  plan_summary: z.string(),
  total_cost_bdt: z.number(),
  total_grid_kwh: z.number().nonnegative(),
});

export type OptimizationPlanOutput = z.infer<typeof optimizationPlanSchema>;

/**
 * Complete flat challenge response schema for POST /optimize-energy.
 * Matches domain `OptimizationResponse` interface.
 */
export const optimizationResponseSchema = z.object({
  directive_interpretation: z.array(directiveInterpretationSchema),
  hourly_plan: z.array(hourlyPlanEntrySchema).length(24),
  peak_grid_kwh: z.number().nonnegative(),
  plan_summary: z.string(),
  scenario_id: z.string().min(1),
  total_cost_bdt: z.number(),
  total_grid_kwh: z.number().nonnegative(),
});

export type OptimizationResponseOutput = z.infer<
  typeof optimizationResponseSchema
>;
