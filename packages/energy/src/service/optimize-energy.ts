import type {
  DirectiveInterpretation,
  OptimizationPlan,
  OptimizationResponse,
  Scenario,
} from "../domain/index.ts";
import type { DirectiveInterpreter } from "../interpreter/interpreter.ts";

/**
 * Minimal dependency interface for Teammate C's optimization solver.
 * Takes the scenario and interpreted directives, and solves for the optimal schedule.
 */
export interface EnergyOptimizer {
  optimize: (
    scenario: Scenario,
    directives: readonly DirectiveInterpretation[]
  ) => Promise<OptimizationPlan>;
}

/**
 * Minimal dependency interface for Teammate D's schedule validator.
 * Replays the plan hour-by-hour against physical and operational constraints,
 * throwing ScheduleValidationError on violations or optionally returning
 * the verified/recalculated OptimizationPlan.
 */
export interface ScheduleValidator {
  validate: (
    scenario: Scenario,
    plan: OptimizationPlan,
    directives: readonly DirectiveInterpretation[]
  ) => Promise<OptimizationPlan | undefined>;
}

/**
 * Injectable dependencies for the OptimizeEnergyService orchestration.
 */
export interface OptimizeEnergyServiceDependencies {
  readonly interpreter: DirectiveInterpreter;
  readonly optimizer: EnergyOptimizer;
  readonly validator: ScheduleValidator;
}

/**
 * Application service orchestrating the complete energy optimization pipeline:
 *
 * 1. LLM Directive Interpretation:
 *    Interprets natural-language operator notes into structured directives.
 * 2. Mathematical Optimization:
 *    Solves for the 24-hour cost-minimal energy dispatch schedule.
 * 3. Independent Schedule Validation:
 *    Verifies physical energy balance, battery state dynamics, and constraints.
 * 4. Response Construction:
 *    Formats the final flat challenge output contract.
 *
 * Any domain or operational error (InvalidScenarioError, DirectiveInterpretationError,
 * OptimizationError, ScheduleValidationError, etc.) is propagated without suppression.
 */
export class OptimizeEnergyService {
  private readonly deps: OptimizeEnergyServiceDependencies;

  constructor(deps: OptimizeEnergyServiceDependencies) {
    this.deps = deps;
  }

  async execute(scenario: Scenario): Promise<OptimizationResponse> {
    // Step 1: Interpret operator notes into machine-checkable directives
    const directiveInterpretations = await this.deps.interpreter.interpret(
      scenario.operator_notes,
      scenario
    );

    // Step 2: Solve the 24-hour energy optimization problem
    const rawPlan = await this.deps.optimizer.optimize(
      scenario,
      directiveInterpretations
    );

    // Step 3: Independently validate and verify the schedule
    const validatedPlan =
      (await this.deps.validator.validate(
        scenario,
        rawPlan,
        directiveInterpretations
      )) ?? rawPlan;

    // Step 4: Construct the flat canonical challenge response
    return {
      directive_interpretation: directiveInterpretations,
      hourly_plan: validatedPlan.hourly_plan,
      peak_grid_kwh: validatedPlan.peak_grid_kwh,
      plan_summary: validatedPlan.plan_summary,
      scenario_id: scenario.scenario_id,
      total_cost_bdt: validatedPlan.total_cost_bdt,
      total_grid_kwh: validatedPlan.total_grid_kwh,
    };
  }
}
