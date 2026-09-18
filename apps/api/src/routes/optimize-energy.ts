import { Hono } from "hono";
import type { Context } from "hono";
import {
  DirectiveInterpretationError,
  EnergyAppError,
  InvalidScenarioError,
  OptimizationError,
  ScheduleValidationError,
} from "@repo/energy/errors";
import type { DirectiveInterpreter } from "@repo/energy/interpreter";
import { scenarioSchema } from "@repo/energy/schema";
import {
  type EnergyOptimizer,
  OptimizeEnergyService,
  type ScheduleValidator,
} from "@repo/energy/service";

// Default unconfigured dependencies until concrete teammate implementations are wired
const defaultInterpreter: DirectiveInterpreter = {
  async interpret() {
    throw new DirectiveInterpretationError(
      "Directive interpreter is not configured.",
    );
  },
};

const defaultOptimizer: EnergyOptimizer = {
  async optimize() {
    throw new OptimizationError("Energy optimizer is not configured.");
  },
};

const defaultValidator: ScheduleValidator = {
  async validate() {
    throw new ScheduleValidationError("Schedule validator is not configured.");
  },
};

let activeService = new OptimizeEnergyService({
  interpreter: defaultInterpreter,
  optimizer: defaultOptimizer,
  validator: defaultValidator,
});

/**
 * Injects a concrete OptimizeEnergyService instance (e.g. for testing or production wiring).
 */
export function setOptimizeEnergyService(service: OptimizeEnergyService): void {
  activeService = service;
}

export function getOptimizeEnergyService(): OptimizeEnergyService {
  return activeService;
}

/**
 * Route handler for POST /optimize-energy
 */
async function handleOptimizeEnergy(c: Context) {
  // 1. Parse JSON body; map malformed JSON syntax to 400 Bad Request
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json(
      {
        error: {
          message: "Malformed JSON payload in request body.",
          status: 400,
          code: "MALFORMED_REQUEST",
        },
      },
      400,
    );
  }

  // 2. Validate payload against canonical Scenario Zod schema
  const parseResult = scenarioSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const issueSummary = parseResult.error.issues
      .map((issue: { message: string }) => issue.message)
      .join("; ");
    const error = new InvalidScenarioError(`Invalid scenario: ${issueSummary}`);
    return c.json({ error: error.toPublicResponse() }, 422);
  }

  const scenario = parseResult.data;

  // 3. Orchestrate optimization through the service boundary
  try {
    const result = await activeService.execute(scenario);

    // 4. Return flat challenge response contract preserving all 24 hourly entries
    return c.json(
      {
        scenario_id: result.scenario_id,
        directive_interpretation: result.directive_interpretation,
        hourly_plan: result.hourly_plan,
        total_grid_kwh: result.total_grid_kwh,
        total_cost_bdt: result.total_cost_bdt,
        peak_grid_kwh: result.peak_grid_kwh,
        plan_summary: result.plan_summary,
      },
      200,
    );
  } catch (err: unknown) {
    if (err instanceof EnergyAppError) {
      const pub = err.toPublicResponse();
      return c.json(
        { error: pub },
        pub.status as 422 | 500,
      );
    }

    return c.json(
      {
        error: {
          message: "Internal server error during energy optimization.",
          status: 500,
          code: "INTERNAL_SERVER_ERROR",
        },
      },
      500,
    );
  }
}

export const optimizeEnergyRoutes = new Hono();

optimizeEnergyRoutes.post("/", handleOptimizeEnergy);
