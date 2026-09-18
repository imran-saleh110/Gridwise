import { Palette, Zap } from "lucide-react";
import Link from "next/link";
import { HealthStatus } from "@/features/health/health-status.tsx";
import { OptimizeDashboard } from "@/features/optimize/optimize-dashboard.tsx";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Application Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-border/60 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary shadow-glow-solar">
            <Zap className="size-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold font-display text-foreground text-xl tracking-tight">
                GridWise
              </span>
              <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono font-semibold text-[10px] text-primary">
                v2.0
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              Campus Microgrid Energy Optimization & Dispatch Control Room
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/80 px-3 py-1.5 font-medium text-muted-foreground text-xs transition hover:border-primary/40 hover:text-foreground"
            href="/design-system"
          >
            <Palette className="size-3.5 text-primary" />
            <span>Design System</span>
          </Link>
          <HealthStatus />
        </div>
      </header>

      {/* Main Control Room Optimization Dashboard */}
      <OptimizeDashboard />
    </main>
  );
}
