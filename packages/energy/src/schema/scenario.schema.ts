import { z } from "zod";

/**
 * Single-hour forecast input schema.
 * Matches domain `Hour` interface.
 */
export const hourSchema = z.object({
  hour: z.number().int().min(0).max(23),
  demand_kwh: z.number().nonnegative(),
  solar_kwh: z.number().nonnegative(),
  tariff_bdt_per_kwh: z.number().nonnegative(),
});

export type HourInput = z.infer<typeof hourSchema>;

/**
 * Battery configuration schema.
 * Matches domain `Battery` interface.
 */
export const batterySchema = z
  .object({
    capacity_kwh: z.number().positive({
      message: "capacity_kwh must be greater than 0",
    }),
    initial_energy_kwh: z.number().nonnegative(),
    minimum_energy_kwh: z.number().nonnegative(),
    max_charge_kwh_per_hour: z.number().nonnegative(),
    max_discharge_kwh_per_hour: z.number().nonnegative(),
  })
  .superRefine((battery, ctx) => {
    if (battery.minimum_energy_kwh > battery.capacity_kwh) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minimum_energy_kwh"],
        message: "minimum_energy_kwh cannot exceed capacity_kwh",
      });
    }
    if (battery.initial_energy_kwh > battery.capacity_kwh) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["initial_energy_kwh"],
        message: "initial_energy_kwh cannot exceed capacity_kwh",
      });
    }
    if (battery.initial_energy_kwh < battery.minimum_energy_kwh) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["initial_energy_kwh"],
        message: "initial_energy_kwh cannot be less than minimum_energy_kwh",
      });
    }
  });

export type BatteryInput = z.infer<typeof batterySchema>;

/**
 * Complete Scenario request schema for POST /optimize-energy.
 * Matches domain `Scenario` interface.
 */
export const scenarioSchema = z.object({
  scenario_id: z.string().trim().min(1, {
    message: "scenario_id must not be empty",
  }),
  operator_notes: z
    .array(
      z.string().trim().min(1, {
        message: "operator note must not be empty",
      }),
    )
    .min(1, { message: "operator_notes must contain between 1 and 3 notes" })
    .max(3, { message: "operator_notes must contain between 1 and 3 notes" }),
  hours: z
    .array(hourSchema)
    .length(24, { message: "hours must contain exactly 24 entries" })
    .superRefine((hours, ctx) => {
      const seenHours = new Set<number>();
      for (let i = 0; i < hours.length; i++) {
        const hour = hours[i]?.hour;
        if (hour !== undefined) {
          if (seenHours.has(hour)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [i, "hour"],
              message: `Duplicate hour index ${hour} found; hours must cover 0..23 uniquely`,
            });
          }
          seenHours.add(hour);
        }
      }
      for (let expected = 0; expected < 24; expected++) {
        if (!seenHours.has(expected)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Missing hour index ${expected}; hours must cover hours 0 through 23`,
          });
        }
      }
    }),
  battery: batterySchema,
});

export type ScenarioInput = z.infer<typeof scenarioSchema>;
