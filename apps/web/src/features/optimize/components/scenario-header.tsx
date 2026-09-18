"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  ChevronDown,
  Download,
  FolderOpen,
  Layers,
  RotateCcw,
  Zap,
} from "lucide-react";
import { SAMPLE_CASES } from "../sample-cases.ts";
import type { SampleCase, ScenarioInput } from "../types.ts";

interface ScenarioHeaderProps {
  currentCaseId: string;
  onExportJson: () => void;
  onImportJson: (scenario: ScenarioInput) => void;
  onReset: () => void;
  onSelectCase: (sampleCase: SampleCase) => void;
  scenario?: ScenarioInput;
  setScenario?: React.Dispatch<React.SetStateAction<ScenarioInput>>;
}

export function ScenarioHeader({
  currentCaseId,
  onSelectCase,
  onReset,
  onExportJson,
  onImportJson,
}: ScenarioHeaderProps) {
  const currentSample = SAMPLE_CASES.find((c) => c.id === currentCaseId);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.scenario_id && parsed.hours && parsed.battery) {
          onImportJson(parsed);
        } else if (parsed.input?.scenario_id) {
          onImportJson(parsed.input);
        }
      } catch (err) {
        console.error("Failed to parse imported JSON", err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-glow-solar">
            <Zap className="size-5" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-2xl tracking-tight">
              Scenario Configuration
            </h2>
          </div>
        </div>

        {/* Preset Selector & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-secondary px-3 font-medium text-foreground text-xs shadow-xs transition hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Layers className="size-4 text-primary" />
              <span>
                {currentSample
                  ? `${currentSample.id}: ${currentSample.label}`
                  : "Custom Scenario"}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 bg-popover">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-display text-muted-foreground text-xs">
                  Public Test Cases (Sample 01 - 10)
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SAMPLE_CASES.map((item) => (
                  <DropdownMenuItem
                    className="flex cursor-pointer flex-col items-start gap-0.5 py-2 focus:bg-accent"
                    key={item.id}
                    onClick={() => onSelectCase(item)}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-medium font-mono text-primary text-xs">
                        {item.id}
                      </span>
                      {item.id === currentCaseId ? (
                        <Badge
                          className="border-primary/40 text-[10px] text-primary"
                          variant="outline"
                        >
                          Active
                        </Badge>
                      ) : null}
                    </div>
                    <span className="font-medium text-foreground text-sm">
                      {item.label}
                    </span>
                    <span className="line-clamp-1 text-[11px] text-muted-foreground">
                      {item.input.operator_notes[0]}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            className="border-border bg-secondary"
            onClick={onReset}
            size="sm"
            title="Reset to default sample"
            variant="outline"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>

          <Button
            className="border-border bg-secondary"
            onClick={onExportJson}
            size="sm"
            title="Export scenario JSON"
            variant="outline"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          <label className="cursor-pointer">
            <input
              accept=".json"
              className="hidden"
              onChange={handleFileUpload}
              type="file"
            />
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 font-medium text-xs hover:bg-accent hover:text-foreground">
              <FolderOpen className="size-3.5" />
              <span className="hidden sm:inline">Import</span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
