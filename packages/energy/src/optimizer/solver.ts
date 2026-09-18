import loadHighs from "highs";

import { OptimizationError } from "../errors/index.ts";

export type LpSense = "Minimize" | "Maximize";

export type LpSolveStatus =
  | "Optimal"
  | "Infeasible"
  | "Unbounded"
  | "TimeLimit"
  | "IterationLimit"
  | "Unknown"
  | "Empty";

export interface LpVariable {
  readonly cost: number;
  readonly lower: number;
  readonly name: string;
  readonly upper: number;
}

export interface LpConstraint {
  readonly coefficients: ReadonlyMap<string, number>;
  readonly lower: number;
  readonly name: string;
  readonly upper: number;
}

export interface LpModel {
  readonly constraints: readonly LpConstraint[];
  readonly sense: LpSense;
  readonly variables: readonly LpVariable[];
}

export interface LpSolution {
  readonly objective: number;
  readonly status: LpSolveStatus;
  readonly values: ReadonlyMap<string, number>;
}

export interface EnergySolver {
  readonly name: string;
  solve: (model: LpModel) => Promise<LpSolution>;
}

type HighsInstance = Awaited<ReturnType<typeof loadHighs>>;

interface HighsLegacyResult {
  readonly Columns: Readonly<Record<string, { readonly Primal?: number }>>;
  readonly ObjectiveValue?: number;
  readonly Status: string;
}

interface LpTerm {
  readonly coefficient: number;
  readonly name: string;
}

const STATUS_MAP: Readonly<Record<string, LpSolveStatus>> = {
  Empty: "Empty",
  Infeasible: "Infeasible",
  IterationLimit: "IterationLimit",
  Optimal: "Optimal",
  TimeLimit: "TimeLimit",
  Unbounded: "Unbounded",
  Unknown: "Unknown",
};

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new OptimizationError(
      `Cannot serialise non-finite number ${String(value)}.`
    );
  }
  return String(Math.round(value * 1e10) / 1e10);
}

function formatTerm(term: LpTerm, first: boolean): string {
  const { coefficient, name } = term;
  if (coefficient < 0) {
    return `- ${formatNumber(-coefficient)} ${name}`;
  }
  return `${first ? "" : "+"} ${formatNumber(coefficient)} ${name}`;
}

function formatExpression(terms: readonly LpTerm[]): string {
  return terms
    .map((term, index) => formatTerm(term, index === 0))
    .join(" ")
    .trim();
}

function formatRow(
  name: string,
  expression: string,
  lower: number,
  upper: number
): string[] {
  if (!(Number.isFinite(lower) || Number.isFinite(upper))) {
    return [];
  }
  const formatted = formatNumber;
  if (Number.isFinite(lower) && Number.isFinite(upper)) {
    if (lower === upper) {
      return [`${name}: ${expression} = ${formatted(lower)}`];
    }
    return [
      `${name}_lower: ${expression} >= ${formatted(lower)}`,
      `${name}_upper: ${expression} <= ${formatted(upper)}`,
    ];
  }
  if (Number.isFinite(lower)) {
    return [`${name}: ${expression} >= ${formatted(lower)}`];
  }
  return [`${name}: ${expression} <= ${formatted(upper)}`];
}

function formatObjective(model: LpModel): string {
  const terms = model.variables.map((variable) => ({
    coefficient: variable.cost,
    name: variable.name,
  }));
  return ` obj: ${formatExpression(terms)}`;
}

function formatConstraintLines(constraint: LpConstraint): string[] {
  const terms = [...constraint.coefficients].map(([name, coefficient]) => ({
    coefficient,
    name,
  }));
  return formatRow(
    constraint.name,
    formatExpression(terms),
    constraint.lower,
    constraint.upper
  );
}

function formatBoundsSection(variable: LpVariable): string {
  const { name, lower, upper } = variable;
  const lowerFinite = Number.isFinite(lower);
  const upperFinite = Number.isFinite(upper);
  if (lowerFinite && upperFinite) {
    return `${formatNumber(lower)} <= ${name} <= ${formatNumber(upper)}`;
  }
  if (lowerFinite) {
    return `${name} >= ${formatNumber(lower)}`;
  }
  if (upperFinite) {
    return `${name} <= ${formatNumber(upper)}`;
  }
  return `${name} free`;
}

function buildLpString(model: LpModel): string {
  const lines: string[] = [];
  lines.push(model.sense === "Maximize" ? "Maximize" : "Minimize");
  lines.push(formatObjective(model));

  if (model.constraints.length > 0) {
    lines.push("Subject To");
    for (const constraint of model.constraints) {
      lines.push(...formatConstraintLines(constraint));
    }
  }

  lines.push("Bounds");
  for (const variable of model.variables) {
    lines.push(formatBoundsSection(variable));
  }

  lines.push("End");
  return lines.join("\n");
}

function roundValue(value: number): number {
  if (Math.abs(value) < 1e-9) {
    return 0;
  }
  return Math.round(value * 1e6) / 1e6;
}

function runHighs(highs: HighsInstance, lpString: string): HighsLegacyResult {
  try {
    return highs.solve(lpString, {
      output_flag: false,
    }) as HighsLegacyResult;
  } catch (error) {
    const optimizationError = new OptimizationError(
      "HiGHS threw while solving the model.",
      String(error)
    );
    optimizationError.cause = error;
    throw optimizationError;
  }
}

function requireOptimal(status: LpSolveStatus, rawStatus: string): void {
  if (status === "Optimal") {
    return;
  }
  if (status === "Infeasible") {
    throw new OptimizationError(
      "The optimization problem is infeasible under the given constraints.",
      `HiGHS reported an infeasible model (status ${rawStatus}).`
    );
  }
  if (status === "Unbounded") {
    throw new OptimizationError(
      "The optimization problem is unbounded.",
      `HiGHS reported an unbounded model (status ${rawStatus}).`
    );
  }
  throw new OptimizationError(
    "The energy optimization solver failed to generate a feasible schedule.",
    `HiGHS finished with status ${rawStatus}.`
  );
}

function extractValues(
  model: LpModel,
  result: HighsLegacyResult
): Map<string, number> {
  const values = new Map<string, number>();
  for (const variable of model.variables) {
    const column = result.Columns[variable.name];
    values.set(variable.name, roundValue(column?.Primal ?? 0));
  }
  return values;
}

function solveWithHiGhs(highs: HighsInstance, model: LpModel): LpSolution {
  const result = runHighs(highs, buildLpString(model));
  const status = STATUS_MAP[result.Status] ?? "Unknown";
  requireOptimal(status, result.Status);
  return {
    objective: roundValue(result.ObjectiveValue ?? 0),
    status,
    values: extractValues(model, result),
  };
}

export async function createHiGhsEnergySolver(): Promise<EnergySolver> {
  const highs = await loadHighs();

  return {
    name: "highs",
    solve: (model: LpModel) => Promise.resolve(solveWithHiGhs(highs, model)),
  };
}

export function createEnergySolver(): Promise<EnergySolver> {
  return createHiGhsEnergySolver();
}
