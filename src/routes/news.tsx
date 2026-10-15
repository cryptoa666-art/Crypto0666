import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { NewsFeed } from "@/components/news/news-feed";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getNews } from "@/lib/crypto/api";
import { useCoinNews, useNews } from "@/lib/crypto/hooks";
import { faName } from "@/lib/crypto/names";
import { cn } from "@/lib/utils";

const SUGGEST = [
  { q: "BTC", label: "بیت‌کوین" },
  { q: "ETH", label: "اتریوم" },
  { q: "SOL", label: "سولانا" },
  { q: "XRP", label: "ریپل" },
  { q: "TON", label: "تون" },
  { q: "DOGE", label: "دوج" },
  { q: "ADA", label: "کاردانو" },
  { q: "AVAX", label: "آوالانچ" },
];

export const Route = createFileRoute("/news")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q.slice(0, 40) : undefined,
  }),
  loader: () => getNews(),
  component: NewsPage,
});

function NewsPage() {
  const initial = Route.useLoaderData();
  const { q: qParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/news" });
  const query = useNews();
  const feed = query.data ?? initial;
  const { isLoading, isError, refetch } = query;
  const q = (qParam ?? "").trim();
  const [draft, setDraft] = useState(q);
  const coinNews = useCoinNews(q, q.length >= 2);
  const searching = q.length >= 2;
  const items = searching ? (coinNews.data?.items ?? []) : (feed ?? []);

  useEffect(() => {
    setDraft(q);
  }, [q]);

  function applyQuery(next: string) {
    const value = next.trim();
    setDraft(value);
    void navigate({
      search: { q: value || undefined },
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    applyQuery(draft);
  }

  return (
    <AppShell active="news">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">اخبار بنیادی</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            خبرهای قانون‌گذاری، ETF، پذیرش نهادی و ارتقای پروتکل. نام ارز را جستجو کن تا بنیادی یک سال گذشته‌اش را ببینی و به فارسی ترجمه کنی.
          </p>
        </div>

        <form onSubmit={submit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="جستجوی بنیادی یک ارز: بیت‌کوین، ETH، solana"
              className="ps-10"
            />
          </div>
          <Button type="submit" className="h-11 px-4">
            جستجو
          </Button>
        </form>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {SUGGEST.map((s) => (
            <button
              key={s.q}
              type="button"
              onClick={() => applyQuery(s.q)}
              className={cn(
                "h-10 shrink-0 rounded-full px-4 text-sm transition-colors duration-150",
                q.toUpperCase() === s.q
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted shadow-[var(--shadow-border)]",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {searching ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>
              بنیادی ۱۲ ماه گذشته
              {coinNews.data?.symbol ? (
                <>
                  {" "}
                  برای {faName(coinNews.data.symbol, coinNews.data.name)}
                  <span className="ms-1.5 font-mono text-xs uppercase text-subtle">
                    {coinNews.data.symbol}
                  </span>
                </>
              ) : null}
              {coinNews.data?.items?.length ? (
                <span className="ms-1 text-subtle">
                  · {coinNews.data.items.length.toLocaleString("fa-IR")} خبر
                </span>
              ) : null}
            </span>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-full bg-surface px-3 text-xs shadow-[var(--shadow-border)]"
              onClick={() => applyQuery("")}
            >
              <X className="size-3.5" />
              پاک کردن
            </button>
          </div>
        ) : null}

        {(searching ? coinNews.isLoading : isLoading && !feed?.length) ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          </div>
        ) : searching && coinNews.isError ? (
          <div className="rounded-3xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-border)]">
            <p className="text-muted">جستجوی خبر این ارز ناموفق بود.</p>
          </div>
        ) : isError && !feed?.length && !searching ? (
          <div className="rounded-3xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-border)]">
            <p className="text-muted">خبرها در دسترس نیستند.</p>
            <button
              type="button"
              className="mt-3 text-sm text-accent underline-offset-4 hover:underline"
              onClick={() => refetch()}
            >
              تلاش دوباره
            </button>
          </div>
        ) : (
          <NewsFeed items={items} hideTags={searching} />
        )}
      </div>
    </AppShell>
  );
}
