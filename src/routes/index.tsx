import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getMarkets } from "@/lib/crypto/api";
import { Search } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CoinTable } from "@/components/market/coin-table";
import { Movers } from "@/components/market/movers";
import { StatsBar } from "@/components/market/stats-bar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkets } from "@/lib/crypto/hooks";
import { faName } from "@/lib/crypto/names";
import { USE_FILTERS, USE_META, type CoinUse } from "@/lib/crypto/categories";
import { usePortfolio } from "@/lib/portfolio/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: () => getMarkets(),
  component: Home,
});

const RANGES = [
  { n: 100, label: "۱۰۰ برتر" },
  { n: 250, label: "۲۵۰ ارز" },
  { n: 500, label: "۵۰۰ ارز" },
  { n: 1000, label: "۱۰۰۰ ارز" },
] as const;

function Home() {
  const initial = Route.useLoaderData();
  const query = useMarkets();
  const data = query.data ?? initial;
  const { isLoading, isError, refetch, isRefetching } = query;
  const currency = usePortfolio((s) => s.currency);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"rank" | "chg" | "mcap">("rank");
  const [range, setRange] = useState<(typeof RANGES)[number]["n"]>(250);
  const [use, setUse] = useState<CoinUse | "all">("all");

  const coins = useMemo(() => {
    if (!data?.coins) return [];
    const query = q.trim().toLowerCase();
    let list = data.coins.slice(0, range);
    if (use !== "all") list = list.filter((c) => c.category === use);
    if (query) {
      list = list.filter((c) => {
        const fa = faName(c.symbol, "");
        return (
          c.symbol.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query) ||
          fa.includes(q.trim())
        );
      });
    }
    if (sort === "chg") {
      return [...list].sort((a, b) => (b.change24h ?? -999) - (a.change24h ?? -999));
    }
    if (sort === "mcap") {
      return [...list].sort((a, b) => b.marketCap - a.marketCap);
    }
    return list;
  }, [data?.coins, q, sort, range, use]);

  const useMeta = use !== "all" ? USE_META[use] : null;

  return (
    <AppShell active="market">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            بازار زنده
            <span className="ms-3 inline-flex items-center gap-1.5 align-middle text-xs font-medium text-gain">
              <span className="size-1.5 rounded-full bg-gain" />
              آنلاین
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            قیمت لحظه‌ای تا ۱۰۰۰ ارز، با دسته‌بندی کاربرد و به‌روزرسانی خودکار
            {data?.updatedAt ? (
              <>
                <span className="mx-1.5 text-subtle">·</span>
                <span className="text-xs text-subtle">
                  {new Date(data.updatedAt).toLocaleTimeString("fa-IR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {isRefetching ? " · در حال تازه‌سازی" : ""}
                </span>
              </>
            ) : null}
          </p>
        </div>

        {isLoading && !data ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : (
          <StatsBar
            global={data?.global ?? null}
            fearGreed={data?.fearGreed ?? null}
            currency={currency}
            usdToToman={data?.usdToToman ?? null}
          />
        )}

        {isLoading && !data ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-44 rounded-3xl" />
          </div>
        ) : (
          <Movers
            coins={data?.coins ?? []}
            currency={currency}
            usdToToman={data?.usdToToman ?? null}
          />
        )}

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی ارز، نماد یا نام فارسی"
              className="ps-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 overflow-x-auto rounded-lg bg-surface p-1 shadow-[var(--shadow-border)]">
              {RANGES.map((opt) => (
                <button
                  key={opt.n}
                  type="button"
                  onClick={() => setRange(opt.n)}
                  className={cn(
                    "h-10 shrink-0 rounded-md px-3 text-xs transition-colors duration-150",
                    range === opt.n ? "bg-surface-3 text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1 overflow-x-auto rounded-lg bg-surface p-1 shadow-[var(--shadow-border)]">
              {(
                [
                  { id: "rank", label: "رتبه" },
                  { id: "chg", label: "رشد ۲۴س" },
                  { id: "mcap", label: "ارزش بازار" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSort(opt.id)}
                  className={cn(
                    "h-10 shrink-0 rounded-md px-3 text-xs transition-colors duration-150",
                    sort === opt.id ? "bg-surface-3 text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {USE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setUse(f.id)}
                className={cn(
                  "h-10 shrink-0 rounded-full px-4 text-sm transition-colors duration-150",
                  use === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-muted shadow-[var(--shadow-border)]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {useMeta ? <p className="text-xs text-subtle">{useMeta.blurb}</p> : null}
        </div>

        {isLoading && !data ? (
          <div className="space-y-2 rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError && !data ? (
          <div className="rounded-3xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-border)]">
            <p className="text-muted">دریافت قیمت‌ها ناموفق بود.</p>
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
            <CoinTable
              coins={coins}
              currency={currency}
              usdToToman={data?.usdToToman ?? null}
            />
            {data?.coins?.length ? (
              <p className="text-center text-xs text-subtle">
                نمایش {coins.length.toLocaleString("fa-IR")} ارز
                {use === "all" && !q.trim()
                  ? ` از ${Math.min(range, data.coins.length).toLocaleString("fa-IR")} مورد انتخاب‌شده · کل لیست ${data.coins.length.toLocaleString("fa-IR")}`
                  : ` · فیلترشده از ${data.coins.length.toLocaleString("fa-IR")}`}
              </p>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}