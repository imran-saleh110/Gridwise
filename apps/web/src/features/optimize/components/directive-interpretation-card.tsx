"use client";

import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { EnergyChip } from "@repo/ui/components/energy-chip";
import {
  Ban,
  Battery,
  Bot,
  CheckCircle2,
  Clock,
  HelpCircle,
  ShieldAlert,
  SunMedium,
  Zap,
} from "lucide-react";
import type { DirectiveInterpretation, DirectiveType } from "../types.ts";

interface DirectiveInterpretationCardProps {
  interpretations: DirectiveInterpretation[];
  notes: string[];
}

const DIRECTIVE_META: Record<
  DirectiveType,
  {
    chipTone:
      | "solar"
      | "battery"
      | "grid"
      | "destructive"
      | "warning"
      | "neutral";
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  max_grid_window: {
    chipTone: "grid",
    description:
      "Imposes an upper ceiling on hourly electricity imported from the grid.",
    icon: Zap,
    label: "Grid Import Cap",
  },
  minimum_battery_reserve: {
    chipTone: "battery",
    description: "Raises the minimum allowable battery state of charge.",
    icon: Battery,
    label: "Emergency Battery Reserve",
  },
  no_charge_window: {
    chipTone: "destructive",
    description:
      "Forces battery charging power to 0 kW during specified hours.",
    icon: Ban,
    label: "Charger Inhibit Window",
  },
  no_discharge_window: {
    chipTone: "warning",
    description:
      "Forces battery discharge power to 0 kW during specified hours.",
    icon: ShieldAlert,
    label: "Discharge Inhibit Window",
  },
  no_op: {
    chipTone: "neutral",
    description:
      "Unrelated or non-actionable note; does not affect dispatch schedule.",
    icon: HelpCircle,
    label: "No Operation (Distractor)",
  },
  solar_reduction: {
    chipTone: "solar",
    description:
      "Applies fractional multiplier to forecasted solar production.",
    icon: SunMedium,
    label: "Solar Curtailment / Derate",
  },
};

function DirectiveRow({
  interp,
  originalNote,
}: {
  interp: DirectiveInterpretation;
  originalNote: string;
}) {
  const meta = DIRECTIVE_META[interp.directive_type] ?? DIRECTIVE_META.no_op;
  const Icon = meta.icon;
  const adj = interp.structured_adjustment;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
      {/* Header: Note index + Directive Badge + Applies Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold font-mono text-muted-foreground">
            #{interp.note_index}
          </span>
          <EnergyChip dot tone={meta.chipTone}>
            <Icon className="size-3" />
            <span>{meta.label}</span>
          </EnergyChip>
          <span className="font-mono text-[11px] text-muted-foreground">
            ({interp.directive_type})
          </span>
        </div>

        <div>
          {interp.applies ? (
            <Badge
              className="gap-1 border-success/40 bg-success/10 text-[10px] text-success"
              variant="outline"
            >
              <CheckCircle2 className="size-3" /> Applies to Schedule
            </Badge>
          ) : (
            <Badge
              className="border-border bg-muted/60 text-[10px] text-muted-foreground"
              variant="outline"
            >
              No-Op (Ignored)
            </Badge>
          )}
        </div>
      </div>

      {/* Original Note Text */}
      {originalNote ? (
        <div className="rounded border border-border/60 bg-background/60 p-2 text-muted-foreground italic">
          &ldquo;{originalNote}&rdquo;
        </div>
      ) : null}

      {/* Structured Adjustment Details */}
      {adj ? (
        <div className="flex flex-wrap items-center gap-2 rounded bg-muted/40 px-2.5 py-1.5 font-mono text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3 text-primary" />
            Target Hours:
          </span>
          <span className="font-semibold text-foreground">
            {Array.isArray(adj.hours)
              ? `[${adj.hours.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ")}]`
              : "All Day"}
          </span>

          {"factor" in adj ? (
            <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-primary">
              Solar Factor: {(adj.factor * 100).toFixed(0)}% (Remaining)
            </span>
          ) : null}

          {"reserve_kwh" in adj && adj.reserve_kwh ? (
            <span className="ml-2 rounded bg-success/20 px-1.5 py-0.5 text-success">
              Reserve Floor: {adj.reserve_kwh} kWh
            </span>
          ) : null}

          {"minimum_energy_kwh" in adj && adj.minimum_energy_kwh ? (
            <span className="ml-2 rounded bg-success/20 px-1.5 py-0.5 text-success">
              Reserve Floor: {adj.minimum_energy_kwh} kWh
            </span>
          ) : null}

          {"max_grid_kwh" in adj ? (
            <span className="ml-2 rounded bg-chart-3/20 px-1.5 py-0.5 text-chart-3">
              Grid Cap: {adj.max_grid_kwh} kW
            </span>
          ) : null}
        </div>
      ) : null}

      {/* LLM Explanation */}
      {interp.explanation ? (
        <div className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground/80">
            Explanation:{" "}
          </span>
          {interp.explanation}
        </div>
      ) : null}
    </div>
  );
}

export function DirectiveInterpretationCard({
  interpretations,
  notes,
}: DirectiveInterpretationCardProps) {
  return (
    <Card className="border-border bg-card shadow-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <Bot className="size-4" />
            </div>
            <CardTitle className="font-display text-base">
              LLM Directive Interpretation
            </CardTitle>
          </div>
          <EnergyChip dot tone="solar">
            Structured JSON Contract
          </EnergyChip>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {interpretations.map((interp) => (
          <DirectiveRow
            interp={interp}
            key={interp.note_index}
            originalNote={notes[interp.note_index] ?? ""}
          />
        ))}
      </CardContent>
    </Card>
  );
}
