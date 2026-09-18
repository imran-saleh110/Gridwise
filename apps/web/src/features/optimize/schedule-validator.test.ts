import { describe, expect, it } from "bun:test";
import { SAMPLE_CASES } from "./sample-cases.ts";
import { validateSchedule } from "./schedule-validator.ts";

describe("Teammate D Independent Schedule Replay Validator", () => {
  it("validates all 10 public benchmark sample scenarios as valid optimal schedules", () => {
    expect(SAMPLE_CASES.length).toBe(10);

    for (const sampleCase of SAMPLE_CASES) {
      const report = validateSchedule(
        sampleCase.input,
        sampleCase.expected_output
      );
      expect(report.isValid).toBe(true);
      expect(report.errors.length).toBe(0);
      expect(report.checks.every((c) => c.passed)).toBe(true);

      // Verify tolerance deltas
      expect(report.toleranceDelta.gridDelta).toBeLessThanOrEqual(0.01);
      expect(report.toleranceDelta.costDelta).toBeLessThanOrEqual(0.01);
      expect(report.toleranceDelta.peakDelta).toBeLessThanOrEqual(0.01);
    }
  });

  it("detects energy balance violations when generation does not equal demand + charge", () => {
    const [sampleCase] = SAMPLE_CASES;
    if (!sampleCase) {
      throw new Error("No sample case found");
    }

    const corruptedPlan = JSON.parse(
      JSON.stringify(sampleCase.expected_output)
    );
    // Introduce artificial corruption in Hour 5
    corruptedPlan.hourly_plan[5].grid_kwh += 20;

    const report = validateSchedule(sampleCase.input, corruptedPlan);
    expect(report.isValid).toBe(false);
    expect(
      report.errors.some((e) => e.includes("Energy balance violation"))
    ).toBe(true);
  });

  it("detects end-of-day battery neutrality failures when E_23 != E_initial", () => {
    const [sampleCase] = SAMPLE_CASES;
    if (!sampleCase) {
      throw new Error("No sample case found");
    }

    const corruptedPlan = JSON.parse(
      JSON.stringify(sampleCase.expected_output)
    );
    corruptedPlan.hourly_plan[23].battery_energy_after_kwh += 15;

    const report = validateSchedule(sampleCase.input, corruptedPlan);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes("Neutrality error"))).toBe(
      true
    );
  });
});
