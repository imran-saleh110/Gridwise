import { DIRECTIVE_TYPES } from "../domain/directive.ts";
import type { Scenario } from "../domain/scenario.ts";

/**
 * Prompt builders for the LLM directive interpreter (Grok / any
 * OpenAI-compatible Chat Completions provider).
 *
 * The system prompt fixes the interpretation contract; the user prompt gives
 * the model exactly one operator note plus the scenario context it needs
 * (battery capacity for percentage reserves, the hour table, the target
 * note_index). The model never performs optimization — it only extracts one
 * structured directive per note.
 */

const DIRECTIVE_SEMANTICS = `1. solar_reduction — Reduce the usable solar generation for specific hours.
   structured_adjustment.hours: the hours the reduction applies to.
   structured_adjustment.factor: the FRACTION of forecast solar that remains usable (0..1).
   CRITICAL: "factor" is the remaining usable fraction, NOT the reduction percentage.
   "80% reduction" -> factor = 0.2; "usable solar ~25%" -> 0.25; "about half" -> 0.5.
2. minimum_battery_reserve — Force the battery to stay at or above a minimum energy in specific hours.
   structured_adjustment.hours: the hours the reserve applies to.
   structured_adjustment.minimum_energy_kwh: the minimum battery energy in kWh at the END of each listed hour.
   Percentages are relative to the battery's capacity_kwh. Example: capacity 200 kWh, "keep at least 50% stored in the battery" -> minimum_energy_kwh = 100.
3. no_charge_window — Forbid battery charging during specific hours.
   structured_adjustment.hours: hours during which the battery must NOT charge.
4. no_discharge_window — Forbid battery discharging during specific hours.
   structured_adjustment.hours: hours during which the battery must NOT discharge.
5. max_grid_window — Cap the grid import for specific hours.
   structured_adjustment.hours: the hours the cap applies to.
   structured_adjustment.max_grid_kwh: the maximum grid import (kWh) allowed in EACH listed hour.
6. no_op — The note does not affect today's 24-hour energy schedule.
   applies must be false and structured_adjustment must be null.`;

const SYSTEM_RULES = `RULES:
- Output exactly ONE directive for the given operator note.
- If a note has no effect on today's 24-hour energy schedule (e.g. it mentions deadlines, registrations, events on other days, office announcements, or anything not touching demand, solar, grid, charging, or discharging today), output "no_op" with "applies": false and "structured_adjustment": null.
- NEVER invent directive types outside the six supported types.
- NEVER create directives that modify demand, tariffs, or battery parameters (capacity, size, rate limits, etc.).
- Time windows use the 24-hour clock with hours 0..23. Windows are START-INCLUSIVE and END-EXCLUSIVE: "from X until Y" covers hours X, X+1, ..., Y-1. Convert 12-hour times correctly (AM/PM; noon = 12, midnight = 0). Examples: "6 PM until 9 PM" -> [18, 19, 20]; "from 2 AM until 5 AM" -> [2, 3, 4]; "from noon until 2 PM" -> [12, 13].
- "hours" must be a non-empty array of unique integers, sorted ascending, each in 0..23.
- Every directive except "no_op" must have "applies": true and a structured_adjustment OBJECT (never null).
- "no_op" must have "applies": false and "structured_adjustment": null.
- structured_adjustment must contain ONLY the fields belonging to the chosen directive type.
- "explanation": one concise English sentence describing what you extracted. No extra commentary.
- The model does NOT perform energy optimization. It only interprets language into a machine-checkable directive.`;

/**
 * System prompt describing the directive contract. Constant for every request.
 */
export function buildSystemPrompt(): string {
  return `You are the directive interpreter for GridWise, a campus microgrid energy-optimization system. You convert ONE campus operator note into exactly ONE machine-checkable JSON directive that a deterministic optimizer will later enforce.

SUPPORTED DIRECTIVE TYPES (the only six; never invent others):
${DIRECTIVE_SEMANTICS}

${SYSTEM_RULES}`;
}

/**
 * Builds the per-note user message: the operator note, the scenario context
 * (battery + 24-hour table) and the note's index, which must be echoed back.
 */
export function buildUserPrompt(
  note: string,
  noteIndex: number,
  totalNotes: number,
  scenario: Scenario
): string {
  const hoursTable = scenario.hours
    .map(
      (h) =>
        `${h.hour} | demand ${h.demand_kwh} | solar ${h.solar_kwh} | tariff ${h.tariff_bdt_per_kwh}`
    )
    .join("\n");

  const b = scenario.battery;

  return `Operator note ${noteIndex + 1} of ${totalNotes}:
"""${note}"""

Interpret ONLY this note for today's 24-hour energy schedule. The other notes must be ignored.

Scenario "${scenario.scenario_id}".
Battery: capacity_kwh=${b.capacity_kwh}, initial_energy_kwh=${b.initial_energy_kwh}, minimum_energy_kwh=${b.minimum_energy_kwh}, max_charge_kwh_per_hour=${b.max_charge_kwh_per_hour}, max_discharge_kwh_per_hour=${b.max_discharge_kwh_per_hour}.

24-hour table (hour | demand_kwh | solar_kwh | tariff_bdt_per_kwh):
${hoursTable}

Return exactly ONE directive interpretation JSON object matching the schema. Set the "note_index" field to ${noteIndex}. No markdown fences, no extra text.`;
}

/**
 * Prompt fragment for tests/docs: every supported directive type, comma separated.
 */
export function supportedDirectivesText(): string {
  return DIRECTIVE_TYPES.join(", ");
}
