import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { EnergyChip } from "@repo/ui/components/energy-chip";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Stat } from "@repo/ui/components/stat";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import {
  BatteryCharging,
  CheckCircle2,
  Info,
  PlugZap,
  Sun,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ControlsDemo } from "./controls.tsx";

export const metadata: Metadata = {
  title: "Design system",
};

const swatches = [
  { className: "bg-background border-border", label: "background" },
  { className: "bg-card border-border", label: "card" },
  { className: "bg-muted border-border", label: "muted" },
  { className: "bg-secondary border-border", label: "secondary" },
  { className: "bg-primary border-primary/40", label: "primary · solar" },
  { className: "bg-success border-success/40", label: "success · battery" },
  { className: "bg-chart-3 border-chart-3/40", label: "chart-3 · grid" },
  { className: "bg-warning border-warning/40", label: "warning" },
  { className: "bg-destructive border-destructive/40", label: "destructive" },
  { className: "bg-info border-info/40", label: "info" },
] as const;

const buttons = [
  { label: "Default", variant: "default" },
  { label: "Secondary", variant: "secondary" },
  { label: "Outline", variant: "outline" },
  { label: "Ghost", variant: "ghost" },
  { label: "Destructive", variant: "destructive" },
  { label: "Link", variant: "link" },
] as const;

