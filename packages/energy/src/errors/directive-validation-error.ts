import type { DirectiveValidationFailure } from "../directives/directive.ts";

export class DirectiveValidationError extends Error {
  readonly failures: readonly DirectiveValidationFailure[];

  constructor(
    message: string,
    failures: readonly DirectiveValidationFailure[]
  ) {
    super(message);
    this.name = "DirectiveValidationError";
    this.failures = failures;
  }
}
