import {
  InvalidScenarioError,
  isEnergyAppError,
  LLMProviderError,
} from "@repo/energy/errors";
import {
  createLLMDirectiveInterpreter,
  type DirectiveInterpreter,
} from "@repo/energy/interpreter";
import { getLLMConfig } from "@repo/energy/llm";
import {
  createEnergyOptimizer,
  createEnergySolver,
} from "@repo/energy/optimizer";
import { scenarioSchema } from "@repo/energy/schema";
import {
  type EnergyOptimizer,
  OptimizeEnergyService,
  type ScheduleValidator,
} from "@repo/energy/service";
import { IndependentScheduleValidator } from "@repo/energy/validation";
import type { Context } from "hono";
import { Hono } from "hono";

function createProductionInterpreter(): DirectiveInterpreter {
  const config = getLLMConfig();
  if (!(config.GROQ_API_KEY || config.LLM_API_KEY)) {
    return {
      interpret: () =>
        Promise.reject(
          new LLMProviderError(
            "The LLM provider API key is not configured.",
            "GROQ_API_KEY or LLM_API_KEY must be set in the server environment before calling the directive interpreter."
          )
        ),
    };
  }
  return createLLMDirectiveInterpreter({ config });
}

function createProductionOptimizer(): EnergyOptimizer {
  return {
    optimize: async (scenario, directives) => {
      const solver = await createEnergySolver();
      const opt = createEnergyOptimizer(solver);
      return opt.optimize(scenario, directives);
    },
  };
}

const defaultValidator: ScheduleValidator = new IndependentScheduleValidator();

let activeService: OptimizeEnergyService | null = null;

function getActiveService(): OptimizeEnergyService {
  if (activeService) {
    return activeService;
  }
  return new OptimizeEnergyService({
    interpreter: createProductionInterpreter(),
    optimizer: createProductionOptimizer(),
    validator: defaultValidator,
  });
}

/**
 * Injects a concrete OptimizeEnergyService instance (e.g. for testing or custom wiring).
 */
export function setOptimizeEnergyService(service: OptimizeEnergyService): void {
  activeService = service;
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
          code: "MALFORMED_REQUEST",
          message: "Malformed JSON payload in request body.",
          status: 400,
        },
      },
      400
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
    const service = getActiveService();
    const result = await service.execute(scenario);

    // 4. Return flat challenge response contract preserving all 24 hourly entries
    return c.json(
      {
        directive_interpretation: result.directive_interpretation,
        hourly_plan: result.hourly_plan,
        peak_grid_kwh: result.peak_grid_kwh,
        plan_summary: result.plan_summary,
        scenario_id: result.scenario_id,
        total_cost_bdt: result.total_cost_bdt,
        total_grid_kwh: result.total_grid_kwh,
      },
      200
    );
  } catch (err: unknown) {
    if (isEnergyAppError(err)) {
      const pub = err.toPublicResponse();
      return c.json({ error: pub }, pub.status as 422 | 500);
    }

    console.error("[OptimizeEnergy Unexpected Error]", err);
    return c.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error during energy optimization.",
          status: 500,
        },
      },
      500
    );
  }
}

export const optimizeEnergyRoutes = new Hono();

optimizeEnergyRoutes.post("/", handleOptimizeEnergy);
