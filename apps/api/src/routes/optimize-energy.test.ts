import { describe, expect, it } from "bun:test";
import type {
  DirectiveInterpretation,
  HourlyPlanEntry,
  OptimizationPlan,
  Scenario,
} from "@repo/energy/domain";
import {
  DirectiveInterpretationError,
  DirectiveValidationError,
  LLMProviderError,
  OptimizationError,
  ScheduleValidationError,
} from "@repo/energy/errors";
import type { DirectiveInterpreter } from "@repo/energy/interpreter";
import {
  type EnergyOptimizer,
  OptimizeEnergyService,
  type ScheduleValidator,
} from "@repo/energy/service";
import { app } from "../app.ts";
import { setOptimizeEnergyService } from "./optimize-energy.ts";

function createValidScenario(): Scenario {
  return {
    battery: {
      capacity_kwh: 200,
      initial_energy_kwh: 80,
      max_charge_kwh_per_hour: 50,
      max_discharge_kwh_per_hour: 50,
      minimum_energy_kwh: 40,
    },
    hours: Array.from({ length: 24 }, (_, i) => ({
      demand_kwh: 120 + i * 2,
      hour: i,
      solar_kwh: i >= 6 && i <= 18 ? 40 + i * 5 : 0,
      tariff_bdt_per_kwh: i >= 17 && i <= 22 ? 12.0 : 6.0,
    })),
    operator_notes: [
      "Solar array will be partially shaded from 10:00 to 14:00.",
      "Sports facility maintenance.",
    ],
    scenario_id: "TEST-SCENARIO-01",
  };
}

function createMockHourlyPlan(): HourlyPlanEntry[] {
  return Array.from({ length: 24 }, (_, i) => {
    let batteryAction: HourlyPlanEntry["battery_action"] = "idle";
    let batteryEnergyAfter = 80;
    if (i === 12) {
      batteryAction = "charge";
      batteryEnergyAfter = 100;
    } else if (i === 19) {
      batteryAction = "discharge";
    }
    return {
      battery_action: batteryAction,
      battery_energy_after_kwh: batteryEnergyAfter,
      battery_kwh: i === 12 || i === 19 ? 20 : 0,
      grid_kwh: 80,
      hour: i,
      solar_used_kwh: 40,
    };
  });
}

