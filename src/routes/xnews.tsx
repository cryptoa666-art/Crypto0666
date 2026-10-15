import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { XFeed } from "@/components/news/x-feed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useXSearch } from "@/lib/crypto/hooks";
import { cn } from "@/lib/utils";

const SUGGEST = [
  { q: "BTC", label: "بیت‌کوین" },
  { q: "ETH", label: "اتریوم" },
  { q: "SOL", label: "سولانا" },
  { q: "XRP", label: "ریپل" },
  { q: "DOGE", label: "دوج" },
  { q: "ADA", label: "کاردانو" },
  { q: "SHIB", label: "شیبا" },
  { q: "TON", label: "تون" },
  { q: "XLM", label: "استلار" },
  { q: "VET", label: "وی‌چین" },
  { q: "POL", label: "پالیگان" },
  { q: "ATOM", label: "کازماس" },
];

export const Route = createFileRoute("/xnews")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q.slice(0, 40) : undefined,
  }),
  component: XNewsPage,
});

function XNewsPage() {
  const { q: qParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/xnews" });
  const q = (qParam ?? "").trim();
  const [draft, setDraft] = useState(q);
  const query = useXSearch(q, q.length >= 2);

  useEffect(() => {
    setDraft(q);
  }, [q]);

  function applyQuery(next: string) {
    const value = next.trim();
    setDraft(value);
    void navigate({ search: { q: value || undefined } });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    applyQuery(draft);
  }

  const searching = q.length >= 2;
  const posts = query.data?.posts ?? [];

  return (
    <AppShell active="xnews">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">توییتر</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            اسم یا نماد ارز را بنویس. متن اصلی پست نشان داده می‌شود؛ اگر خواستی، کنار همان پست «ترجمه به فارسی» را بزن.
          </p>
        </div>

        <form onSubmit={submit} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="بیت‌کوین، ETH، سولانا…"
              className="ps-10"
            />
          </div>
          <Button type="submit" className="h-11 shrink-0 px-4">
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

        {!searching ? (
          <div className="rounded-3xl bg-surface px-6 py-16 text-center text-muted shadow-[var(--shadow-border)]">
            یک ارز را جستجو کن.
          </div>
        ) : query.isLoading && !posts.length ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          </div>
        ) : query.data?.error && !posts.length ? (
          <div className="rounded-3xl bg-surface px-6 py-16 text-center text-muted shadow-[var(--shadow-border)]">
            {query.data.error}
          </div>
        ) : query.isError && !posts.length ? (
          <div className="rounded-3xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-border)]">
            <p className="text-muted">توییتر الان در دسترس نیست.</p>
            <button
              type="button"
              className="mt-3 text-sm text-accent underline-offset-4 hover:underline"
              onClick={() => query.refetch()}
            >
              تلاش دوباره
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {query.data?.symbol ? (
              <p className="text-sm text-muted">
                پست‌های {query.data.name}
                <span className="ms-1.5 font-mono text-xs uppercase text-subtle">{query.data.symbol}</span>
                {posts.length ? (
                  <span className="ms-1 text-subtle">· {posts.length.toLocaleString("fa-IR")} پست</span>
                ) : null}
              </p>
            ) : null}
            <XFeed posts={posts} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
