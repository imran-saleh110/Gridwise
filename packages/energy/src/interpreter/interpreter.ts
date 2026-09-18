import type { DirectiveInterpretation } from "../domain/directive.ts";
import type { Scenario } from "../domain/scenario.ts";

/**
 * Functional contract for interpreting operator notes.
 */
export type InterpretDirectivesFn = (
  notes: readonly string[],
  scenario: Scenario,
) => Promise<DirectiveInterpretation[]>;

/**
 * Interface for interpreting natural-language operator notes into structured
 * machine-checkable directives.
 *
 * Implemented by Teammate B (e.g. using Groq / LLM provider) and injected
 * into the optimization pipeline. Follows dependency inversion to allow
 * offline test doubles and deterministic fixtures.
 */
export interface DirectiveInterpreter {
  /**
   * Interprets operator notes within the context of the given scenario.
   *
   * @param notes - Array of 1 to 3 non-empty operator notes.
   * @param scenario - The 24-hour scenario context.
   * @returns Exactly one DirectiveInterpretation per note, ordered by note_index (0..N-1).
   */
  interpret(
    notes: readonly string[],
    scenario: Scenario,
  ): Promise<DirectiveInterpretation[]>;
}