describe("POST /optimize-energy API Contract Integration Tests", () => {
  // Requirement 1, 2, 3: Valid request, 200, required fields, exactly 24 hourly entries
  describe("1. Valid request & 24-hour response structure", () => {
    it("returns 200 with the canonical flat challenge response contract containing exactly 24 hourly entries", async () => {
      const mockPlan: OptimizationPlan = {
        hourly_plan: createMockHourlyPlan(),
        peak_grid_kwh: 80,
        plan_summary: "Optimal solar storage during peak tariff hours.",
        total_cost_bdt: 14_400,
        total_grid_kwh: 1920,
      };

      const mockInterpretations: DirectiveInterpretation[] = [
        {
          applies: true,
          directive_type: "solar_reduction",
          explanation: "50% solar reduction due to partial shading.",
          note_index: 0,
          structured_adjustment: {
            factor: 0.5,
            hours: [10, 11, 12, 13],
          },
        },
        {
          applies: false,
          directive_type: "no_op",
          explanation: "Sports facility note is informational only.",
          note_index: 1,
          structured_adjustment: null,
        },
      ];

      const interpreter: DirectiveInterpreter = {
        interpret() {
          return Promise.resolve(mockInterpretations);
        },
      };
      const optimizer: EnergyOptimizer = {
        optimize() {
          return Promise.resolve(mockPlan);
        },
      };
      const validator: ScheduleValidator = {
        validate() {
          return Promise.resolve(mockPlan);
        },
      };

      setOptimizeEnergyService(
        new OptimizeEnergyService({ interpreter, optimizer, validator })
      );

      const res = await app.request("/optimize-energy", {
        body: JSON.stringify(createValidScenario()),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      // 1. Status 200
      expect(res.status).toBe(200);

      // 2. Response contains all 7 canonical top-level fields
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.scenario_id).toBe("TEST-SCENARIO-01");
      expect(body.directive_interpretation).toBeDefined();
      expect(body.hourly_plan).toBeDefined();
      expect(typeof body.total_grid_kwh).toBe("number");
      expect(typeof body.total_cost_bdt).toBe("number");
      expect(typeof body.peak_grid_kwh).toBe("number");
      expect(typeof body.plan_summary).toBe("string");

      // 3. hourly_plan has exactly 24 entries with hour 0..23 in sequential order
      const hourlyPlan = body.hourly_plan as HourlyPlanEntry[];
      expect(Array.isArray(hourlyPlan)).toBe(true);
      expect(hourlyPlan.length).toBe(24);
      let h = 0;
      while (h < 24) {
        expect(hourlyPlan[h]?.hour).toBe(h);
        expect(hourlyPlan[h]?.grid_kwh).toBeGreaterThanOrEqual(0);
        expect(hourlyPlan[h]?.solar_used_kwh).toBeGreaterThanOrEqual(0);
        expect(["charge", "discharge", "idle"]).toContain(
          hourlyPlan[h]?.battery_action as string
        );
        h += 1;
      }
    });
  });

  // Requirement 4: Malformed/missing request data → 400
  describe("2. Malformed or missing request payload handling", () => {
    it("returns 400 when body is malformed JSON syntax", async () => {
      const res = await app.request("/optimize-energy", {
        body: "{ invalid json syntax ...",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as {
        error: { status: number; code: string; message: string };
      };
      expect(body.error).toBeDefined();
      expect(body.error.status).toBe(400);
      expect(body.error.code).toBe("MALFORMED_REQUEST");
    });

    it("returns 400 when body is empty string", async () => {
      const res = await app.request("/optimize-energy", {
        body: "",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as {
        error: { status: number; code: string };
      };
      expect(body.error.status).toBe(400);
      expect(body.error.code).toBe("MALFORMED_REQUEST");
    });
  });

  // Requirement 5: Semantically invalid scenario → 422
  describe("3. Semantically invalid scenario handling", () => {
    it("returns 422 when hours array has only 23 entries instead of 24", async () => {
      const scenario = createValidScenario();
      const invalidHours = scenario.hours.slice(0, 23); // Missing hour 23

      const res = await app.request("/optimize-energy", {
        body: JSON.stringify({ ...scenario, hours: invalidHours }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(res.status).toBe(422);
      const body = (await res.json()) as {
        error: { status: number; code: string; message: string };
      };
      expect(body.error.status).toBe(422);
      expect(body.error.code).toBe("INVALID_SCENARIO");
      expect(body.error.message).toContain("24");
    });

    it("returns 422 when hours contain duplicate hour entries", async () => {
      const scenario = createValidScenario();
      const duplicateHours = [...scenario.hours];
      const [firstHour] = duplicateHours;
      if (firstHour) {
        duplicateHours[1] = { ...firstHour }; // duplicate hour 0
      }

      const res = await app.request("/optimize-energy", {
        body: JSON.stringify({ ...scenario, hours: duplicateHours }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(res.status).toBe(422);
      const body = (await res.json()) as {
        error: { status: number; code: string };
      };
      expect(body.error.status).toBe(422);
      expect(body.error.code).toBe("INVALID_SCENARIO");
    });

    it("returns 422 when operator_notes is empty or has more than 3 notes", async () => {
      const scenario = createValidScenario();

      // Empty notes
      const resEmpty = await app.request("/optimize-energy", {
        body: JSON.stringify({ ...scenario, operator_notes: [] }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      expect(resEmpty.status).toBe(422);

      // 4 notes (maximum allowed is 3)
      const resTooMany = await app.request("/optimize-energy", {
        body: JSON.stringify({
          ...scenario,
          operator_notes: ["Note 1", "Note 2", "Note 3", "Note 4"],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      expect(resTooMany.status).toBe(422);
    });

    it("returns 422 when battery initial_energy_kwh is less than minimum_energy_kwh", async () => {
      const scenario = createValidScenario();
      const invalidBattery = {
        ...scenario.battery,
        initial_energy_kwh: 30, // 30 < 60 is invalid
        minimum_energy_kwh: 60,
      };

      const res = await app.request("/optimize-energy", {
        body: JSON.stringify({ ...scenario, battery: invalidBattery }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(res.status).toBe(422);
      const body = (await res.json()) as {
        error: { status: number; code: string };
      };
      expect(body.error.status).toBe(422);
      expect(body.error.code).toBe("INVALID_SCENARIO");
    });
  });

  // Requirement 6: Interpreter/optimizer/validator failures → controlled 500
  describe("4. Controlled 500 errors for internal stage failures", () => {
    it("returns 500 DirectiveInterpretationError when interpreter fails", async () => {
      const interpreter: DirectiveInterpreter = {
        interpret() {
          return Promise.reject(
            new DirectiveInterpretationError(
              "Interpreter failed to parse LLM output."
            )
          );
        },
      };
      setOptimizeEnergyService(
        new OptimizeEnergyService({
          interpreter,
          optimizer: {
            optimize() {
              return Promise.reject(new Error("Unreached"));
            },
          },
          validator: {
            validate() {
              return Promise.reject(new Error("Unreached"));
            },
          },
        })
      );

      const res = await app.request("/optimize-energy", {
        body: JSON.stringify(createValidScenario()),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as {
        error: { status: number; code: string };
      };
      expect(body.error.status).toBe(500);
      expect(body.error.code).toBe("DIRECTIVE_INTERPRETATION_ERROR");
    });

    it("returns 500 DirectiveValidationError when directive validation fails", async () => {
      const interpreter: DirectiveInterpreter = {
        interpret() {
          return Promise.reject(
            new DirectiveValidationError(
              "Directive hour 25 is out of valid range."
            )
          );
        },
      };
      setOptimizeEnergyService(
        new OptimizeEnergyService({
          interpreter,
          optimizer: {
            optimize() {
              return Promise.reject(new Error("Unreached"));
            },
          },
          validator: {
            validate() {
              return Promise.reject(new Error("Unreached"));
            },
          },
        })
      );

      const res = await app.request("/optimize-energy", {
        body: JSON.stringify(createValidScenario()),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as {
        error: { status: number; code: string };
      };
      expect(body.error.status).toBe(500);
      expect(body.error.code).toBe("DIRECTIVE_VALIDATION_ERROR");
    });

    it("returns 500 OptimizationError when optimizer fails", async () => {
      const interpreter: DirectiveInterpreter = {
        interpret() {
          return Promise.resolve([
            {
              applies: false,
              directive_type: "no_op",
              explanation: "ok",
              note_index: 0,
              structured_adjustment: null,
            },
          ]);
        },
      };
      const optimizer: EnergyOptimizer = {
        optimize() {
          return Promise.reject(
            new OptimizationError("Solver timeout or infeasible constraints.")
          );
        },
      };
      setOptimizeEnergyService(
        new OptimizeEnergyService({
          interpreter,
          optimizer,
          validator: {
            validate() {
              return Promise.reject(new Error("Unreached"));
            },
          },
        })
      );

      const res = await app.request("/optimize-energy", {
        body: JSON.stringify(createValidScenario()),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as {
        error: { status: number; code: string };
      };
      expect(body.error.status).toBe(500);
      expect(body.error.code).toBe("OPTIMIZATION_ERROR");
    });

    it("returns 500 ScheduleValidationError when validator fails", async () => {
      const interpreter: DirectiveInterpreter = {
        interpret() {
          return Promise.resolve([
            {
              applies: false,
              directive_type: "no_op",
              explanation: "ok",
              note_index: 0,
              structured_adjustment: null,
            },
          ]);
        },
      };
      const optimizer: EnergyOptimizer = {
        optimize() {
          return Promise.resolve({
            hourly_plan: createMockHourlyPlan(),
            peak_grid_kwh: 50,
            plan_summary: "Mock plan",
            total_cost_bdt: 5000,
            total_grid_kwh: 1000,
          });
        },
      };
      const validator: ScheduleValidator = {
        validate() {
          return Promise.reject(
            new ScheduleValidationError(
              "End-of-day battery neutrality constraint violated."
            )
          );
        },
      };
      setOptimizeEnergyService(
        new OptimizeEnergyService({ interpreter, optimizer, validator })
      );

      const res = await app.request("/optimize-energy", {
        body: JSON.stringify(createValidScenario()),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as {
        error: { status: number; code: string };
      };
      expect(body.error.status).toBe(500);
      expect(body.error.code).toBe("SCHEDULE_VALIDATION_ERROR");
    });

    it("returns controlled 500 on unexpected non-domain runtime exception", async () => {
      const interpreter: DirectiveInterpreter = {
        interpret() {
          return Promise.reject(new Error("Unexpected memory failure"));
        },
      };
      setOptimizeEnergyService(
        new OptimizeEnergyService({
          interpreter,
          optimizer: {
            optimize() {
              return Promise.reject(new Error("Unreached"));
            },
          },
          validator: {
            validate() {
              return Promise.reject(new Error("Unreached"));
            },
          },
        })
      );

      const res = await app.request("/optimize-energy", {
        body: JSON.stringify(createValidScenario()),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as {
        error: { status: number; message: string };
      };
      expect(body.error.status).toBe(500);
      expect(body.error.message).toBe(
        "Internal server error during energy optimization."
      );
    });
  });

  // Requirement 7: Error responses do not expose stack traces or secrets
  describe("5. Security: Zero leakage of stack traces or secrets", () => {
    it("never exposes stack traces, API keys, or internal error causes in responses", async () => {
      const interpreter: DirectiveInterpreter = {
        interpret() {
          return Promise.reject(
            new LLMProviderError(
              "Service temporarily unavailable.",
              "DATABASE_URL=postgres://user:super_secret_password@db.internal:5432/db"
            )
          );
        },
      };
      setOptimizeEnergyService(
        new OptimizeEnergyService({
          interpreter,
          optimizer: {
            optimize() {
              return Promise.reject(new Error("Unreached"));
            },
          },
          validator: {
            validate() {
              return Promise.reject(new Error("Unreached"));
            },
          },
        })
      );

      const res = await app.request("/optimize-energy", {
        body: JSON.stringify(createValidScenario()),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      expect(res.status).toBe(500);
      const rawText = await res.text();

      // Ensure secret credentials and internal stack traces are completely absent
      expect(rawText).not.toContain("super_secret_password");
      expect(rawText).not.toContain("stack");
      expect(rawText).not.toContain("node_modules");

      const body = JSON.parse(rawText) as { error: Record<string, unknown> };
      expect(body.error.stack).toBeUndefined();
      expect(body.error.status).toBe(500);
      expect(body.error.code).toBe("LLM_PROVIDER_ERROR");
      expect(body.error.message).toBe("Service temporarily unavailable.");
    });
  });
});
