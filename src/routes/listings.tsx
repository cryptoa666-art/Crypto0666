import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { CoinLogo } from "@/components/market/coin-logo";
import { Delta } from "@/components/market/delta";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useListings } from "@/lib/crypto/hooks";
import { formatUsd } from "@/lib/crypto/format";
import type { ListingItem } from "@/lib/crypto/types";

export const Route = createFileRoute("/listings")({
  component: ListingsPage,
});

function ListingsPage() {
  const query = useListings();
  const data = query.data;
  const { isLoading, isError, refetch } = query;

  return (
    <AppShell active="listings">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">لیستینگ جدید</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            ارزهایی که تازه ساخته شده‌اند یا قرار است روی صرافی‌های بزرگ مثل بایننس، او‌کی‌ایکس و کوین‌بیس لیست شوند. توکن‌های DEX پرریسک‌اند.
          </p>
        </div>

        {isLoading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-3xl" />
            ))}
          </div>
        ) : isError && !data ? (
          <div className="rounded-3xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-border)]">
            <p className="text-muted">لیستینگ در دسترس نیست.</p>
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
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted">به‌زودی / تازه روی صرافی</h2>
              {data?.cexNews.length ? (
                <ul className="space-y-2">
                  {data.cexNews.map((item) => (
                    <NewsRow key={item.id} item={item} />
                  ))}
                </ul>
              ) : (
                <p className="rounded-3xl bg-surface px-5 py-10 text-center text-sm text-muted shadow-[var(--shadow-border)]">
                  خبر تازه‌ای از لیستینگ صرافی پیدا نشد.
                </p>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted">تازه روی DEX — هنوز روی صرافی بزرگ نیست</h2>
              {data?.dex.length ? (
                <ul className="overflow-hidden rounded-3xl bg-surface shadow-[var(--shadow-border)]">
                  {data.dex.map((item) => (
                    <DexRow key={item.id} item={item} />
                  ))}
                </ul>
              ) : (
                <p className="rounded-3xl bg-surface px-5 py-10 text-center text-sm text-muted shadow-[var(--shadow-border)]">
                  الان توکن تازه‌ای از DEX نرسید.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function NewsRow({ item }: { item: ListingItem }) {
  return (
    <li className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap gap-1.5">
        {item.exchanges.map((ex) => (
          <Badge key={ex} variant="outline">
            {ex}
          </Badge>
        ))}
        {item.symbol !== "—" ? (
          <Link
            to="/coin/$id"
            params={{ id: item.symbol.toLowerCase() }}
            className="inline-flex h-6 items-center rounded-full bg-surface-2 px-2 font-mono text-[11px] text-muted"
          >
            {item.symbol}
          </Link>
        ) : null}
      </div>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block text-sm font-medium leading-snug hover:text-accent"
        dir="auto"
      >
        {item.headline}
      </a>
    </li>
  );
}

function DexRow({ item }: { item: ListingItem }) {
  return (
    <li className="border-t border-border first:border-t-0">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2"
      >
        {item.icon ? (
          <img
            src={item.icon}
            alt=""
            width={32}
            height={32}
            className="coin-logo size-8 shrink-0 rounded-full bg-surface-3 object-cover"
          />
        ) : (
          <CoinLogo symbol={item.symbol} size={32} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.name}</span>
          <span className="block font-mono text-[11px] uppercase text-subtle">
            {item.symbol}
            {item.chain ? ` · ${item.chain}` : ""}
            {item.liquidityUsd ? ` · نقدینگی ${formatUsd(item.liquidityUsd)}` : ""}
          </span>
        </span>
        <span className="text-end">
          <span className="block font-mono text-sm tabular-nums">
            {item.priceUsd != null ? formatUsd(item.priceUsd) : "—"}
          </span>
          <Delta value={item.change24h} className="text-xs" />
        </span>
      </a>
    </li>
  );
}
