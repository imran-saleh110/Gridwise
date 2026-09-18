"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { CalendarClock, Coins, Sun, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { HourInput } from "../types.ts";

interface HourlyInputTableProps {
  hours: HourInput[];
  onChange: (hours: HourInput[]) => void;
}

export function HourlyInputTable({ hours, onChange }: HourlyInputTableProps) {
  const [viewMode, setViewMode] = useState<"table" | "visual">("visual");

  const handleCellChange = (
    index: number,
    field: keyof HourInput,
    value: number
  ) => {
    const updated = [...hours];
    const safeVal = Number.isNaN(value) ? 0 : Math.max(0, value);
    updated[index] = { ...updated[index], [field]: safeVal };
    onChange(updated);
  };

  const totals = useMemo(() => {
    let totalDemand = 0;
    let totalSolar = 0;
    let weightedTariffSum = 0;

    for (const h of hours) {
      totalDemand += h.demand_kwh;
      totalSolar += h.solar_kwh;
      weightedTariffSum += h.demand_kwh * h.tariff_bdt_per_kwh;
    }

    const avgTariff = totalDemand > 0 ? weightedTariffSum / totalDemand : 0;
    const maxDemand = Math.max(...hours.map((h) => h.demand_kwh), 1);
    const maxSolar = Math.max(...hours.map((h) => h.solar_kwh), 1);
    const maxTariff = Math.max(...hours.map((h) => h.tariff_bdt_per_kwh), 1);

    return {
      avgTariff,
      maxDemand,
      maxSolar,
      maxTariff,
      totalDemand,
      totalSolar,
    };
  }, [hours]);

  // Quick adjust functions
  const scaleDemand = (factor: number) => {
    const updated = hours.map((h) => ({
      ...h,
      demand_kwh: Number((h.demand_kwh * factor).toFixed(1)),
    }));
    onChange(updated);
  };

  const scaleSolar = (factor: number) => {
    const updated = hours.map((h) => ({
      ...h,
      solar_kwh: Number((h.solar_kwh * factor).toFixed(1)),
    }));
    onChange(updated);
  };

  return (
    <Card className="border-border bg-card shadow-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md border border-chart-3/30 bg-chart-3/10 text-chart-3">
              <CalendarClock className="size-4" />
            </div>
            <CardTitle className="font-display text-base">
              24-Hour Input Horizon (Demand, Solar & Tariff)
            </CardTitle>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border bg-muted/60 p-0.5 text-xs">
              <button
                className={`rounded px-2.5 py-1 font-medium transition ${
                  viewMode === "visual"
                    ? "bg-secondary text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("visual")}
                type="button"
              >
                Visual Curves
              </button>
              <button
                className={`rounded px-2.5 py-1 font-medium transition ${
                  viewMode === "table"
                    ? "bg-secondary text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("table")}
                type="button"
              >
                Data Grid
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Day Totals Summary Strip */}
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-secondary/40 p-3 text-xs">
          <div className="flex items-center gap-2">
            <Zap className="size-3.5 text-chart-4" />
            <div>
              <span className="text-muted-foreground">Total Demand:</span>
              <p className="font-mono font-semibold text-foreground">
                {totals.totalDemand.toFixed(1)} kWh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Sun className="size-3.5 text-primary" />
            <div>
              <span className="text-muted-foreground">Total Solar:</span>
              <p className="font-mono font-semibold text-primary">
                {totals.totalSolar.toFixed(1)} kWh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Coins className="size-3.5 text-warning" />
            <div>
              <span className="text-muted-foreground">Avg Tariff:</span>
              <p className="font-mono font-semibold text-warning">
                ৳{totals.avgTariff.toFixed(1)} /kWh
              </p>
            </div>
          </div>
        </div>

        {/* Quick Batch Adjusters */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[11px] text-muted-foreground">
            Quick Modifiers:
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              className="rounded border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => scaleDemand(1.1)}
              type="button"
            >
              Demand +10%
            </button>
            <button
              className="rounded border border-border bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => scaleDemand(0.9)}
              type="button"
            >
              Demand -10%
            </button>
            <button
              className="rounded border border-border bg-secondary px-2 py-0.5 text-[10px] text-primary hover:bg-primary/10"
              onClick={() => scaleSolar(1.2)}
              type="button"
            >
              Solar +20%
            </button>
            <button
              className="rounded border border-border bg-secondary px-2 py-0.5 text-[10px] text-primary hover:bg-primary/10"
              onClick={() => scaleSolar(0.8)}
              type="button"
            >
              Solar -20%
            </button>
          </div>
        </div>

        {viewMode === "visual" ? (
          /* Visual Bar/Curve Matrix */
          <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
            <div className="flex items-center justify-between px-1 pb-1 text-[11px] text-muted-foreground">
              <span>Hour (00:00 - 23:00)</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-chart-4" /> Demand
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-primary" /> Solar
                  Forecast
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-warning" /> Tariff
                  (BDT)
                </span>
              </div>
            </div>

            <div className="grid h-36 grid-cols-12 items-end gap-1 border-border/60 border-b pt-3 pb-1 sm:grid-cols-24">
              {hours.map((h) => {
                const demandHeight = Math.max(
                  4,
                  Math.round((h.demand_kwh / totals.maxDemand) * 90)
                );
                const solarHeight = Math.max(
                  0,
                  Math.round((h.solar_kwh / totals.maxSolar) * 90)
                );
                const tariffIntensity = Math.min(
                  1,
                  h.tariff_bdt_per_kwh / (totals.maxTariff || 1)
                );

                return (
                  <div
                    className="group relative flex h-full w-full flex-col items-center justify-end"
                    key={h.hour}
                  >
                    {/* Tooltip on hover */}
                    <div className="pointer-events-none absolute bottom-full z-20 mb-1 hidden w-24 flex-col items-center rounded border border-border bg-popover p-1.5 text-[10px] shadow-lg group-hover:flex">
                      <span className="font-mono font-semibold text-foreground">
                        {String(h.hour).padStart(2, "0")}:00
                      </span>
                      <span className="text-chart-4">
                        Demand: {h.demand_kwh} kW
                      </span>
                      <span className="text-primary">
                        Solar: {h.solar_kwh} kW
                      </span>
                      <span className="text-warning">
                        Tariff: ৳{h.tariff_bdt_per_kwh}
                      </span>
                    </div>

                    {/* Bars */}
                    <div className="flex h-full w-full items-end justify-center gap-0.5">
                      {/* Solar Bar */}
                      {h.solar_kwh > 0 ? (
                        <div
                          className="w-1/2 rounded-t-sm bg-primary/70 transition-all group-hover:bg-primary"
                          style={{ height: `${solarHeight}%` }}
                        />
                      ) : null}
                      {/* Demand Bar */}
                      <div
                        className="w-1/2 rounded-t-sm bg-chart-4/50 transition-all group-hover:bg-chart-4"
                        style={{ height: `${demandHeight}%` }}
                      />
                    </div>

                    {/* Tariff Dot indicator */}
                    <span
                      className="mt-1 size-1 rounded-full bg-warning"
                      style={{ opacity: 0.3 + tariffIntensity * 0.7 }}
                    />

                    {/* Hour label */}
                    <span className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                      {h.hour % 3 === 0 ? String(h.hour).padStart(2, "0") : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Editable Data Table */
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-secondary/70">
                <TableRow>
                  <TableHead className="w-16 font-mono text-xs">Hour</TableHead>
                  <TableHead className="font-mono text-chart-4 text-xs">
                    Demand (kWh)
                  </TableHead>
                  <TableHead className="font-mono text-primary text-xs">
                    Solar (kWh)
                  </TableHead>
                  <TableHead className="font-mono text-warning text-xs">
                    Tariff (BDT/kWh)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hours.map((h, index) => (
                  <TableRow className="hover:bg-accent/40" key={h.hour}>
                    <TableCell className="py-1 font-mono text-muted-foreground text-xs">
                      {String(h.hour).padStart(2, "0")}:00
                    </TableCell>
                    <TableCell className="py-1">
                      <Input
                        className="h-7 w-28 font-mono text-xs"
                        min={0}
                        onChange={(e) =>
                          handleCellChange(
                            index,
                            "demand_kwh",
                            Number.parseFloat(e.target.value)
                          )
                        }
                        step={1}
                        type="number"
                        value={h.demand_kwh}
                      />
                    </TableCell>
                    <TableCell className="py-1">
                      <Input
                        className="h-7 w-28 font-mono text-xs"
                        min={0}
                        onChange={(e) =>
                          handleCellChange(
                            index,
                            "solar_kwh",
                            Number.parseFloat(e.target.value)
                          )
                        }
                        step={1}
                        type="number"
                        value={h.solar_kwh}
                      />
                    </TableCell>
                    <TableCell className="py-1">
                      <Input
                        className="h-7 w-28 font-mono text-xs"
                        min={0}
                        onChange={(e) =>
                          handleCellChange(
                            index,
                            "tariff_bdt_per_kwh",
                            Number.parseFloat(e.target.value)
                          )
                        }
                        step={0.5}
                        type="number"
                        value={h.tariff_bdt_per_kwh}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
