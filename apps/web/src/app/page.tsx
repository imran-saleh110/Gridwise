import { HealthDashboard } from "@/features/health/health-dashboard.tsx";
import { HealthStatus } from "@/features/health/health-status.tsx";

export default function HomePage() {
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-8 px-4 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-semibold text-xl tracking-tight">web-scaffold</h1>

        <HealthStatus />
      </header>

      <HealthDashboard />
    </main>
  );
}
