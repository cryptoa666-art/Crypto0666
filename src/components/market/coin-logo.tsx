import { useState } from "react";
import { cn } from "@/lib/utils";

export function CoinLogo({
  symbol,
  size = 32,
  className,
}: {
  symbol: string;
  size?: number;
  className?: string;
}) {
  const [srcI, setSrcI] = useState(0);
  const s = symbol.toLowerCase();
  const srcs = [
    `https://assets.coincap.io/assets/icons/${s}@2x.png`,
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${s}.png`,
  ];

  if (srcI >= srcs.length) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-[10px] text-muted",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {symbol.slice(0, 3).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={srcs[srcI]}
      alt=""
      width={size}
      height={size}
      className={cn("coin-logo shrink-0 rounded-full bg-surface-3 object-cover", className)}
      style={{ width: size, height: size }}
      loading="lazy"
      onError={() => setSrcI((i) => i + 1)}
    />
  );
}
