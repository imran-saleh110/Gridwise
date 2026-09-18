import { z } from "zod";
import type { DirectiveInterpretation } from "../domain/directive.ts";
import { DIRECTIVE_TYPES } from "../domain/directive.ts";

/**
 * Structured-output schema (JSON Schema) and deterministic parser for the
 * directive interpreter.
 *
 * Two layers with different jobs:
 *   1. `buildDirectiveInterpretationJSONSchema` is sent to the LLM provider as
 *      the `response_format` JSON schema. It is deliberately permissive on the
 *      adjustment shape so strict-mode providers (Grok / OpenAI) accept it.
 *   2. `directiveInterpretationSchema` (Zod) is the authoritative gate: it
 *      re-validates the raw LLM text against the exact discriminated union and
 *      rejects anything malformed, so the model can never bypass the six
 *      directive types or their invariants.
 */

function isSortedUniqueHours(hours: readonly unknown[]): boolean {
  let previous = -1;
  for (const hour of hours) {
    if (typeof hour !== "number" || !Number.isInteger(hour)) {
      return false;
    }
    if (hour < 0 || hour > 23 || hour <= previous) {
      return false;
    }
    previous = hour;
  }
  return true;
}

const hoursSchema = z
  .array(z.number().int().min(0).max(23))
  .min(1, { message: "hours must not be empty" })
  .refine(isSortedUniqueHours, {
    message: "hours must be unique integers in 0..23, sorted ascending",
  });

const baseFields = {
  explanation: z.string().min(1),
  note_index: z.number().int().min(0),
} as const;

const solarReductionSchema = z
  .object({
    ...baseFields,
    applies: z.literal(true),
    directive_type: z.literal("solar_reduction"),
    structured_adjustment: z
      .object({
        factor: z.number().min(0).max(1),
        hours: hoursSchema,
      })
      .strict(),
  })
  .strict();

const minimumBatteryReserveSchema = z
  .object({
    ...baseFields,
    applies: z.literal(true),
    directive_type: z.literal("minimum_battery_reserve"),
    structured_adjustment: z
      .object({
        hours: hoursSchema,
        minimum_energy_kwh: z.number().nonnegative(),
      })
      .strict(),
  })
  .strict();

const noChargeWindowSchema = z
  .object({
    ...baseFields,
    applies: z.literal(true),
    directive_type: z.literal("no_charge_window"),
    structured_adjustment: z.object({ hours: hoursSchema }).strict(),
  })
  .strict();

const noDischargeWindowSchema = z
  .object({
    ...baseFields,
    applies: z.literal(true),
    directive_type: z.literal("no_discharge_window"),
    structured_adjustment: z.object({ hours: hoursSchema }).strict(),
  })
  .strict();

const maxGridWindowSchema = z
  .object({
    ...baseFields,
    applies: z.literal(true),
    directive_type: z.literal("max_grid_window"),
    structured_adjustment: z
      .object({
        hours: hoursSchema,
        max_grid_kwh: z.number().nonnegative(),
      })
      .strict(),
  })
  .strict();

const noOpSchema = z
  .object({
    ...baseFields,
    applies: z.literal(false),
    directive_type: z.literal("no_op"),
    structured_adjustment: z.null(),
  })
  .strict();

/**
 * Authoritative Zod schema for one LLM-produced directive interpretation.
 * Enforces the discriminated union and its invariants:
 *   - no_op: applies false, structured_adjustment null
 *   - every other directive: applies true, exact structured_adjustment shape
 *   - hours unique, ascending, non-empty, within 0..23
 */
export const directiveInterpretationSchema = z.discriminatedUnion(
  "directive_type",
  [
    solarReductionSchema,
    minimumBatteryReserveSchema,
    noChargeWindowSchema,
    noDischargeWindowSchema,
    maxGridWindowSchema,
    noOpSchema,
  ]
);

/**
 * JSON Schema sent to the LLM provider's strict structured-output mode.
 * The adjustment object keeps all candidate fields optional to avoid strict-mode
 * router ambiguity; the Zod layer above enforces the exact per-directive shape.
 */
export function buildDirectiveInterpretationJSONSchema(): Record<
  string,
  unknown
> {
  return {
    additionalProperties: false,
    properties: {
      applies: { type: "boolean" },
      directive_type: { enum: [...DIRECTIVE_TYPES], type: "string" },
      explanation: { type: "string" },
      note_index: { minimum: 0, type: "integer" },
      structured_adjustment: {
        anyOf: [
          { type: "null" },
          {
            additionalProperties: false,
            properties: {
              factor: { maximum: 1, minimum: 0, type: "number" },
              hours: {
                items: { maximum: 23, minimum: 0, type: "integer" },
                type: "array",
              },
              max_grid_kwh: { minimum: 0, type: "number" },
              minimum_energy_kwh: { minimum: 0, type: "number" },
            },
            type: "object",
          },
        ],
      },
    },
    required: [
      "note_index",
      "directive_type",
      "applies",
      "structured_adjustment",
      "explanation",
    ],
    type: "object",
  };
}

/**
 * Parses and validates raw LLM completion text into a DirectiveInterpretation.
 * Returns null when the text is not valid JSON or violates the directive
 * contract, signalling a retryable "malformed output".
 */
export function parseDirectiveInterpretationOutput(
  contentText: string | null
): DirectiveInterpretation | null {
  if (typeof contentText !== "string" || contentText.trim() === "") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contentText);
  } catch {
    return null;
  }

  const result = directiveInterpretationSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
