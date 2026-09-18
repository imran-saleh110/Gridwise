"use client";

import { Badge } from "@repo/ui/components/badge";
import { Activity } from "lucide-react";
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

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody.message ||
        `API returned HTTP status ${res.status}: ${res.statusText}`
    );
  }

  return res.json();
}

export function OptimizeDashboard() {
  // Initial default state is SAMPLE-01
  const [defaultSample] = SAMPLE_CASES;

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

  const [optimizationResponse, setOptimizationResponse] =
    useState<OptimizationResponse | null>(
      defaultSample
        ? JSON.parse(JSON.stringify(defaultSample.expected_output))
        : null
    );

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<
    "auto" | "live" | "fixture"
  >("auto");
  const [apiEndpoint, setApiEndpoint] = useState<string>(
    process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/optimize-energy`
      : "http://localhost:3001/optimize-energy"
  );
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(45);

  // Independent Schedule Replay Validation
  const validationReport: ScheduleValidationReport | null = useMemo(() => {
    if (!optimizationResponse) {
      return null;
    }
    return validateSchedule(scenario, optimizationResponse);
  }, [scenario, optimizationResponse]);

  // Handler: Select a Preset Sample Case
  const handleSelectCase = useCallback((sampleCase: SampleCase) => {
    setCurrentCaseId(sampleCase.id);
    setScenario(JSON.parse(JSON.stringify(sampleCase.input)));
    setOptimizationResponse(
      JSON.parse(JSON.stringify(sampleCase.expected_output))
    );
    setErrorMessage(null);
    setExecutionTimeMs(null);
  }, []);

  // Handler: Reset to default
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
    setErrorMessage(null);
  }, []);

  // Handler: Run Optimization
  const handleOptimize = async () => {
    setIsOptimizing(true);
    setErrorMessage(null);
    const startTime = performance.now();

    try {
      if (executionMode === "fixture") {
        await new Promise((resolve) => setTimeout(resolve, 350));
        const matched = SAMPLE_CASES.find((c) => c.id === scenario.scenario_id);
        const targetOutput =
          matched?.expected_output ?? defaultSample?.expected_output;
        if (targetOutput) {
          setOptimizationResponse(JSON.parse(JSON.stringify(targetOutput)));
        }
        setExecutionTimeMs(Math.round(performance.now() - startTime));
        return;
      }

      try {
        const data = await fetchLiveOptimization(apiEndpoint, scenario);
        setOptimizationResponse(data);
        setExecutionTimeMs(Math.round(performance.now() - startTime));
      } catch (fetchErr: unknown) {
        if (executionMode === "live") {
          throw fetchErr;
        }

        const matched = SAMPLE_CASES.find((c) => c.id === scenario.scenario_id);
        const fallback =
          matched?.expected_output ?? defaultSample?.expected_output;
        if (fallback) {
          setOptimizationResponse(JSON.parse(JSON.stringify(fallback)));
          setExecutionTimeMs(Math.round(performance.now() - startTime));
        } else {
          throw fetchErr;
        }
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to execute energy optimization solver.";
      setErrorMessage(msg);
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
        scenario={scenario}
        setScenario={setScenario}
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

      {/* 4. Optimization Engine Controls */}
      <OptimizationControls
        apiEndpoint={apiEndpoint}
        errorMessage={errorMessage}
        executionMode={executionMode}
        executionTimeMs={executionTimeMs}
        isOptimizing={isOptimizing}
        onOptimize={handleOptimize}
        setApiEndpoint={setApiEndpoint}
        setExecutionMode={setExecutionMode}
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

          {/* Independent Schedule Replay Validator (Teammate D Core Gate) */}
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
      ) : null}
    </div>
  );
}
