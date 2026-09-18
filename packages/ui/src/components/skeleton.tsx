import { cn } from "@repo/ui/lib/utils";
import type * as React from "react";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-accent/60", className)}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
