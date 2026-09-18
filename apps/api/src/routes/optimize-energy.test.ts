import { describe, expect, it } from "bun:test";
import { app } from "../app.ts";
import {
  DirectiveInterpretationError,
  DirectiveValidationError,
  LLMProviderError,
  OptimizationError,
  ScheduleValidationError,
} from "@repo/energy/errors";
import type {
  DirectiveInterpretation,
  HourlyPlanEntry,
  OptimizationPlan,
  Scenario,
} from "@repo/energy/domain";
import {
  OptimizeEnergyService,
  type EnergyOptimizer,
  type ScheduleValidator,
} from "@repo/energy/service";
import type { DirectiveInterpreter } from "@repo/energy/interpreter";
import { setOptimizeEnergyService } from "./optimize-energy.ts";

function createValidScenario(): Scenario {
  return {
    scenario_id: "TEST-SCENARIO-01",
    operator_notes: [
      "Solar array will be partially shaded from 10:00 to 14:00.",
      "Sports facility maintenance.",
    ],
    hours: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      demand_kwh: 120 + i * 2,
      solar_kwh: i >= 6 && i <= 18 ? 40 + i * 5 : 0,
      tariff_bdt_per_kwh: i >= 17 && i <= 22 ? 12.0 : 6.0,
    })),
    battery: {
      capacity_kwh: 200,
      initial_energy_kwh: 80,
      minimum_energy_kwh: 40,
      max_charge_kwh_per_hour: 50,
      max_discharge_kwh_per_hour: 50,
    },
  };
}

function createMockHourlyPlan(): HourlyPlanEntry[] {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    grid_kwh: 80,
    solar_used_kwh: 40,
    battery_action: i === 12 ? "charge" : i === 19 ? "discharge" : "idle",
    battery_kwh: i === 12 || i === 19 ? 20 : 0,
    battery_energy_after_kwh: i === 12 ? 100 : i === 19 ? 80 : 80,
  }));
}

