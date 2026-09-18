import { trpc } from "@repo/trpc";

export function useHealthHistory() {
  return trpc.health.history.useQuery({ limit: 10 }, { retry: false });
}

export function useHealthPing() {
  return trpc.health.ping.useQuery(undefined, { retry: false });
}
