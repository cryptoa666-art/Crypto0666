import { Link } from "@tanstack/react-router";
import type { MarketCoin } from "@/lib/crypto/types";
import { faName } from "@/lib/crypto/names";
import { formatPrice, type QuoteCurrency } from "@/lib/crypto/format";
import { CoinLogo } from "./coin-logo";
import { Delta } from "./delta";

const STABLES = new Set([
  "USDT",
  "USDC",
  "USDE",
  "DAI",
  "FDUSD",
  "TUSD",
  "USDD",
  "PYUSD",
  "USDG",
  "BFUSD",
  "RLUSD",
  "GHO",
  "USD1",
  "USDP",
]);

function isStable(c: MarketCoin) {
  const sym = c.symbol.toUpperCase();
  if (STABLES.has(sym)) return true;
  const hay = `${c.name} ${c.symbol}`.toLowerCase();
  if (/(usde|usdt|usdc|tether|trueusd|pyusd|fdusd|paypal usd|ethena usde|usd coin)/i.test(hay)) {
    return true;
  }
  if (Math.abs(c.price - 1) < 0.04 && /usd|dollar|tether|stable/.test(hay)) return true;
  return false;
}

function eligible(c: MarketCoin) {
  if (c.change24h === null || c.change24h === undefined) return false;
  if (c.rank < 1 || c.rank > 50) return false;
  if (c.marketCap < 5e8) return false;
  if (Math.abs(c.change24h) > 40) return false;
  if (c.change7d !== null && Math.abs(c.change7d) > 80) return false;
  if (isStable(c)) return false;
  return true;
}

export function Movers({
  coins,
  currency,
  usdToToman,
}: {
  coins: MarketCoin[];
  currency: QuoteCurrency;
  usdToToman: number | null;
}) {
  const ranked = coins.filter(eligible);
  const gainers = [...ranked]
    .sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0))
    .filter((c) => (c.change24h ?? 0) > 0)
    .slice(0, 5);
  const losers = [...ranked]
    .sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0))
    .filter((c) => (c.change24h ?? 0) < 0)
    .slice(0, 5);

  if (!gainers.length && !losers.length) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MoverCol
        title="بیشترین رشد ۲۴ساعت"
        coins={gainers}
        currency={currency}
        usdToToman={usdToToman}
      />
      <MoverCol
        title="بیشترین ریزش ۲۴ساعت"
        coins={losers}
        currency={currency}
        usdToToman={usdToToman}
      />
    </div>
  );
}

function MoverCol({
  title,
  coins,
  currency,
  usdToToman,
}: {
  title: string;
  coins: MarketCoin[];
  currency: QuoteCurrency;
  usdToToman: number | null;
}) {
  return (
    <div className="rounded-3xl bg-surface p-3 shadow-[var(--shadow-border)]">
      <div className="px-2 pb-2 text-xs font-medium text-muted">{title}</div>
      <ul className="space-y-0.5">
        {coins.map((coin) => (
          <li key={coin.id}>
            <Link
              to="/coin/$id"
              params={{ id: coin.id }}
              className="flex min-h-11 items-center gap-2 rounded-xl px-2 py-1.5 transition-colors duration-150 hover:bg-surface-2"
            >
              <CoinLogo symbol={coin.symbol} size={24} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {faName(coin.symbol, coin.name)}
              </span>
              <span className="font-mono text-xs tabular-nums text-muted">
                {formatPrice(coin.price, currency, usdToToman)}
              </span>
              <Delta value={coin.change24h} className="text-xs" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
