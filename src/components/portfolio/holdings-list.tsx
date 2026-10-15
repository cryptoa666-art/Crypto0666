import { useState, type FormEvent } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import type { MarketCoin } from "@/lib/crypto/types";
import { faName } from "@/lib/crypto/names";
import {
  formatAmount,
  formatPct,
  formatPrice,
  isUp,
  type QuoteCurrency,
} from "@/lib/crypto/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CoinLogo } from "@/components/market/coin-logo";
import { usePortfolio, type Holding } from "@/lib/portfolio/store";
import { cn } from "@/lib/utils";

const SLICE = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-muted)",
  "var(--color-gain)",
  "var(--color-loss)",
  "var(--color-subtle)",
  "var(--color-fg)",
];

type Row = Holding & {
  price: number | null;
  value: number;
  cost: number;
  pnl: number;
  pnlPct: number | null;
};

export function PortfolioSummary({
  rows,
  currency,
  usdToToman,
}: {
  rows: Row[];
  currency: QuoteCurrency;
  usdToToman: number | null;
}) {
  const value = rows.reduce((s, r) => s + r.value, 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const pnl = value - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : null;
  const up = isUp(pnl);
  const chart = rows
    .filter((r) => r.value > 0)
    .map((r) => ({ name: r.symbol, value: r.value }));

  return (
    <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
      <div className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <div className="text-xs text-subtle">ارزش کل پورتفولیو</div>
        <div className="mt-2 font-mono text-3xl font-medium tabular-nums tracking-tight">
          {formatPrice(value, currency, usdToToman)}
        </div>
        <div className={cn("mt-2 font-mono text-sm tabular-nums", up ? "text-gain" : "text-loss")}>
          {formatPrice(pnl, currency, usdToToman)}{" "}
          <span className="text-xs">({formatPct(pnlPct)})</span>
          <span className="ms-2 text-xs text-subtle">نسبت به قیمت خرید</span>
        </div>
      </div>
      <div className="rounded-3xl bg-surface p-3 shadow-[var(--shadow-border)]">
        {chart.length ? (
          <div className="flex h-40 items-center gap-3">
            <div className="h-40 w-40 shrink-0" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={42}
                    outerRadius={68}
                    stroke="none"
                    paddingAngle={2}
                  >
                    {chart.map((_, i) => (
                      <Cell key={chart[i].name} fill={SLICE[i % SLICE.length]} />
                    ))}
                  </Pie>
                  <RTooltip
                    formatter={(v) => formatPrice(Number(v ?? 0), currency, usdToToman)}
                    contentStyle={{
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {chart.slice(0, 5).map((c, i) => (
                <li key={c.name} className="flex items-center gap-2 text-xs text-muted">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: SLICE[i % SLICE.length] }}
                  />
                  <span className="font-mono">{c.name}</span>
                  <span className="ms-auto font-mono tabular-nums">
                    {value ? `${((c.value / value) * 100).toFixed(0)}%` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-muted">
            هنوز سهمی برای نمودار نیست
          </div>
        )}
      </div>
    </div>
  );
}

export function HoldingsList({
  rows,
  currency,
  usdToToman,
}: {
  rows: Row[];
  currency: QuoteCurrency;
  usdToToman: number | null;
}) {
  const remove = usePortfolio((s) => s.removeHolding);

  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-border)]">
      <ul>
        {rows.map((row) => {
          const up = isUp(row.pnl);
          return (
            <li
              key={row.key}
              className="flex items-center gap-3 border-t border-border px-3 py-3 first:border-t-0 sm:px-4"
            >
              <CoinLogo symbol={row.symbol} size={36} />
              <Link
                to="/coin/$id"
                params={{ id: row.id }}
                className="min-w-0 flex-1 hover:text-fg"
              >
                <div className="truncate text-sm font-medium">
                  {faName(row.symbol, row.name)}
                  <span className="ms-2 font-mono text-[11px] text-subtle">{row.symbol}</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-subtle">
                  مقدار {formatAmount(row.amount, row.symbol)}
                </div>
                <div className="font-mono text-[11px] tabular-nums text-subtle">
                  قیمت زنده{" "}
                  {row.price !== null ? formatPrice(row.price, currency, usdToToman) : "—"}
                  <span className="mx-1">·</span>
                  خرید {formatPrice(row.avgBuyUsd, currency, usdToToman)}
                </div>
              </Link>
              <div className="shrink-0 text-end">
                <div className="font-mono text-sm tabular-nums">
                  {row.price !== null ? formatPrice(row.value, currency, usdToToman) : "—"}
                </div>
                <div
                  className={cn(
                    "font-mono text-[11px] tabular-nums",
                    up ? "text-gain" : "text-loss",
                  )}
                >
                  {formatPrice(row.pnl, currency, usdToToman)} · {formatPct(row.pnlPct)}
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <EditHolding row={row} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="حذف"
                  onClick={() => remove(row.key)}
                >
                  <Trash2 className="size-4 text-subtle" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EditHolding({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(row.amount));
  const [avg, setAvg] = useState(String(row.avgBuyUsd));
  const updateHolding = usePortfolio((s) => s.updateHolding);

  function submit(e: FormEvent) {
    e.preventDefault();
    const amt = Number(amount.replace(/,/g, ""));
    const buy = Number(avg.replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) return;
    if (!Number.isFinite(buy) || buy < 0) return;
    updateHolding(row.key, { amount: amt, avgBuyUsd: buy });
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setAmount(String(row.amount));
          setAvg(String(row.avgBuyUsd));
        }
      }}
    >
      <Button variant="ghost" size="icon-sm" aria-label="ویرایش" onClick={() => setOpen(true)}>
        <Pencil className="size-4 text-subtle" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ویرایش {faName(row.symbol, row.name)}</DialogTitle>
          <DialogDescription>مقدار و میانگین قیمت خرید را به‌روز کن.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`amt-${row.key}`}>مقدار</Label>
              <Input
                id={`amt-${row.key}`}
                inputMode="decimal"
                dir="ltr"
                className="font-mono"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`avg-${row.key}`}>میانگین خرید (دلار)</Label>
              <Input
                id={`avg-${row.key}`}
                inputMode="decimal"
                dir="ltr"
                className="font-mono"
                value={avg}
                onChange={(e) => setAvg(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="w-full">
            ذخیره
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function buildRows(holdings: Holding[], coins: MarketCoin[]): Row[] {
  const byId = new Map(coins.map((c) => [c.id, c]));
  const bySym = new Map(coins.map((c) => [c.symbol.toUpperCase(), c]));
  return holdings.map((h) => {
    const coin = byId.get(h.id) ?? bySym.get(h.symbol.toUpperCase());
    const price = coin?.price ?? null;
    const value = price !== null ? price * h.amount : 0;
    const cost = h.avgBuyUsd * h.amount;
    const pnl = value - cost;
    const pnlPct = cost > 0 && price !== null ? (pnl / cost) * 100 : null;
    return { ...h, price, value, cost, pnl, pnlPct };
  });
}
