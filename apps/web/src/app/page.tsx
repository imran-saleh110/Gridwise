import { Zap } from "lucide-react";
import { OptimizeDashboard } from "@/features/optimize/optimize-dashboard.tsx";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Application Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-border/60 border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white shadow-sm">
            <Zap className="size-5 fill-amber-400 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold font-display text-foreground text-xl tracking-tight">
                GridWise
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              Campus Microgrid Energy Optimization & Dispatch Control Room
            </p>
          </div>
        </div>
      </header>

      {/* Main Control Room Optimization Dashboard */}
      <OptimizeDashboard />
    </main>
  );
}