const schedule = [
  {
    cost: "3.20",
    demand: "42.1",
    grid: "33.7",
    hour: "06",
    solar: "8.4",
    tariff: "9.5",
  },
  {
    cost: "2.52",
    demand: "48.6",
    grid: "25.2",
    hour: "07",
    solar: "21.0",
    tariff: "10.0",
  },
  {
    cost: "1.50",
    demand: "51.9",
    grid: "13.6",
    hour: "08",
    solar: "38.3",
    tariff: "11.0",
  },
  {
    cost: "0.29",
    demand: "47.3",
    grid: "2.4",
    hour: "09",
    solar: "44.9",
    tariff: "12.0",
  },
  {
    cost: "0.00",
    demand: "45.8",
    grid: "0.0",
    hour: "10",
    solar: "45.8",
    tariff: "12.5",
  },
] as const;

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <span className="text-muted-foreground text-sm">
          GridWise · reference
        </span>
        <h1 className="font-display font-semibold text-4xl tracking-tight">
          Design system
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Black is the shell, solar gold is the primary energy, and cyan is
          stored charge. Every token, component, state and interaction lives
          here so the optimization views stay cohesive.
        </p>
      </header>

      <Section title="Color">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {swatches.map((swatch) => (
            <div
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
              key={swatch.label}
            >
              <div
                className={`h-16 rounded-lg bg-clip-padding ${swatch.className}`}
              />
              <span className="text-muted-foreground text-xs">
                {swatch.label}
              </span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-sm">
          Energy flows keep fixed hues — amber for solar, cyan for battery,
          violet for grid, coral for peaks and faults — so a value is always
          recognized by its color across charts, chips and tables.
        </p>
      </Section>

      <Section title="Typography">
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div>
              <span className="text-muted-foreground text-xs">
                Display · Space Grotesk
              </span>
              <p className="font-display font-semibold text-4xl tracking-tight">
                Dispatch the day&apos;s energy
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">
                Body · Inter
              </span>
              <p className="max-w-prose text-sm leading-relaxed">
                The grid, the rooftop and the battery work as one system. The
                optimizer reads the operator notes, respects every constraint,
                and returns a schedule you can inspect hour by hour.
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">
                Mono · JetBrains Mono
              </span>
              <p className="font-mono text-muted-foreground text-sm">
                scenario_7f28 · directive_01::solar_reduction
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">
                Numbers · tabular
              </span>
              <p className="font-display text-2xl tabular-nums">
                1,215.40{" "}
                <span className="text-muted-foreground text-sm">
                  BDT total cost
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          {buttons.map((button) => (
            <Button key={button.variant} variant={button.variant}>
              {button.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {(["xs", "sm", "default", "lg"] as const).map((size) => (
            <Button key={size} size={size}>
              {size}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Badges & chips">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Battery</Badge>
          <Badge variant="secondary">Optimizer</Badge>
          <Badge variant="outline">Baseline</Badge>
          <Badge variant="destructive">Infeasible</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EnergyChip tone="solar">Solar</EnergyChip>
          <EnergyChip active tone="battery">
            Charging
          </EnergyChip>
          <EnergyChip active tone="battery">
            Discharging
          </EnergyChip>
          <EnergyChip tone="grid">Grid import</EnergyChip>
          <EnergyChip tone="success">Validated</EnergyChip>
          <EnergyChip tone="warning">Near peak</EnergyChip>
          <EnergyChip tone="destructive">Over budget</EnergyChip>
          <EnergyChip dot={false} tone="neutral">
            Idle
          </EnergyChip>
        </div>
      </Section>

      <Section title="Alerts">
        <div className="grid gap-3 lg:grid-cols-2">
          <Alert>
            <Info />
            <AlertTitle>Optimization complete</AlertTitle>
            <AlertDescription>
              Schedule replayed and validated in 12ms.
            </AlertDescription>
          </Alert>
          <Alert variant="success">
            <CheckCircle2 />
            <AlertTitle>Within peak limit</AlertTitle>
            <AlertDescription>
              Grid import never exceeds 45 kWh in a single hour.
            </AlertDescription>
          </Alert>
          <Alert variant="warning">
            <TriangleAlert />
            <AlertTitle>Reserve close to floor</AlertTitle>
            <AlertDescription>
              Battery ends the day at its minimum reserve of 20 kWh.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Schedule invalid</AlertTitle>
            <AlertDescription>
              Energy does not balance at hour 17. Fix the export before
              retrying.
            </AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title="Energy metrics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            glow
            hint="6.2% above yesterday"
            icon={<Sun />}
            label="Solar generated"
            tone="solar"
            unit="kWh"
            value="412.8"
          />
          <Stat
            glow
            hint="Charging to full"
            icon={<BatteryCharging />}
            label="Battery stored"
            tone="battery"
            unit="kWh"
            value="184.0"
          />
          <Stat
            hint="2.4 kWh at the noon peak"
            icon={<PlugZap />}
            label="Peak grid import"
            tone="grid"
            unit="kWh"
            value="33.7"
          />
          <Stat
            hint="Saved 28% vs baseline"
            icon={<CheckCircle2 />}
            label="Total grid cost"
            tone="success"
            unit="BDT"
            value="1,215"
          />
        </div>
      </Section>

      <Section title="Schedule table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hour</TableHead>
              <TableHead className="text-right">Demand kWh</TableHead>
              <TableHead className="text-right">Solar kWh</TableHead>
              <TableHead className="text-right">Grid kWh</TableHead>
              <TableHead className="text-right">Tariff</TableHead>
              <TableHead className="text-right">Cost BDT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule.map((row) => (
              <TableRow key={row.hour}>
                <TableCell className="font-medium text-muted-foreground">
                  {row.hour}:00
                </TableCell>
                <TableCell className="text-right">{row.demand}</TableCell>
                <TableCell className="text-right text-primary">
                  {row.solar}
                </TableCell>
                <TableCell className="text-right text-chart-3">
                  {row.grid}
                </TableCell>
                <TableCell className="text-right">{row.tariff}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.cost}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3}>Totals (0:00–10:00)</TableCell>
              <TableCell className="text-right">74.9</TableCell>
              <TableCell />
              <TableCell className="text-right">7.51</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Section>

      <Section title="Controls">
        <ControlsDemo />
      </Section>

      <Section title="Skeleton">
        <div className="flex max-w-md flex-col gap-3">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-8 w-full" />
        </div>
      </Section>
    </main>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display font-semibold text-xl tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}