describe("POST /optimize-energy API Contract Integration Tests", () => {
  // Requirement 1, 2, 3: Valid request, 200, required fields, exactly 24 hourly entries
  describe("1. Valid request & 24-hour response structure", () => {
    it("returns 200 with the canonical flat challenge response contract containing exactly 24 hourly entries", async () => {
      const mockPlan: OptimizationPlan = {
        hourly_plan: createMockHourlyPlan(),
        total_grid_kwh: 1920,
        total_cost_bdt: 14400,
        peak_grid_kwh: 80,
        plan_summary: "Optimal solar storage during peak tariff hours.",
      };

      const mockInterpretations: DirectiveInterpretation[] = [
        {
          note_index: 0,
          directive_type: "solar_reduction",
          applies: true,
          structured_adjustment: {
            hours: [10, 11, 12, 13],
            factor: 0.5,
          },
          explanation: "50% solar reduction due to partial shading.",
        },
        {
          note_index: 1,
          directive_type: "no_op",
          applies: false,
          structured_adjustment: null,
          explanation: "Sports facility note is informational only.",
        },
      ];

      const interpreter: DirectiveInterpreter = {
        async interpret() {
          return mockInterpretations;
        },
      };
      const optimizer: EnergyOptimizer = {
        async optimize() {
          return mockPlan;
        },
      };
      const validator: ScheduleValidator = {
        async validate() {
          return mockPlan;
        },
      };

      setOptimizeEnergyService(
        new OptimizeEnergyService({ interpreter, optimizer, validator }),
      );

      const res = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createValidScenario()),
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
      for (let h = 0; h < 24; h++) {
        expect(hourlyPlan[h]?.hour).toBe(h);
        expect(hourlyPlan[h]?.grid_kwh).toBeGreaterThanOrEqual(0);
        expect(hourlyPlan[h]?.solar_used_kwh).toBeGreaterThanOrEqual(0);
        expect(["charge", "discharge", "idle"]).toContain(
          hourlyPlan[h]?.battery_action as string,
        );
      }
    });
  });

  // Requirement 4: Malformed/missing request data → 400
  describe("2. Malformed or missing request payload handling", () => {
    it("returns 400 when body is malformed JSON syntax", async () => {
      const res = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json syntax ...",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { status: number; code: string; message: string } };
      expect(body.error).toBeDefined();
      expect(body.error.status).toBe(400);
      expect(body.error.code).toBe("MALFORMED_REQUEST");
    });

    it("returns 400 when body is empty string", async () => {
      const res = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { status: number; code: string } };
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scenario, hours: invalidHours }),
      });

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: { status: number; code: string; message: string } };
      expect(body.error.status).toBe(422);
      expect(body.error.code).toBe("INVALID_SCENARIO");
      expect(body.error.message).toContain("24");
    });

    it("returns 422 when hours contain duplicate hour entries", async () => {
      const scenario = createValidScenario();
      const duplicateHours = [...scenario.hours];
      duplicateHours[1] = { ...duplicateHours[0]! }; // duplicate hour 0

      const res = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scenario, hours: duplicateHours }),
      });

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: { status: number; code: string } };
      expect(body.error.status).toBe(422);
      expect(body.error.code).toBe("INVALID_SCENARIO");
    });

    it("returns 422 when operator_notes is empty or has more than 3 notes", async () => {
      const scenario = createValidScenario();

      // Empty notes
      const resEmpty = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scenario, operator_notes: [] }),
      });
      expect(resEmpty.status).toBe(422);

      // 4 notes (maximum allowed is 3)
      const resTooMany = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...scenario,
          operator_notes: ["Note 1", "Note 2", "Note 3", "Note 4"],
        }),
      });
      expect(resTooMany.status).toBe(422);
    });

    it("returns 422 when battery initial_energy_kwh is less than minimum_energy_kwh", async () => {
      const scenario = createValidScenario();
      const invalidBattery = {
        ...scenario.battery,
        minimum_energy_kwh: 60,
        initial_energy_kwh: 30, // 30 < 60 is invalid
      };

      const res = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scenario, battery: invalidBattery }),
      });

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: { status: number; code: string } };
      expect(body.error.status).toBe(422);
      expect(body.error.code).toBe("INVALID_SCENARIO");
    });
  });

  // Requirement 6: Interpreter/optimizer/validator failures → controlled 500
  describe("4. Controlled 500 errors for internal stage failures", () => {
    it("returns 500 DirectiveInterpretationError when interpreter fails", async () => {
      const interpreter: DirectiveInterpreter = {
        async interpret() {
          throw new DirectiveInterpretationError("Interpreter failed to parse LLM output.");
        },
      };
      setOptimizeEnergyService(
        new OptimizeEnergyService({
          interpreter,
          optimizer: { async optimize() { throw new Error("Unreached"); } },
          validator: { async validate() { throw new Error("Unreached"); } },
        }),
      );

      const res = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createValidScenario()),
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { status: number; code: string } };
      expect(body.error.status).toBe(500);
      expect(body.error.code).toBe("DIRECTIVE_INTERPRETATION_ERROR");
    });

    it("returns 500 DirectiveValidationError when directive validation fails", async () => {
      const interpreter: DirectiveInterpreter = {
        async interpret() {
          throw new DirectiveValidationError("Directive hour 25 is out of valid range.");
        },
      };
      setOptimizeEnergyService(
        new OptimizeEnergyService({
          interpreter,
          optimizer: { async optimize() { throw new Error("Unreached"); } },
          validator: { async validate() { throw new Error("Unreached"); } },
        }),
      );

      const res = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createValidScenario()),
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { status: number; code: string } };
      expect(body.error.status).toBe(500);
      expect(body.error.code).toBe("DIRECTIVE_VALIDATION_ERROR");
    });

    it("returns 500 OptimizationError when optimizer fails", async () => {
      const interpreter: DirectiveInterpreter = {
        async interpret() {
          return [{ note_index: 0, directive_type: "no_op", applies: false, structured_adjustment: null, explanation: "ok" }];
        },
      };
      const optimizer: EnergyOptimizer = {
        async optimize() {
          throw new OptimizationError("Solver timeout or infeasible constraints.");
        },
      };
      setOptimizeEnergyService(
        new OptimizeEnergyService({
          interpreter,
          optimizer,
          validator: { async validate() { throw new Error("Unreached"); } },
        }),
      );

      const res = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createValidScenario()),
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { status: number; code: string } };
      expect(body.error.status).toBe(500);
      expect(body.error.code).toBe("OPTIMIZATION_ERROR");
    });

    it("returns 500 ScheduleValidationError when validator fails", async () => {
      const interpreter: DirectiveInterpreter = {
        async interpret() {
          return [{ note_index: 0, directive_type: "no_op", applies: false, structured_adjustment: null, explanation: "ok" }];
        },
      };
      const optimizer: EnergyOptimizer = {
        async optimize() {
          return {
            hourly_plan: createMockHourlyPlan(),
            total_grid_kwh: 1000,
            total_cost_bdt: 5000,
            peak_grid_kwh: 50,
            plan_summary: "Mock plan",
          };
        },
      };
      const validator: ScheduleValidator = {
        async validate() {
          throw new ScheduleValidationError("End-of-day battery neutrality constraint violated.");
        },
      };
      setOptimizeEnergyService(
        new OptimizeEnergyService({ interpreter, optimizer, validator }),
      );

      const res = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createValidScenario()),
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { status: number; code: string } };
      expect(body.error.status).toBe(500);
      expect(body.error.code).toBe("SCHEDULE_VALIDATION_ERROR");
    });

    it("returns controlled 500 on unexpected non-domain runtime exception", async () => {
      const interpreter: DirectiveInterpreter = {
        async interpret() {
          throw new Error("Unexpected memory failure");
        },
      };
      setOptimizeEnergyService(
        new OptimizeEnergyService({
          interpreter,
          optimizer: { async optimize() { throw new Error("Unreached"); } },
          validator: { async validate() { throw new Error("Unreached"); } },
        }),
      );

      const res = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createValidScenario()),
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: { status: number; message: string } };
      expect(body.error.status).toBe(500);
      expect(body.error.message).toBe("Internal server error during energy optimization.");
    });
  });

  // Requirement 7: Error responses do not expose stack traces or secrets
  describe("5. Security: Zero leakage of stack traces or secrets", () => {
    it("never exposes stack traces, API keys, or internal error causes in responses", async () => {
      const interpreter: DirectiveInterpreter = {
        async interpret() {
          throw new LLMProviderError(
            "Service temporarily unavailable.",
            "DATABASE_URL=postgres://user:super_secret_password@db.internal:5432/db",
          );
        },
      };
      setOptimizeEnergyService(
        new OptimizeEnergyService({
          interpreter,
          optimizer: { async optimize() { throw new Error("Unreached"); } },
          validator: { async validate() { throw new Error("Unreached"); } },
        }),
      );

      const res = await app.request("/optimize-energy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createValidScenario()),
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
