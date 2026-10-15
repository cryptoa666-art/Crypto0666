import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Newspaper } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CoinChart } from "@/components/market/coin-chart";
import { CoinLogo } from "@/components/market/coin-logo";
import { Delta } from "@/components/market/delta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoinDetail, useMarkets } from "@/lib/crypto/hooks";
import { faName } from "@/lib/crypto/names";
import { formatMarketCap, formatPrice, formatUsd, isUp } from "@/lib/crypto/format";
import { USE_META } from "@/lib/crypto/categories";
import { usePortfolio } from "@/lib/portfolio/store";
import { AddHoldingButton } from "@/components/portfolio/add-holding";

export const Route = createFileRoute("/coin/$id")({ component: CoinPage });

const RANGES = [
  { days: 1, label: "۲۴س" },
  { days: 7, label: "۷روز" },
  { days: 30, label: "۳۰روز" },
  { days: 90, label: "۹۰روز" },
];

function CoinPage() {
  const { id } = Route.useParams();
  const [days, setDays] = useState(7);
  const { data, isLoading, isError, refetch } = useCoinDetail(id, days);
  const markets = useMarkets();
  const currency = usePortfolio((s) => s.currency);
  const usdToToman = markets.data?.usdToToman ?? null;
  const coin = data?.coin;
  const up = isUp(
    days === 1
      ? coin?.change24h
      : days === 7
        ? coin?.change7d
        : (coin?.change30d ?? coin?.change7d),
  );

  return (
    <AppShell active="market">
      <div className="space-y-5">
        <Link
          to="/"
          className="inline-flex h-10 items-center gap-1 text-sm text-muted hover:text-fg"
        >
          <ArrowRight className="size-4" />
          بازگشت به بازار
        </Link>

        {isLoading && !coin ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-56 w-full rounded-3xl" />
          </div>
        ) : isError || !coin ? (
          <div className="rounded-3xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-border)]">
            <p className="text-muted">اطلاعات این ارز در دسترس نیست.</p>
            <button
              type="button"
              className="mt-3 text-sm text-accent underline-offset-4 hover:underline"
              onClick={() => refetch()}
            >
              تلاش دوباره
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <CoinLogo symbol={coin.symbol} size={48} />
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {faName(coin.symbol, coin.name)}
                  </h1>
                  <p className="font-mono text-sm uppercase text-subtle">
                    {coin.symbol}
                    {coin.rank ? ` · رتبه #${coin.rank}` : ""}
                  </p>
                  <p className="mt-1 max-w-md text-xs text-muted">
                    <span className="text-fg">{USE_META[coin.category].label}</span>
                    {" — "}
                    {USE_META[coin.category].blurb}
                  </p>
                </div>
              </div>
              <AddHoldingButton
                preset={{
                  id: coin.id,
                  name: coin.name,
                  symbol: coin.symbol,
                  rank: coin.rank,
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/news"
                search={{ q: coin.symbol }}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm text-muted shadow-[var(--shadow-border)] hover:text-fg"
              >
                <Newspaper className="size-4" />
                بنیادی یک سال این ارز
              </Link>
            </div>

            <div className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)] md:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="font-mono text-3xl font-medium tabular-nums">
                    {formatPrice(coin.price, currency, usdToToman)}
                  </div>
                  {currency === "toman" ? (
                    <div className="mt-1 font-mono text-sm text-subtle">{formatUsd(coin.price)}</div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    <span>
                      ۱ ساعت <Delta value={coin.change1h} />
                    </span>
                    <span>
                      ۲۴ ساعت <Delta value={coin.change24h} />
                    </span>
                    <span>
                      ۷ روز <Delta value={coin.change7d} />
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
                  {RANGES.map((r) => (
                    <Button
                      key={r.days}
                      size="sm"
                      variant={days === r.days ? "default" : "ghost"}
                      className="h-8 px-3"
                      onClick={() => setDays(r.days)}
                    >
                      {r.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <CoinChart points={data?.chart ?? []} up={up} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="ارزش بازار" value={formatMarketCap(coin.marketCap, currency, usdToToman)} />
              <Stat
                label="حجم ۲۴ ساعت"
                value={formatMarketCap(coin.volume24h, currency, usdToToman)}
              />
              <Stat
                label="اوج ۲۴ ساعت"
                value={
                  coin.high24h ? formatPrice(coin.high24h, currency, usdToToman) : "—"
                }
              />
              <Stat
                label="کف ۲۴ ساعت"
                value={coin.low24h ? formatPrice(coin.low24h, currency, usdToToman) : "—"}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="text-xs text-subtle">{label}</div>
      <div className="mt-1 font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}
