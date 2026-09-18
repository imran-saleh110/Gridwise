export type OptimizationErrorCode =
  | "INFEASIBLE_MODEL"
  | "UNBOUNDED_MODEL"
  | "SOLVER_FAILED"
  | "INVALID_INPUT";

export class OptimizationError extends Error {
  readonly code: OptimizationErrorCode;

  constructor(
    code: OptimizationErrorCode,
    message: string,
    options?: { readonly cause?: unknown }
  ) {
    super(message, options);
    this.name = "OptimizationError";
    this.code = code;
  }

  static wrap(message: string, cause: unknown): OptimizationError {
    return new OptimizationError("SOLVER_FAILED", message, { cause });
  }
}
