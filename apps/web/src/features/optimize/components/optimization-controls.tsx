"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Loader2,
  Server,
  Zap,
} from "lucide-react";

interface OptimizationControlsProps {
  apiEndpoint: string;
  errorMessage: string | null;
  executionMode: "auto" | "live" | "fixture";
  executionTimeMs: number | null;
  isOptimizing: boolean;
  onOptimize: () => void;
  setApiEndpoint: (url: string) => void;
  setExecutionMode: (mode: "auto" | "live" | "fixture") => void;
}

export function OptimizationControls({
  isOptimizing,
  onOptimize,
  executionMode,
  setExecutionMode,
  executionTimeMs,
  errorMessage,
}: OptimizationControlsProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Execution Mode Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground text-xs">
              Solver Engine:
            </span>
            <div className="flex rounded-lg border border-border bg-secondary p-0.5 text-xs">
              <button
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                  executionMode === "auto"
                    ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setExecutionMode("auto")}
                type="button"
              >
                <Cpu className="size-3.5" />
                <span>Auto (Live + Fallback)</span>
              </button>
              <button
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                  executionMode === "live"
                    ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setExecutionMode("live")}
                type="button"
              >
                <Server className="size-3.5" />
                <span>Live API Only</span>
              </button>
              <button
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                  executionMode === "fixture"
                    ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setExecutionMode("fixture")}
                type="button"
              >
                <Activity className="size-3.5" />
                <span>Fixture Reference</span>
              </button>
            </div>
          </div>

          {executionTimeMs === null ? null : (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <CheckCircle2 className="size-3.5 text-success" />
              <span>
                Computed in{" "}
                <span className="font-medium font-mono text-foreground">
                  {executionTimeMs}ms
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Master Action Button */}
        <Button
          className="relative min-w-[200px] gap-2 bg-primary font-display font-semibold text-primary-foreground tracking-wide shadow-glow-solar transition-all hover:brightness-110 active:scale-[0.98]"
          disabled={isOptimizing}
          onClick={onOptimize}
          size="lg"
        >
          {isOptimizing ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              <span>Optimizing Microgrid...</span>
            </>
          ) : (
            <>
              <Zap className="size-5 fill-current" />
              <span>Optimize Energy</span>
            </>
          )}
        </Button>
      </div>

      {/* Error Alert */}
      {errorMessage ? (
        <Alert
          className="border-destructive/40 bg-destructive/10 text-xs"
          variant="destructive"
        >
          <AlertTriangle className="size-4" />
          <AlertTitle className="font-semibold text-xs">
            Optimization Error
          </AlertTitle>
          <AlertDescription className="text-xs">
            {errorMessage}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
