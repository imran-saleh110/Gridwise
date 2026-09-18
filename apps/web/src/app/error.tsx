"use client";

import { Button } from "@repo/ui/components/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-12">
      <h1 className="font-semibold text-xl tracking-tight">
        Something went wrong
      </h1>

      <p className="text-muted-foreground text-sm">{error.message}</p>

      <Button className="justify-self-start" onClick={reset} type="button">
        Try again
      </Button>
    </main>
  );
}
