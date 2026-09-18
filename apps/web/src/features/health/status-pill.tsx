import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

type StatusTone = "success" | "danger";

interface StatusPillProps {
  label: string;
  tone: StatusTone;
}

const toneClasses: Record<StatusTone, string> = {
  danger: "bg-destructive/15 text-destructive",
  success: "bg-success/15 text-success",
};

export function StatusPill({ tone, label }: StatusPillProps) {
  return (
    <Badge
      className={cn("h-5 px-2 font-semibold", toneClasses[tone])}
      variant="outline"
    >
      {label}
    </Badge>
  );
}
