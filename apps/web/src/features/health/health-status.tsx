import { serverClient } from "@/lib/trpc/server.ts";
import { StatusPill } from "./status-pill.tsx";

export async function HealthStatus() {
  try {
    const { pong } = await serverClient.health.ping.query();

    return (
      <StatusPill
        label={pong ? "api online" : "api degraded"}
        tone={pong ? "success" : "danger"}
      />
    );
  } catch {
    return <StatusPill label="api unreachable" tone="danger" />;
  }
}
