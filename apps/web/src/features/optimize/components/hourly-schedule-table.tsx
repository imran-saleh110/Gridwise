"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { EnergyChip } from "@repo/ui/components/energy-chip";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { CalendarDays, Filter } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  BatteryAction,
  OptimizationResponse,
  ScenarioInput,
} from "../types.ts";

interface HourlyScheduleTableProps {
  plan: OptimizationResponse;
  scenario: ScenarioInput;
}

function renderBatteryChip(action: BatteryAction) {
  if (action === "charge") {
    return (
      <EnergyChip dot tone="battery">
        Charge
      </EnergyChip>
    );
  }
  if (action === "discharge") {
    return (
      <EnergyChip dot tone="solar">
        Discharge
      </EnergyChip>
    );
  }
  return (
    <EnergyChip dot={false} tone="neutral">
      Idle
    </EnergyChip>
  );
}

export function HourlyScheduleTable({
  scenario,
  plan,
}: HourlyScheduleTableProps) {
  const [filterMode, setFilterMode] = useState<
    "all" | "solar" | "battery" | "peak"
  >("all");

  const { hours, battery } = scenario;
  const { hourly_plan } = plan;

  const filteredHours = useMemo(
    () =>
      hourly_plan.filter((p, idx) => {
        const input = hours[idx];
        if (filterMode === "solar") {
          return input.solar_kwh > 0;
        }
        if (filterMode === "battery") {
          return p.battery_action !== "idle";
        }
        if (filterMode === "peak") {
          return input.tariff_bdt_per_kwh >= 18;
        }
        return true;
      }),
    [hourly_plan, hours, filterMode]
  );

  const totals = useMemo(() => {
    let demand = 0;
    let solarAvail = 0;
    let solarUsed = 0;
    let grid = 0;
    let cost = 0;
    let totalDischarge = 0;
    let totalCharge = 0;

    for (let i = 0; i < 24; i += 1) {
      const inp = hours[i];
      const pln = hourly_plan[i];
      demand += inp?.demand_kwh ?? 0;
      solarAvail += inp?.solar_kwh ?? 0;
      solarUsed += pln?.solar_used_kwh ?? 0;
      grid += pln?.grid_kwh ?? 0;
      cost += (pln?.grid_kwh ?? 0) * (inp?.tariff_bdt_per_kwh ?? 0);
      if (pln?.battery_action === "discharge") {
        totalDischarge += pln.battery_kwh;
      }
      if (pln?.battery_action === "charge") {
        totalCharge += pln.battery_kwh;
      }
    }

    return {
      cost,
      demand,
      grid,
      solarAvail,
      solarUsed,
      totalCharge,
      totalDischarge,
    };
  }, [hours, hourly_plan]);

  return (
    <Card className="border-border bg-card shadow-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <CalendarDays className="size-4" />
            </div>
            <CardTitle className="font-display text-base">
              24-Hour Dispatch Schedule & Balance Sheet
            </CardTitle>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="size-3.5 text-muted-foreground" />
            <div className="flex rounded-md border border-border bg-muted/60 p-0.5">
              <button
                className={`rounded px-2 py-0.5 font-medium transition ${
                  filterMode === "all"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilterMode("all")}
                type="button"
              >
                All (24h)
              </button>
              <button
                className={`rounded px-2 py-0.5 font-medium transition ${
                  filterMode === "solar"
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilterMode("solar")}
                type="button"
              >
                Solar Hours
              </button>
              <button
                className={`rounded px-2 py-0.5 font-medium transition ${
                  filterMode === "battery"
                    ? "bg-secondary text-success"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilterMode("battery")}
                type="button"
              >
                Battery Action
              </button>
              <button
                className={`rounded px-2 py-0.5 font-medium transition ${
                  filterMode === "peak"
                    ? "bg-secondary text-warning"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilterMode("peak")}
                type="button"
              >
                Peak Tariffs
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader className="bg-secondary/80">
              <TableRow>
                <TableHead className="w-16 font-mono text-xs">Hour</TableHead>
                <TableHead className="text-right font-mono text-chart-4 text-xs">
                  Demand (kW)
                </TableHead>
                <TableHead className="text-right font-mono text-primary text-xs">
                  Solar Avail
                </TableHead>
                <TableHead className="text-right font-mono text-primary text-xs">
                  Solar Used
                </TableHead>
                <TableHead className="text-center font-mono text-xs">
                  Battery Action
                </TableHead>
                <TableHead className="text-right font-mono text-success text-xs">
                  Battery kW
                </TableHead>
                <TableHead className="text-right font-mono text-success text-xs">
                  Energy After (SoC)
                </TableHead>
                <TableHead className="text-right font-mono text-chart-3 text-xs">
                  Grid Import
                </TableHead>
                <TableHead className="text-right font-mono text-warning text-xs">
                  Tariff (BDT)
                </TableHead>
                <TableHead className="text-right font-bold font-mono text-foreground text-xs">
                  Hourly Cost
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredHours.map((planItem) => {
                const hourIdx = planItem.hour;
                const inputItem = hours[hourIdx];
                const hourlyCost =
                  planItem.grid_kwh * (inputItem?.tariff_bdt_per_kwh ?? 0);
                const socPercent = Math.round(
                  (planItem.battery_energy_after_kwh / battery.capacity_kwh) *
                    100
                );
                const isCurtailed =
                  inputItem.solar_kwh > 0 &&
                  planItem.solar_used_kwh < inputItem.solar_kwh;

                return (
                  <TableRow
                    className="font-mono text-xs hover:bg-accent/40"
                    key={planItem.hour}
                  >
                    <TableCell className="font-semibold text-muted-foreground">
                      {String(planItem.hour).padStart(2, "0")}:00
                    </TableCell>

                    <TableCell className="text-right text-chart-4">
                      {inputItem.demand_kwh.toFixed(1)}
                    </TableCell>

                    <TableCell className="text-right text-muted-foreground">
                      {inputItem.solar_kwh.toFixed(1)}
                    </TableCell>

                    <TableCell className="text-right font-medium text-primary">
                      {planItem.solar_used_kwh.toFixed(1)}
                      {isCurtailed ? (
                        <span
                          className="ml-1 text-[9px] text-warning"
                          title="Solar curtailed"
                        >
                          *
                        </span>
                      ) : null}
                    </TableCell>

                    <TableCell className="text-center">
                      {renderBatteryChip(planItem.battery_action)}
                    </TableCell>

                    <TableCell className="text-right text-success">
                      {planItem.battery_kwh > 0
                        ? planItem.battery_kwh.toFixed(1)
                        : "—"}
                    </TableCell>

                    <TableCell className="text-right font-medium text-success">
                      {planItem.battery_energy_after_kwh.toFixed(1)} kWh{" "}
                      <span className="text-[10px] text-muted-foreground">
                        ({socPercent}%)
                      </span>
                    </TableCell>

                    <TableCell className="text-right font-semibold text-chart-3">
                      {planItem.grid_kwh.toFixed(1)}
                    </TableCell>

                    <TableCell className="text-right text-warning">
                      ৳{inputItem.tariff_bdt_per_kwh.toFixed(1)}
                    </TableCell>

                    <TableCell className="text-right font-semibold text-foreground">
                      ৳{hourlyCost.toFixed(1)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>

            <TableFooter className="bg-secondary font-bold font-mono text-xs">
              <TableRow>
                <TableCell>Total (24h)</TableCell>
                <TableCell className="text-right text-chart-4">
                  {totals.demand.toFixed(1)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {totals.solarAvail.toFixed(1)}
                </TableCell>
                <TableCell className="text-right text-primary">
                  {totals.solarUsed.toFixed(1)}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  Chg: {totals.totalCharge.toFixed(1)} / Dis:{" "}
                  {totals.totalDischarge.toFixed(1)}
                </TableCell>
                <TableCell className="text-right text-success">—</TableCell>
                <TableCell className="text-right text-success">
                  End: {hourly_plan[23].battery_energy_after_kwh} kWh
                </TableCell>
                <TableCell className="text-right text-chart-3">
                  {totals.grid.toFixed(1)}
                </TableCell>
                <TableCell className="text-right text-warning">—</TableCell>
                <TableCell className="text-right text-primary">
                  ৳{totals.cost.toFixed(1)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
