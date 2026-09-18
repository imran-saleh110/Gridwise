"use client";

import { Badge } from "@repo/ui/components/badge";
import { Activity, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { AggregateStats } from "./components/aggregate-stats.tsx";
import { BatteryConfigCard } from "./components/battery-config-card.tsx";
import { DirectiveInterpretationCard } from "./components/directive-interpretation-card.tsx";
import { HourlyInputTable } from "./components/hourly-input-table.tsx";
import { HourlyScheduleTable } from "./components/hourly-schedule-table.tsx";
import { OperatorNotesInput } from "./components/operator-notes-input.tsx";
import { OptimizationControls } from "./components/optimization-controls.tsx";
import { ScenarioHeader } from "./components/scenario-header.tsx";
import { ScheduleVisualizer } from "./components/schedule-visualizer.tsx";
import { ValidatorReportCard } from "./components/validator-report-card.tsx";
import { SAMPLE_CASES } from "./sample-cases.ts";
import { validateSchedule } from "./schedule-validator.ts";
import type {
  OptimizationResponse,
  SampleCase,
  ScenarioInput,
  ScheduleValidationReport,
} from "./types.ts";

async function fetchLiveOptimization(
  apiEndpoint: string,
  scenario: ScenarioInput
): Promise<OptimizationResponse> {
  const res = await fetch(apiEndpoint, {
    body: JSON.stringify(scenario),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; status?: number; code?: string };
  } & OptimizationResponse;

  if (!res.ok) {
    const errorMsg =
      body.error?.message ||
      (typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : `Server returned HTTP status ${res.status}: ${res.statusText}`);
    throw new Error(errorMsg);
  }

  return body;
}

export function OptimizeDashboard() {
  const [defaultSample] = SAMPLE_CASES;

  // Scenario input state initialized with Sample 01 preset values
  const [scenario, setScenario] = useState<ScenarioInput>(
    defaultSample
      ? JSON.parse(JSON.stringify(defaultSample.input))
      : {
          battery: {
            capacity_kwh: 200,
            initial_energy_kwh: 100,
            max_charge_kwh_per_hour: 50,
            max_discharge_kwh_per_hour: 50,
            minimum_energy_kwh: 40,
          },
          hours: Array.from({ length: 24 }, (_, h) => ({
            demand_kwh: 100,
            hour: h,
            solar_kwh: h >= 7 && h <= 17 ? 80 : 0,
            tariff_bdt_per_kwh: h >= 17 && h <= 21 ? 25 : 8,
          })),
          operator_notes: ["Standard operation"],
          scenario_id: "CUSTOM-01",
        }
  );

  const [currentCaseId, setCurrentCaseId] = useState<string>(
    defaultSample?.id ?? "SAMPLE-01"
  );

  // Live optimization response (populated only by live backend API execution)
  const [optimizationResponse, setOptimizationResponse] =
    useState<OptimizationResponse | null>(null);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);

  const apiEndpoint = process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/optimize-energy`
    : "http://localhost:3001/optimize-energy";

  // Independent Schedule Replay Validation
  const validationReport: ScheduleValidationReport | null = useMemo(() => {
    if (!optimizationResponse) {
      return null;
    }
    return validateSchedule(scenario, optimizationResponse);
  }, [scenario, optimizationResponse]);

  // Handler: Select a Preset Sample Case (populates only the inputs)
  const handleSelectCase = useCallback((sampleCase: SampleCase) => {
    setCurrentCaseId(sampleCase.id);
    setScenario(JSON.parse(JSON.stringify(sampleCase.input)));
    setOptimizationResponse(null);
    setErrorMessage(null);
    setExecutionTimeMs(null);
  }, []);

  // Handler: Reset to default sample
  const handleReset = useCallback(() => {
    if (defaultSample) {
      handleSelectCase(defaultSample);
    }
  }, [handleSelectCase]);

  // Handler: Export JSON
  const handleExportJson = useCallback(() => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(scenario, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `${scenario.scenario_id || "scenario"}-input.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [scenario]);

  // Handler: Import JSON
  const handleImportJson = useCallback((imported: ScenarioInput) => {
    setScenario(imported);
    setCurrentCaseId("CUSTOM");
    setOptimizationResponse(null);
    setErrorMessage(null);
    setExecutionTimeMs(null);
  }, []);

  // Handler: Run Live Optimization
  const handleOptimize = async () => {
    setIsOptimizing(true);
    setErrorMessage(null);
    const startTime = performance.now();

    try {
      const data = await fetchLiveOptimization(apiEndpoint, scenario);
      setOptimizationResponse(data);
      setExecutionTimeMs(Math.round(performance.now() - startTime));
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to connect to the energy optimization backend.";
      setErrorMessage(msg);
      setOptimizationResponse(null);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Scenario Header & Preset Selector */}
      <ScenarioHeader
        currentCaseId={currentCaseId}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onReset={handleReset}
        onSelectCase={handleSelectCase}
      />

      {/* 2. Configuration Grid: Battery Storage & Operator Notes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BatteryConfigCard
          battery={scenario.battery}
          onChange={(battery) => setScenario((prev) => ({ ...prev, battery }))}
        />

        <OperatorNotesInput
          notes={scenario.operator_notes}
          onChange={(operator_notes) =>
            setScenario((prev) => ({ ...prev, operator_notes }))
          }
        />
      </div>

      {/* 3. 24-Hour Input Horizon (Demand, Solar, Tariff) */}
      <HourlyInputTable
        hours={scenario.hours}
        onChange={(hours) => setScenario((prev) => ({ ...prev, hours }))}
      />

      {/* 4. Live Optimization Engine Controls */}
      <OptimizationControls
        apiEndpoint={apiEndpoint}
        errorMessage={errorMessage}
        executionTimeMs={executionTimeMs}
        isOptimizing={isOptimizing}
        onOptimize={handleOptimize}
      />

      {/* 5. Results & Dispatch Solution View */}
      {optimizationResponse && validationReport ? (
        <div className="space-y-6 pt-2">
          {/* Section Divider */}
          <div className="flex items-center gap-3">
            <div className="flex size-7 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
              <Activity className="size-4" />
            </div>
            <h3 className="font-display font-semibold text-foreground text-xl tracking-tight">
              Optimization Solution & Verification
            </h3>
            <Badge className="border-border text-xs" variant="outline">
              Scenario: {optimizationResponse.scenario_id}
            </Badge>
          </div>

          {/* Aggregates Summary Stats */}
          <AggregateStats plan={optimizationResponse} scenario={scenario} />

          {/* Independent Schedule Replay Validator */}
          <ValidatorReportCard
            plan={optimizationResponse}
            validationReport={validationReport}
          />

          {/* LLM Directive Interpretations Panel */}
          <DirectiveInterpretationCard
            interpretations={optimizationResponse.directive_interpretation}
            notes={scenario.operator_notes}
          />

          {/* 24-Hour Visual Dispatch Charts */}
          <ScheduleVisualizer plan={optimizationResponse} scenario={scenario} />

          {/* Full 24-Hour Schedule Balance Table */}
          <HourlyScheduleTable
            plan={optimizationResponse}
            scenario={scenario}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/80 border-dashed bg-card/40 p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary">
            <Sparkles className="size-6" />
          </div>
          <div>
            <h4 className="font-display font-semibold text-base text-foreground">
              Ready to Optimize
            </h4>
            <p className="max-w-md text-muted-foreground text-xs">
              Configure scenario parameters above and click{" "}
              <span className="font-semibold text-primary">
                Optimize Energy
              </span>{" "}
              to generate the 24-hour cost-minimal microgrid dispatch schedule
              via Groq LLM and the HiGHS solver.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
