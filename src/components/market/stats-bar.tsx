import type { ReactNode } from "react";
import type { FearGreed, GlobalStats } from "@/lib/crypto/types";
import { formatMarketCap, formatPct, type QuoteCurrency } from "@/lib/crypto/format";
import { cn } from "@/lib/utils";

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="text-xs text-subtle">{label}</div>
      <div className="mt-1 font-medium tabular-nums leading-snug">{children}</div>
    </div>
  );
}

export function StatsBar({
  global,
  fearGreed,
  currency,
  usdToToman,
}: {
  global: GlobalStats | null;
  fearGreed: FearGreed | null;
  currency: QuoteCurrency;
  usdToToman: number | null;
}) {
  if (!global && !fearGreed) return null;
  const capUp = (global?.marketCapChange24h ?? 0) >= 0;

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Cell label="ارزش کل بازار">
        {global ? formatMarketCap(global.marketCap, currency, usdToToman) : "—"}
        {global ? (
          <span className={cn("ms-2 text-xs", capUp ? "text-gain" : "text-loss")}>
            {formatPct(global.marketCapChange24h)}
          </span>
        ) : null}
      </Cell>
      <Cell label="حجم ۲۴ ساعت">
        {global ? formatMarketCap(global.volume24h, currency, usdToToman) : "—"}
      </Cell>
      <Cell label="سلطه بیت‌کوین">
        {global ? `${global.btcDominance.toFixed(1)}%` : "—"}
      </Cell>
      <Cell label="شاخص ترس و طمع">
        {fearGreed ? (
          <span className="flex items-center gap-2">
            <span className="font-mono tabular-nums">{fearGreed.value}</span>
            <span className="text-xs font-normal text-muted">{fearGreed.label}</span>
          </span>
        ) : (
          "—"
        )}
      </Cell>
    </div>
  );
}
