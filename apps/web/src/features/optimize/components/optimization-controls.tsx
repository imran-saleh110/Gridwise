"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { AlertTriangle, CheckCircle2, Cpu, Loader2, Zap } from "lucide-react";

interface OptimizationControlsProps {
  apiEndpoint: string;
  errorMessage: string | null;
  executionTimeMs: number | null;
  isOptimizing: boolean;
  onOptimize: () => void;
}

export function OptimizationControls({
  isOptimizing,
  onOptimize,
  executionTimeMs,
  errorMessage,
}: OptimizationControlsProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Active Solver Engine Badge & Execution Timer */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/80 px-3 py-1.5 text-xs">
            <Cpu className="size-3.5 text-primary" />
            <span className="text-muted-foreground">Engine:</span>
            <span className="font-semibold text-foreground">
              Groq LLM + HiGHS LP Solver
            </span>
          </div>

          {executionTimeMs === null ? null : (
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <CheckCircle2 className="size-3.5 text-success" />
              <span>
                Solved in{" "}
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
