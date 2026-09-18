"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Scale,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import type {
  OptimizationResponse,
  ScheduleValidationReport,
} from "../types.ts";

interface ValidatorReportCardProps {
  plan: OptimizationResponse;
  validationReport: ScheduleValidationReport;
}

export function ValidatorReportCard({
  validationReport,
  plan,
}: ValidatorReportCardProps) {
  const [expanded, setExpanded] = useState(false);

  const { isValid, checks, errors, recalculated, toleranceDelta } =
    validationReport;

  const passedCount = checks.filter((c) => c.passed).length;

  return (
    <Card className="border-border bg-card shadow-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`flex size-7 items-center justify-center rounded-md border ${
                isValid
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <CardTitle className="font-display text-base">
                Independent Schedule Replay Validator
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Teammate D Independent Physics & Constraint Evaluation Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isValid ? (
              <Badge
                className="gap-1.5 border-success/50 bg-success/10 px-3 py-1 font-mono text-success text-xs"
                variant="outline"
              >
                <CheckCircle2 className="size-3.5" />
                <span>
                  REPLAY VALIDATED ({passedCount}/{checks.length})
                </span>
              </Badge>
            ) : (
              <Badge
                className="gap-1.5 border-destructive/50 bg-destructive/10 px-3 py-1 font-mono text-destructive text-xs"
                variant="outline"
              >
                <XCircle className="size-3.5" />
                <span>VALIDATION FAILED ({errors.length} Errors)</span>
              </Badge>
            )}

            <button
              className="flex items-center gap-1 rounded-md border border-border bg-secondary px-2.5 py-1 text-muted-foreground text-xs hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
              type="button"
            >
              <span>{expanded ? "Collapse Details" : "Inspect Checks"}</span>
              {expanded ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Aggregates Reconciliation Matrix */}
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <div className="flex items-center justify-between border-border/40 border-b pb-2 font-semibold text-xs">
            <span className="flex items-center gap-1.5 text-foreground">
              <Scale className="size-3.5 text-primary" />
              Independent Recomputation Reconciliation (Tolerance ±0.01)
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              Replay vs Solver Output
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-3 text-xs sm:grid-cols-3">
            {/* Total Grid */}
            <div className="flex flex-col gap-1 rounded border border-border/50 bg-background/50 p-2.5">
              <span className="text-[11px] text-muted-foreground">
                Total Grid Energy:
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-bold font-mono text-foreground">
                  {recalculated.totalGrid} kWh
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  Δ {toleranceDelta.gridDelta}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Plan: {plan.total_grid_kwh} kWh
              </span>
            </div>

            {/* Total Cost */}
            <div className="flex flex-col gap-1 rounded border border-border/50 bg-background/50 p-2.5">
              <span className="text-[11px] text-muted-foreground">
                Total Electricity Cost:
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-bold font-mono text-primary">
                  ৳{recalculated.totalCost}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  Δ {toleranceDelta.costDelta}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Plan: ৳{plan.total_cost_bdt}
              </span>
            </div>

            {/* Peak Grid */}
            <div className="flex flex-col gap-1 rounded border border-border/50 bg-background/50 p-2.5">
              <span className="text-[11px] text-muted-foreground">
                Peak Feeder Draw:
              </span>
              <div className="flex items-baseline justify-between">
                <span className="font-bold font-mono text-warning">
                  {recalculated.peakGrid} kW
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  Δ {toleranceDelta.peakDelta}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Plan: {plan.peak_grid_kwh} kW
              </span>
            </div>
          </div>
        </div>

        {/* Error Diagnostics List (if any) */}
        {errors.length > 0 ? (
          <Alert
            className="border-destructive/40 bg-destructive/10"
            variant="destructive"
          >
            <AlertOctagon className="size-4" />
            <AlertTitle className="font-bold text-xs">
              Constraint Breaches Detected
            </AlertTitle>
            <AlertDescription className="space-y-1 pt-1 text-xs">
              {errors.map((err, idx) => (
                <div className="font-mono text-[11px]" key={idx}>
                  • {err}
                </div>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Itemized Verification Checklist (Expandable) */}
        {expanded ? (
          <div className="space-y-2 border-border/40 border-t pt-2">
            <span className="font-semibold text-muted-foreground text-xs">
              Automated Physical & Operational Gates:
            </span>
            <div className="grid grid-cols-1 gap-2">
              {checks.map((check) => (
                <div
                  className={`flex items-start justify-between gap-3 rounded-lg border p-2.5 text-xs transition ${
                    check.passed
                      ? "border-border bg-secondary/20"
                      : "border-destructive/40 bg-destructive/10"
                  }`}
                  key={check.id}
                >
                  <div className="flex items-start gap-2">
                    {check.passed ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    )}
                    <div>
                      <span className="font-medium text-foreground">
                        {check.name}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {check.details}
                      </p>
                    </div>
                  </div>

                  <Badge
                    className={`shrink-0 font-mono text-[10px] ${
                      check.passed
                        ? "border-success/30 text-success"
                        : "border-destructive/30 text-destructive"
                    }`}
                    variant="outline"
                  >
                    {check.passed ? "PASS" : "FAIL"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
