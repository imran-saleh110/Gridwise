/**
 * Typed application errors for the GridWise energy optimization domain and API.
 *
 * These error classes are framework-independent and provide:
 * 1. An HTTP status code appropriate for the error condition.
 * 2. A sanitized publicMessage safe to return to API clients.
 * 3. An internal message/cause for server-side logging that never leaks to clients.
 */

export abstract class EnergyAppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
  readonly publicMessage: string;

  constructor(publicMessage: string, internalMessage?: string) {
    super(internalMessage ?? publicMessage);
    this.name = this.constructor.name;
    this.publicMessage = publicMessage;
  }

  /**
   * Serializes the error to a safe public JSON representation
   * suitable for HTTP response envelopes without leaking stack traces or secrets.
   */
  toPublicResponse(): { message: string; status: number; code: string } {
    return {
      code: this.code,
      message: this.publicMessage,
      status: this.status,
    };
  }
}

/**
 * 422 Unprocessable Entity
 * Thrown when the scenario payload fails schema validation, contains invalid hour ranges,
 * impossible battery configurations, or missing required fields.
 */
export class InvalidScenarioError extends EnergyAppError {
  readonly status = 422;
  readonly code = "INVALID_SCENARIO";

  constructor(
    publicMessage = "The provided scenario is invalid or malformed.",
    internalMessage?: string
  ) {
    super(publicMessage, internalMessage);
  }
}

/**
 * 500 Internal Server Error
 * Thrown when the LLM produces an unparseable response, hallucinated directive type,
 * or fails to return one interpretation per operator note.
 */
export class DirectiveInterpretationError extends EnergyAppError {
  readonly status = 500;
  readonly code = "DIRECTIVE_INTERPRETATION_ERROR";

  constructor(
    publicMessage = "Failed to interpret operator directives.",
    internalMessage?: string
  ) {
    super(publicMessage, internalMessage);
  }
}

/**
 * 500 Internal Server Error
 * Thrown when deterministic validation of an interpreted directive fails
 * (e.g. out-of-range hours, invalid factor, or conflicting directives).
 */
export class DirectiveValidationError extends EnergyAppError {
  readonly status = 500;
  readonly code = "DIRECTIVE_VALIDATION_ERROR";

  constructor(
    publicMessage = "The interpreted directive violates domain rules or constraints.",
    internalMessage?: string
  ) {
    super(publicMessage, internalMessage);
  }
}

/**
 * 500 Internal Server Error
 * Thrown when the mathematical optimizer fails to find a feasible solution,
 * exceeds timeout, or encounters numerical instability.
 */
export class OptimizationError extends EnergyAppError {
  readonly status = 500;
  readonly code = "OPTIMIZATION_ERROR";

  constructor(
    publicMessage = "The energy optimization solver failed to generate a feasible schedule.",
    internalMessage?: string
  ) {
    super(publicMessage, internalMessage);
  }
}

/**
 * 500 Internal Server Error
 * Thrown when the independent schedule validator detects physical constraint violations
 * in the solver's output (e.g. energy balance mismatch, battery capacity breach, or end-of-day neutrality violation).
 */
export class ScheduleValidationError extends EnergyAppError {
  readonly status = 500;
  readonly code = "SCHEDULE_VALIDATION_ERROR";

  constructor(
    publicMessage = "The generated optimization schedule failed verification against physical constraints.",
    internalMessage?: string
  ) {
    super(publicMessage, internalMessage);
  }
}

/**
 * 500 Internal Server Error
 * Thrown when network, rate-limit, or authentication errors occur with the LLM provider (e.g. Groq).
 * Ensures API keys, raw request headers, or provider credentials are never leaked.
 */
export class LLMProviderError extends EnergyAppError {
  readonly status = 500;
  readonly code = "LLM_PROVIDER_ERROR";

  constructor(
    publicMessage = "An error occurred while communicating with the language model provider.",
    internalMessage?: string
  ) {
    super(publicMessage, internalMessage);
  }
}
