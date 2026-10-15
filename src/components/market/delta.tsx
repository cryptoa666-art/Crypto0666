import { formatPct, isUp } from "@/lib/crypto/format";
import { cn } from "@/lib/utils";

export function Delta({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const up = isUp(value);
  return (
    <span
      className={cn(
        "font-mono text-sm tabular-nums",
        value === null || value === undefined ? "text-subtle" : up ? "text-gain" : "text-loss",
        className,
      )}
    >
      {formatPct(value)}
    </span>
  );
}
