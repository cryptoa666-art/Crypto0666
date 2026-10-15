const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const USD_SMALL = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

const COMPACT_EN = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const TOMAN = new Intl.NumberFormat("fa-IR", {
  maximumFractionDigits: 0,
});

const TOMAN_SMALL = new Intl.NumberFormat("fa-IR", {
  maximumFractionDigits: 2,
});

const PCT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export type QuoteCurrency = "usd" | "toman";

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1) return USD_SMALL.format(value);
  return USD.format(value);
}

const TOMAN_COMPACT = new Intl.NumberFormat("fa-IR", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function spaceFaCompact(value: string): string {
  return value.replace(/(میلیون|میلیارد|تریلیون|هزار)/g, "\u00a0$1").replace(/\s+/g, "\u00a0");
}

export function formatToman(usd: number, usdToToman: number): string {
  const t = usd * usdToToman;
  if (!Number.isFinite(t)) return "—";
  if (Math.abs(t) < 1) return `${TOMAN_SMALL.format(t)} تومان`;
  if (Math.abs(t) >= 1e15) return formatCompactToman(usd, usdToToman);
  if (Math.abs(t) >= 1_000_000) return `${spaceFaCompact(TOMAN_COMPACT.format(t))} تومان`;
  return `${TOMAN.format(t)} تومان`;
}

export function formatPrice(
  usd: number,
  currency: QuoteCurrency,
  usdToToman: number | null,
): string {
  if (currency === "toman" && usdToToman) return formatToman(usd, usdToToman);
  return formatUsd(usd);
}

export function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${COMPACT_EN.format(value)}`;
}

export function formatCompactToman(usd: number, usdToToman: number): string {
  const t = usd * usdToToman;
  if (!Number.isFinite(t)) return "—";
  if (Math.abs(t) >= 1e15) {
    const n = t / 1e15;
    return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(n)}\u00a0هزار تریلیون تومان`;
  }
  return `${spaceFaCompact(
    new Intl.NumberFormat("fa-IR", { notation: "compact", maximumFractionDigits: 1 }).format(t),
  )} تومان`;
}

export function formatMarketCap(
  usd: number,
  currency: QuoteCurrency,
  usdToToman: number | null,
): string {
  if (currency === "toman" && usdToToman) return formatCompactToman(usd, usdToToman);
  return formatCompactUsd(usd);
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${PCT.format(value)}%`;
}

export function formatAmount(value: number, symbol: string): string {
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 6;
  const n = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
  return `${n} ${symbol}`;
}

export function isUp(value: number | null | undefined): boolean {
  return (value ?? 0) >= 0;
}
