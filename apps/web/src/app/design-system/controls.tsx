"use client";

import { BatteryLevel } from "@repo/ui/components/battery";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Progress } from "@repo/ui/components/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { useState } from "react";

export function ControlsDemo() {
  const [charging, setCharging] = useState(true);
  const [tab, setTab] = useState("day");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h3 className="font-display font-medium">Interactions</h3>

        <div className="flex flex-wrap gap-3">
          <TooltipProvider delay={250}>
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" />}>
                Hover for detail
              </TooltipTrigger>
              <TooltipContent side="top">
                Tooltip surfaces on hover and keyboard focus
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Dialog>
            <DialogTrigger render={<Button variant="secondary" />}>
              Open dialog
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm dispatch</DialogTitle>
                <DialogDescription>
                  These changes affect the 24-hour schedule.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogTrigger render={<Button variant="outline" />}>
                  Cancel
                </DialogTrigger>
                <Button>Optimize energy</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs onValueChange={setTab} value={tab}>
          <TabsList variant="line">
            <TabsTrigger value="day">Day view</TabsTrigger>
            <TabsTrigger value="month">Month view</TabsTrigger>
            <TabsTrigger value="year">Year view</TabsTrigger>
          </TabsList>
          <TabsContent value="day">
            Hourly demand, solar and tariff data.
          </TabsContent>
          <TabsContent value="month">
            Rolled-up weekly and monthly totals.
          </TabsContent>
          <TabsContent value="year">Seasonal yield and savings.</TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <Switch
              aria-label="Charging"
              checked={charging}
              onCheckedChange={setCharging}
            />
            Charging
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span>Tariff</span>
            <Select defaultValue="peak">
              <SelectTrigger aria-label="Tariff" className="w-40" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="peak">Peak rate</SelectItem>
                <SelectItem value="offpeak">Off-peak rate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h3 className="font-display font-medium">Charge & lag</h3>

        <div className="flex flex-col gap-3">
          <BatteryLevel charging={charging} value={72} />
          <BatteryLevel size="lg" value={34} />
          <BatteryLevel label="Critical" size="sm" value={8} />
          <BatteryLevel label="Full" value={100} />
        </div>

        <Progress value={progressFor(tab)} />

        <p className="text-muted-foreground text-sm">
          Battery reads from left to right; the moving highlight marks an active
          charge. Progress tracks proportional fill across the 24 hours.
        </p>
      </section>
    </div>
  );
}

function progressFor(tab: string) {
  if (tab === "day") {
    return 28;
  }
  if (tab === "month") {
    return 62;
  }
  return 94;
}
