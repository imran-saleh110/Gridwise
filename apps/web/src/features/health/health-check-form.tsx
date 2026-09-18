"use client";

import { healthReportSchema, trpc } from "@repo/trpc";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import type { ChangeEvent, SyntheticEvent } from "react";
import { useCallback, useState } from "react";

interface HealthCheckFormProps {
  onRecorded: () => void;
}

export function HealthCheckForm({ onRecorded }: HealthCheckFormProps) {
  const {
    isError,
    isPending,
    mutate: recordCheck,
  } = trpc.health.report.useMutation({
    onSuccess: onRecorded,
  });

  const [source, setSource] = useState("web");
  const [detail, setDetail] = useState("");

  const canSubmit = healthReportSchema.safeParse({
    detail: detail.trim() || null,
    source,
  }).success;

  const onSubmit = useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();

      recordCheck({ detail: detail.trim() || null, source });
      setDetail("");
    },
    [detail, recordCheck, source]
  );

  const onSourceChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSource(event.target.value),
    []
  );

  const onDetailChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setDetail(event.target.value),
    []
  );

  return (
    <form
      className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_2fr_auto]"
      onSubmit={onSubmit}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="health-source">Source</Label>

        <Input
          id="health-source"
          maxLength={64}
          onChange={onSourceChange}
          required
          value={source}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="health-detail">Detail</Label>

        <Input
          id="health-detail"
          maxLength={255}
          onChange={onDetailChange}
          placeholder="optional note"
          value={detail}
        />
      </div>

      <Button
        aria-busy={isPending}
        disabled={!canSubmit || isPending}
        type="submit"
      >
        Record check
      </Button>

      {isError ? (
        <p className="col-span-full m-0 text-destructive text-sm">
          Could not record the check.
        </p>
      ) : null}
    </form>
  );
}
