import { Link } from "@tanstack/react-router";
import type { MarketCoin } from "@/lib/crypto/types";
import { faName } from "@/lib/crypto/names";
import { formatMarketCap, formatPrice, type QuoteCurrency } from "@/lib/crypto/format";
import { USE_META } from "@/lib/crypto/categories";
import { CoinLogo } from "./coin-logo";
import { Delta } from "./delta";

export function CoinTable({
  coins,
  currency,
  usdToToman,
}: {
  coins: MarketCoin[];
  currency: QuoteCurrency;
  usdToToman: number | null;
}) {
  if (coins.length === 0) {
    return (
      <div className="rounded-3xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-border)]">
        <p className="text-muted">ارزی با این جستجو پیدا نشد.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-border)]">
      <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_9rem_6rem_6rem_7rem] gap-3 px-4 py-3 text-xs text-subtle md:grid">
        <span>#</span>
        <span>ارز</span>
        <span className="text-end">قیمت</span>
        <span className="text-end">۲۴ ساعت</span>
        <span className="text-end">۷ روز</span>
        <span className="text-end">ارزش بازار</span>
      </div>
      <ul>
        {coins.map((coin) => {
          const fa = faName(coin.symbol, coin.name);
          const use = USE_META[coin.category];
          return (
            <li key={coin.id} className="border-t border-border first:border-t-0">
              <Link
                to="/coin/$id"
                params={{ id: coin.id }}
                className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-2 md:grid-cols-[2.5rem_minmax(0,1fr)_9rem_6rem_6rem_7rem]"
              >
                <span className="hidden font-mono text-xs tabular-nums text-subtle md:block">
                  {coin.rank}
                </span>
                <span className="flex min-w-0 items-center gap-3">
                  <CoinLogo symbol={coin.symbol} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium" dir="auto">
                      {fa}
                    </span>
                    <span className="block font-mono text-xs uppercase tracking-wide text-subtle">
                      {coin.symbol}
                      <span className="ms-2 font-sans normal-case">{use.label}</span>
                    </span>
                  </span>
                </span>
                <span className="text-end font-mono text-sm tabular-nums">
                  {formatPrice(coin.price, currency, usdToToman)}
                  <span className="mt-0.5 block md:hidden">
                    <Delta value={coin.change24h} className="text-xs" />
                  </span>
                </span>
                <span className="hidden text-end md:block">
                  <Delta value={coin.change24h} />
                </span>
                <span className="hidden text-end md:block">
                  <Delta value={coin.change7d} />
                </span>
                <span className="hidden text-end font-mono text-sm tabular-nums text-muted md:block">
                  {formatMarketCap(coin.marketCap, currency, usdToToman)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}