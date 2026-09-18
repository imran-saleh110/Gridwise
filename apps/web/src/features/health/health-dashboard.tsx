"use client";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { useCallback } from "react";
import { useHealthHistory, useHealthPing } from "./health.hooks.ts";
import { HealthCheckForm } from "./health-check-form.tsx";
import { StatusPill } from "./status-pill.tsx";

export function HealthDashboard() {
  const ping = useHealthPing();
  const history = useHealthHistory();

  const onRecorded = useCallback(() => history.refetch(), [history]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>API health</CardTitle>

        <CardDescription>
          Records a health check and lists recent ones, proving the full web →
          tRPC → Hono → Drizzle → Neon path.
        </CardDescription>

        <CardAction>
          <StatusPill
            label={ping.isSuccess ? "online" : "unreachable"}
            tone={ping.isSuccess ? "success" : "danger"}
          />
        </CardAction>
      </CardHeader>

      <CardContent>
        <HealthCheckForm onRecorded={onRecorded} />
      </CardContent>

      {history.isSuccess ? (
        <CardFooter>
          <HealthHistory records={history.data.records} />
        </CardFooter>
      ) : null}
    </Card>
  );
}

function HealthHistory({ records }: { records: HistoryRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="m-0 text-muted-foreground text-sm">
        No health checks recorded yet.
      </p>
    );
  }

  return (
    <ul
      aria-label="Recent health checks"
      className="m-0 flex w-full list-none flex-col gap-1 p-0"
    >
      {records.map((record) => (
        <li
          className="flex items-center justify-between gap-4 border-border border-b py-1.5 text-sm last:border-b-0"
          key={record.id}
        >
          <span>{record.source}</span>

          <time
            className="text-muted-foreground text-xs"
            dateTime={record.createdAt.toISOString()}
          >
            {record.createdAt.toLocaleString()}
          </time>
        </li>
      ))}
    </ul>
  );
}

interface HistoryRecord {
  createdAt: Date;
  detail: string | null;
  id: string;
  source: string;
}
