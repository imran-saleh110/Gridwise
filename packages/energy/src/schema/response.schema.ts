import { z } from "zod";

/**
 * Zod schemas for the 6 canonical directive interpretations.
 * Matches `DirectiveInterpretation` domain discriminated union.
 */
export const solarReductionAdjustmentSchema = z.object({
  hours: z.array(z.number().int().min(0).max(23)),
  factor: z.number().min(0).max(1),
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
  note_index: z.number().int().min(0),
  directive_type: z.literal("solar_reduction"),
  applies: z.literal(true),
  structured_adjustment: solarReductionAdjustmentSchema,
  explanation: z.string(),
});

export const minimumBatteryReserveInterpretationSchema = z.object({
  note_index: z.number().int().min(0),
  directive_type: z.literal("minimum_battery_reserve"),
  applies: z.literal(true),
  structured_adjustment: minimumBatteryReserveAdjustmentSchema,
  explanation: z.string(),
});

export const noChargeWindowInterpretationSchema = z.object({
  note_index: z.number().int().min(0),
  directive_type: z.literal("no_charge_window"),
  applies: z.literal(true),
  structured_adjustment: noChargeWindowAdjustmentSchema,
  explanation: z.string(),
});

export const noDischargeWindowInterpretationSchema = z.object({
  note_index: z.number().int().min(0),
  directive_type: z.literal("no_discharge_window"),
  applies: z.literal(true),
  structured_adjustment: noDischargeWindowAdjustmentSchema,
  explanation: z.string(),
});

export const maxGridWindowInterpretationSchema = z.object({
  note_index: z.number().int().min(0),
  directive_type: z.literal("max_grid_window"),
  applies: z.literal(true),
  structured_adjustment: maxGridWindowAdjustmentSchema,
  explanation: z.string(),
});

export const noOpInterpretationSchema = z.object({
  note_index: z.number().int().min(0),
  directive_type: z.literal("no_op"),
  applies: z.literal(false),
  structured_adjustment: z.null(),
  explanation: z.string(),
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
  ],
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
  hour: z.number().int().min(0).max(23),
  grid_kwh: z.number().nonnegative(),
  solar_used_kwh: z.number().nonnegative(),
  battery_action: batteryActionSchema,
  battery_kwh: z.number().nonnegative(),
  battery_energy_after_kwh: z.number().nonnegative(),
});

export type HourlyPlanEntryOutput = z.infer<typeof hourlyPlanEntrySchema>;

/**
 * Plan schema for the 24-hour solver output.
 * Matches domain `OptimizationPlan` interface.
 */
export const optimizationPlanSchema = z.object({
  hourly_plan: z.array(hourlyPlanEntrySchema).length(24),
  total_grid_kwh: z.number().nonnegative(),
  total_cost_bdt: z.number(),
  peak_grid_kwh: z.number().nonnegative(),
  plan_summary: z.string(),
});

export type OptimizationPlanOutput = z.infer<typeof optimizationPlanSchema>;

/**
 * Complete flat challenge response schema for POST /optimize-energy.
 * Matches domain `OptimizationResponse` interface.
 */
export const optimizationResponseSchema = z.object({
  scenario_id: z.string().min(1),
  directive_interpretation: z.array(directiveInterpretationSchema),
  hourly_plan: z.array(hourlyPlanEntrySchema).length(24),
  total_grid_kwh: z.number().nonnegative(),
  total_cost_bdt: z.number(),
  peak_grid_kwh: z.number().nonnegative(),
  plan_summary: z.string(),
});

export type OptimizationResponseOutput = z.infer<
  typeof optimizationResponseSchema
>;
