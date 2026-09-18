"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { BatteryCharging, Layers } from "lucide-react";
import { useState } from "react";
import type { OptimizationResponse, ScenarioInput } from "../types.ts";

function formatHourLabel(h: number): string {
  if (h === 0) {
    return "12 AM";
  }
  if (h < 12) {
    return `${h} AM`;
  }
  if (h === 12) {
    return "12 PM";
  }
  return `${h - 12} PM`;
}

interface ScheduleVisualizerProps {
  plan: OptimizationResponse;
  scenario: ScenarioInput;
}

export function ScheduleVisualizer({
  scenario,
  plan,
}: ScheduleVisualizerProps) {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const { hours, battery } = scenario;
  const { hourly_plan } = plan;

  // Max scale calculations for clean charts
  const maxFlow = Math.max(
    ...hours.map((h) => h.demand_kwh),
    ...hourly_plan.map((p) => p.grid_kwh),
    ...hourly_plan.map((p) => p.solar_used_kwh),
    ...hours.map((h) => h.solar_kwh),
    1
  );

  const maxCapacity = Math.max(battery.capacity_kwh, 1);

  // Selected hour data
  const activeHourIndex = hoveredHour === null ? 12 : hoveredHour;
  const activeInput = hours[activeHourIndex];
  const activePlan = hourly_plan[activeHourIndex];

  return (
    <div className="space-y-4">
      {/* Active Hour Quick Metric Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-panel">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 font-bold font-mono text-primary text-xs">
            {String(activeHourIndex).padStart(2, "0")}:00
          </div>
          <div>
            <div className="text-muted-foreground text-xs">
              Selected Hour Analysis
            </div>
            <span className="font-semibold text-foreground text-sm">
              Hour {activeHourIndex} ({formatHourLabel(activeHourIndex)})
            </span>
          </div>
        </div>

        {activeInput && activePlan ? (
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-chart-4" />
              <span className="text-muted-foreground">Demand:</span>
              <span className="font-semibold text-foreground">
                {activeInput.demand_kwh} kW
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Solar Used:</span>
              <span className="font-semibold text-primary">
                {activePlan.solar_used_kwh} kW
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-chart-3" />
              <span className="text-muted-foreground">Grid Import:</span>
              <span className="font-semibold text-chart-3">
                {activePlan.grid_kwh} kW
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-success" />
              <span className="text-muted-foreground">Battery Action:</span>
              <span className="font-semibold text-success capitalize">
                {activePlan.battery_action} ({activePlan.battery_kwh} kW)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Energy After:</span>
              <span className="font-semibold text-success">
                {activePlan.battery_energy_after_kwh} kWh (
                {Math.round(
                  (activePlan.battery_energy_after_kwh / battery.capacity_kwh) *
                    100
                )}
                %)
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Primary Chart 1: 24-Hour Energy Generation & Load Stack */}
      <Card className="border-border bg-card shadow-panel">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                <Layers className="size-4" />
              </div>
              <CardTitle className="font-display text-base">
                24-Hour Microgrid Power Dispatch (kW)
              </CardTitle>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-chart-4" /> Demand
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-primary" /> Solar Used
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-chart-3" /> Grid Import
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-success" /> Battery
                Discharge
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-info" /> Battery Charge
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          <div className="h-56 w-full pt-4 pb-2">
            <svg
              className="h-full w-full overflow-visible"
              preserveAspectRatio="none"
              viewBox="0 0 800 200"
            >
              <title>24-Hour Microgrid Power Dispatch</title>
              {/* Horizontal Grid lines */}
              <line
                stroke="var(--border)"
                strokeDasharray="3 3"
                x1="0"
                x2="800"
                y1="50"
                y2="50"
              />
              <line
                stroke="var(--border)"
                strokeDasharray="3 3"
                x1="0"
                x2="800"
                y1="100"
                y2="100"
              />
              <line
                stroke="var(--border)"
                strokeDasharray="3 3"
                x1="0"
                x2="800"
                y1="150"
                y2="150"
              />

              {/* Bars and lines for each hour */}
              {hourly_plan.map((p, idx) => {
                const input = hours[idx];
                const x = (idx / 24) * 800 + 16;
                const colWidth = 800 / 24 - 4;
                const isHovered = hoveredHour === idx;

                const demandY = 190 - (input.demand_kwh / maxFlow) * 170;
                const solarH = (p.solar_used_kwh / maxFlow) * 170;
                const gridH = (p.grid_kwh / maxFlow) * 170;
                const dischH =
                  p.battery_action === "discharge"
                    ? (p.battery_kwh / maxFlow) * 170
                    : 0;
                const chargeH =
                  p.battery_action === "charge"
                    ? (p.battery_kwh / maxFlow) * 170
                    : 0;

                return (
                  <g
                    aria-label={`Dispatch hour ${p.hour}`}
                    className="cursor-pointer transition-opacity"
                    key={p.hour}
                    onMouseEnter={() => setHoveredHour(idx)}
                    onMouseLeave={() => setHoveredHour(null)}
                    opacity={hoveredHour === null || isHovered ? 1 : 0.4}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Hover highlight column */}
                    {isHovered ? (
                      <rect
                        fill="var(--accent)"
                        height={200}
                        opacity={0.6}
                        rx={4}
                        width={colWidth + 4}
                        x={x - 2}
                        y={0}
                      />
                    ) : null}

                    {/* Stacked generation bar (Grid + Solar + Discharge) */}
                    {/* Grid Import (bottom layer) */}
                    <rect
                      fill="var(--chart-3)"
                      height={gridH}
                      opacity={0.85}
                      rx={2}
                      width={colWidth * 0.45}
                      x={x}
                      y={190 - gridH}
                    />

                    {/* Solar Used (middle layer) */}
                    <rect
                      fill="var(--primary)"
                      height={solarH}
                      rx={2}
                      width={colWidth * 0.45}
                      x={x + colWidth * 0.5}
                      y={190 - solarH}
                    />

                    {/* Battery Discharge */}
                    {dischH > 0 ? (
                      <rect
                        fill="var(--success)"
                        height={dischH}
                        rx={2}
                        width={colWidth * 0.45}
                        x={x}
                        y={190 - gridH - dischH}
                      />
                    ) : null}

                    {/* Battery Charge */}
                    {chargeH > 0 ? (
                      <rect
                        fill="var(--info)"
                        height={chargeH}
                        rx={2}
                        width={colWidth * 0.45}
                        x={x + colWidth * 0.5}
                        y={190 - solarH - chargeH}
                      />
                    ) : null}

                    {/* Demand Target Line Point */}
                    <circle
                      cx={x + colWidth / 2}
                      cy={demandY}
                      fill="var(--foreground)"
                      r={isHovered ? 4 : 2.5}
                    />
                  </g>
                );
              })}

              {/* Connect demand points with a polyline */}
              <polyline
                fill="none"
                points={hours
                  .map((h, idx) => {
                    const x = (idx / 24) * 800 + 16 + (800 / 24 - 4) / 2;
                    const y = 190 - (h.demand_kwh / maxFlow) * 170;
                    return `${x},${y}`;
                  })
                  .join(" ")}
                stroke="var(--chart-4)"
                strokeDasharray="4 2"
                strokeWidth="2"
              />
            </svg>
          </div>

          {/* Time axis labels */}
          <div className="flex justify-between border-border/40 border-t px-2 pt-1 font-mono text-[10px] text-muted-foreground">
            <span>00:00 (Midnight)</span>
            <span>06:00 (Dawn)</span>
            <span>12:00 (Noon)</span>
            <span>18:00 (Dusk)</span>
            <span>23:00 (End of Day)</span>
          </div>
        </CardContent>
      </Card>

      {/* Primary Chart 2: Battery State of Charge (SoC) Trajectory */}
      <Card className="border-border bg-card shadow-panel">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md border border-success/30 bg-success/10 text-success">
                <BatteryCharging className="size-4" />
              </div>
              <CardTitle className="font-display text-base">
                Battery Energy Trajectory & Neutrality (kWh)
              </CardTitle>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-mono text-success">
                <span className="size-2 rounded-full bg-success" /> Stored
                Energy
              </span>
              <span className="flex items-center gap-1 font-mono text-warning">
                <span className="size-2 rounded-full bg-warning" /> Min Reserve
                Floor
              </span>
              <span className="flex items-center gap-1 font-mono text-muted-foreground">
                <span className="size-2 rounded-full bg-muted-foreground" />{" "}
                Neutrality Target ({battery.initial_energy_kwh} kWh)
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          <div className="h-44 w-full pt-4 pb-2">
            <svg
              className="h-full w-full overflow-visible"
              preserveAspectRatio="none"
              viewBox="0 0 800 160"
            >
              <title>Battery Energy Trajectory & Neutrality</title>
              {/* Max Capacity Ceiling Line */}
              <line
                stroke="var(--border)"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                x1="0"
                x2="800"
                y1="10"
                y2="10"
              />
              <text
                fill="var(--muted-foreground)"
                fontFamily="monospace"
                fontSize="9"
                x="8"
                y="22"
              >
                Capacity: {battery.capacity_kwh} kWh
              </text>

              {/* Min Reserve Floor Line */}
              {(() => {
                const reserveY =
                  150 - (battery.minimum_energy_kwh / maxCapacity) * 140;
                return (
                  <>
                    <line
                      stroke="var(--warning)"
                      strokeDasharray="3 3"
                      strokeWidth="1.5"
                      x1="0"
                      x2="800"
                      y1={reserveY}
                      y2={reserveY}
                    />
                    <text
                      fill="var(--warning)"
                      fontFamily="monospace"
                      fontSize="9"
                      x="8"
                      y={reserveY - 4}
                    >
                      Reserve Floor: {battery.minimum_energy_kwh} kWh
                    </text>
                  </>
                );
              })()}

              {/* Initial / Neutrality Baseline */}
              {(() => {
                const initY =
                  150 - (battery.initial_energy_kwh / maxCapacity) * 140;
                return (
                  <line
                    stroke="var(--border)"
                    strokeWidth="1"
                    x1="0"
                    x2="800"
                    y1={initY}
                    y2={initY}
                  />
                );
              })()}

              {/* Energy Trajectory Area */}
              <polygon
                fill="url(#batteryGrad)"
                opacity={0.25}
                points={`0,150 ${hourly_plan
                  .map((p, idx) => {
                    const x = (idx / 23) * 800;
                    const y =
                      150 - (p.battery_energy_after_kwh / maxCapacity) * 140;
                    return `${x},${y}`;
                  })
                  .join(" ")} 800,150`}
              />

              <defs>
                <linearGradient id="batteryGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--success)"
                    stopOpacity="0.8"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--success)"
                    stopOpacity="0.0"
                  />
                </linearGradient>
              </defs>

              {/* Trajectory Stroke */}
              <polyline
                fill="none"
                points={hourly_plan
                  .map((p, idx) => {
                    const x = (idx / 23) * 800;
                    const y =
                      150 - (p.battery_energy_after_kwh / maxCapacity) * 140;
                    return `${x},${y}`;
                  })
                  .join(" ")}
                stroke="var(--success)"
                strokeWidth="2.5"
              />

              {/* Points for each hour */}
              {hourly_plan.map((p, idx) => {
                const x = (idx / 23) * 800;
                const y =
                  150 - (p.battery_energy_after_kwh / maxCapacity) * 140;
                const isHovered = hoveredHour === idx;

                return (
                  <circle
                    aria-label={`Battery state hour ${p.hour}`}
                    className="cursor-pointer"
                    cx={x}
                    cy={y}
                    fill={isHovered ? "var(--foreground)" : "var(--success)"}
                    key={p.hour}
                    onMouseEnter={() => setHoveredHour(idx)}
                    onMouseLeave={() => setHoveredHour(null)}
                    r={isHovered ? 5 : 3}
                    role="button"
                    stroke="var(--background)"
                    strokeWidth="1"
                    tabIndex={0}
                  />
                );
              })}

              {/* Final Neutrality Target Marker at Hour 23 */}
              {(() => {
                const finalX = 800;
                const finalY =
                  150 -
                  (hourly_plan[23].battery_energy_after_kwh / maxCapacity) *
                    140;
                const isNeutral =
                  Math.abs(
                    hourly_plan[23].battery_energy_after_kwh -
                      battery.initial_energy_kwh
                  ) <= 0.01;

                return (
                  <g transform={`translate(${finalX - 30}, ${finalY - 15})`}>
                    <rect
                      fill={isNeutral ? "var(--success)" : "var(--destructive)"}
                      height={20}
                      rx={4}
                      width={40}
                      x={-10}
                      y={-10}
                    />
                    <text
                      fill="var(--background)"
                      fontFamily="monospace"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                      x={10}
                      y={4}
                    >
                      {isNeutral ? "NEUTRAL" : "ERROR"}
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>

          <div className="flex justify-between border-border/40 border-t px-2 pt-1 font-mono text-[10px] text-muted-foreground">
            <span>Hour 0 (Start)</span>
            <span>Hour 6</span>
            <span>Hour 12</span>
            <span>Hour 18</span>
            <span>
              Hour 23 (End: {hourly_plan[23].battery_energy_after_kwh} kWh)
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
