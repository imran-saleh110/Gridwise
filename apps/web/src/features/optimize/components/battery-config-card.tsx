"use client";

import { BatteryLevel } from "@repo/ui/components/battery";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { BatteryCharging, ShieldAlert } from "lucide-react";
import type { BatteryConfig } from "../types.ts";

interface BatteryConfigCardProps {
  battery: BatteryConfig;
  onChange: (battery: BatteryConfig) => void;
}

export function BatteryConfigCard({
  battery,
  onChange,
}: BatteryConfigCardProps) {
  const update = (field: keyof BatteryConfig, val: number) => {
    const num = Number.isNaN(val) ? 0 : Math.max(0, val);
    onChange({ ...battery, [field]: num });
  };

  const initialSoc =
    battery.capacity_kwh > 0
      ? Math.round((battery.initial_energy_kwh / battery.capacity_kwh) * 100)
      : 0;

  const minReserveSoc =
    battery.capacity_kwh > 0
      ? Math.round((battery.minimum_energy_kwh / battery.capacity_kwh) * 100)
      : 0;

  const hoursToFullCharge =
    battery.max_charge_kwh_per_hour > 0
      ? (
          (battery.capacity_kwh - battery.initial_energy_kwh) /
          battery.max_charge_kwh_per_hour
        ).toFixed(1)
      : "—";

  return (
    <Card className="border-border bg-card shadow-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md border border-success/30 bg-success/10 text-success">
              <BatteryCharging className="size-4" />
            </div>
            <CardTitle className="font-display text-base">
              BESS Battery Storage System
            </CardTitle>
          </div>
          <span className="font-mono text-muted-foreground text-xs">
            {battery.capacity_kwh} kWh Storage
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Live Visual Battery Status Bar */}
        <div className="rounded-lg border border-border bg-secondary/50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Initial State of Charge:
            </span>
            <span className="font-medium font-mono text-success">
              {battery.initial_energy_kwh} kWh ({initialSoc}%)
            </span>
          </div>
          <BatteryLevel
            charging={false}
            className="w-full justify-between"
            size="md"
            tone="battery"
            value={initialSoc}
          />
          <div className="mt-2 flex items-center justify-between border-border/40 border-t pt-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldAlert className="size-3 text-warning" />
              Min Reserve: {battery.minimum_energy_kwh} kWh ({minReserveSoc}%)
            </span>
            <span>To 100%: ~{hoursToFullCharge}h</span>
          </div>
        </div>

        {/* Input Parameters Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              Capacity (kWh)
            </Label>
            <Input
              className="h-8 font-mono text-xs"
              min={1}
              onChange={(e) =>
                update("capacity_kwh", Number.parseFloat(e.target.value))
              }
              type="number"
              value={battery.capacity_kwh}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              Initial Energy (kWh)
            </Label>
            <Input
              className="h-8 font-mono text-xs"
              max={battery.capacity_kwh}
              min={0}
              onChange={(e) =>
                update("initial_energy_kwh", Number.parseFloat(e.target.value))
              }
              type="number"
              value={battery.initial_energy_kwh}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              Min Reserve (kWh)
            </Label>
            <Input
              className="h-8 font-mono text-xs"
              max={battery.capacity_kwh}
              min={0}
              onChange={(e) =>
                update("minimum_energy_kwh", Number.parseFloat(e.target.value))
              }
              type="number"
              value={battery.minimum_energy_kwh}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              Max Charge (kWh/h)
            </Label>
            <Input
              className="h-8 font-mono text-xs"
              min={1}
              onChange={(e) =>
                update(
                  "max_charge_kwh_per_hour",
                  Number.parseFloat(e.target.value)
                )
              }
              type="number"
              value={battery.max_charge_kwh_per_hour}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">
              Max Discharge (kWh/h)
            </Label>
            <Input
              className="h-8 font-mono text-xs"
              min={1}
              onChange={(e) =>
                update(
                  "max_discharge_kwh_per_hour",
                  Number.parseFloat(e.target.value)
                )
              }
              type="number"
              value={battery.max_discharge_kwh_per_hour}
            />
          </div>

          <div className="flex flex-col justify-end">
            <div className="rounded border border-border/80 bg-muted/40 p-1.5 text-center text-[10px] text-muted-foreground">
              End-of-day target:{" "}
              <span className="font-mono text-foreground">
                {battery.initial_energy_kwh} kWh
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
