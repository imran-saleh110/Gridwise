"use client";

import { Card, CardContent } from "@repo/ui/components/card";
import { Stat } from "@repo/ui/components/stat";
import { Coins, FileCheck2, PlugZap, Sun, Zap } from "lucide-react";
import type { OptimizationResponse, ScenarioInput } from "../types.ts";

interface AggregateStatsProps {
  plan: OptimizationResponse;
  scenario: ScenarioInput;
}

export function AggregateStats({ plan, scenario }: AggregateStatsProps) {
  const totalDemand = scenario.hours.reduce((acc, h) => acc + h.demand_kwh, 0);
  const totalRawSolar = scenario.hours.reduce((acc, h) => acc + h.solar_kwh, 0);

  const totalSolarUsed = plan.hourly_plan.reduce(
    (acc, h) => acc + h.solar_used_kwh,
    0
  );

  const solarSelfConsumptionPercent =
    totalRawSolar > 0 ? Math.round((totalSolarUsed / totalRawSolar) * 100) : 0;

  const gridOffsetPercent =
    totalDemand > 0
      ? Math.round(((totalDemand - plan.total_grid_kwh) / totalDemand) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* 4 Core KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Cost */}
        <Stat
          className="border-primary/30"
          glow
          hint="Optimized 24h electricity bill"
          icon={<Coins className="size-4" />}
          label="Total Dispatch Cost"
          tone="solar"
          value={`৳${plan.total_cost_bdt.toLocaleString("en-US", {
            maximumFractionDigits: 1,
            minimumFractionDigits: 0,
          })}`}
        />

        {/* Total Grid Import */}
        <Stat
          hint={`${gridOffsetPercent}% demand offset by clean solar & battery`}
          icon={<PlugZap className="size-4" />}
          label="Total Grid Import"
          tone="grid"
          value={`${plan.total_grid_kwh.toLocaleString("en-US", {
            maximumFractionDigits: 1,
            minimumFractionDigits: 0,
          })} kWh`}
        />

        {/* Peak Grid Import */}
        <Stat
          hint="Maximum instantaneous feeder draw"
          icon={<Zap className="size-4" />}
          label="Peak Grid Demand"
          tone="warning"
          value={`${plan.peak_grid_kwh.toFixed(1)} kW`}
        />

        {/* Solar Self Consumption */}
        <Stat
          hint={`${solarSelfConsumptionPercent}% of forecast utilized`}
          icon={<Sun className="size-4" />}
          label="Solar Dispatched"
          tone="solar"
          value={`${totalSolarUsed.toFixed(1)} kWh`}
        />
      </div>

      {/* Plan Summary Narrative Banner */}
      {plan.plan_summary ? (
        <Card className="border-border bg-card shadow-panel">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <FileCheck2 className="size-4" />
            </div>
            <div className="space-y-1">
              <span className="font-bold font-mono text-primary text-xs uppercase tracking-wider">
                Optimization Plan Summary
              </span>
              <p className="text-foreground/90 text-sm leading-relaxed">
                {plan.plan_summary}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
