import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";
import { Languages, Loader2 } from "lucide-react";
import type { NewsItem, NewsTag } from "@/lib/crypto/types";
import { faName } from "@/lib/crypto/names";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { translateNews } from "@/lib/crypto/api";
import { toast } from "sonner";

const TAGS: { id: "all" | "strong" | NewsTag; label: string }[] = [
  { id: "strong", label: "بنیادی قوی" },
  { id: "all", label: "همه" },
  { id: "regulation", label: "قانون‌گذاری" },
  { id: "etf", label: "ETF و بازار سرمایه" },
  { id: "adoption", label: "پذیرش نهادی" },
  { id: "protocol", label: "پروتکل" },
  { id: "listing", label: "لیستینگ" },
];

const TAG_LABEL: Record<NewsTag, string> = {
  regulation: "قانون‌گذاری",
  etf: "ETF",
  adoption: "پذیرش",
  protocol: "پروتکل",
  markets: "بازار",
  listing: "لیستینگ",
};

const STRONG = new Set<NewsTag>(["regulation", "etf", "adoption", "protocol"]);

function hasPersian(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s);
}

async function clientFa(text: string): Promise<string> {
  const q = text.replace(/\s+/g, " ").trim().slice(0, 450);
  if (!q) return "";
  try {
    const res = await fetch(
      `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=fa&dt=t&q=${encodeURIComponent(q)}`,
    );
    if (!res.ok) return "";
    const json = (await res.json()) as unknown;
    const row = Array.isArray(json) ? json[0] : json;
    const out = Array.isArray(row)
      ? typeof row[0] === "string"
        ? String(row[0])
        : row.map((part) => (Array.isArray(part) ? String(part[0] ?? "") : "")).join("")
      : typeof json === "string"
        ? json
        : Array.isArray(json)
          ? json.filter((part) => typeof part === "string").join("")
          : "";
    return hasPersian(out) ? out.trim() : "";
  } catch {
    return "";
  }
}

type FaMap = Record<string, { title: string; excerpt: string }>;

const FA_STORE = "crypto666-news-fa-v1";

function loadFaStore(): FaMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FA_STORE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FaMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveFaStore(map: FaMap) {
  if (typeof window === "undefined") return;
  try {
    const entries = Object.entries(map).slice(-80);
    window.localStorage.setItem(FA_STORE, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* quota */
  }
}

function newsWhen(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const age = Date.now() - t;
  if (age > 14 * 24 * 60 * 60 * 1000) {
    return new Date(t).toLocaleDateString("fa-IR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  return formatDistanceToNow(new Date(t), { addSuffix: true, locale: faIR });
}

export function NewsFeed({
  items,
  hideTags = false,
}: {
  items: NewsItem[];
  hideTags?: boolean;
}) {
  const strongCount = items.filter((n) => n.tags.some((t) => STRONG.has(t))).length;
  const [tag, setTag] = useState<(typeof TAGS)[number]["id"]>(
    hideTags ? "all" : strongCount > 0 ? "strong" : "all",
  );
  const [fa, setFa] = useState<FaMap>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setFa(loadFaStore());
  }, []);

  const filtered = useMemo(() => {
    if (hideTags || tag === "all") return items;
    if (tag === "strong") return items.filter((n) => n.tags.some((t) => STRONG.has(t)));
    return items.filter((n) => n.tags.includes(tag));
  }, [items, tag, hideTags]);

  async function translateItems(pending: NewsItem[], key: string) {
    const missing = pending.filter((n) => !fa[n.id] && !hasPersian(n.title)).slice(0, 12);
    if (!missing.length) {
      toast.message("این خبرها از قبل ترجمه‌اند");
      return;
    }
    setBusy(key);
    let translated = 0;
    let lastError = "";
    const done = new Set<string>();
    try {
      try {
        const res = await translateNews({
          data: {
            items: missing.slice(0, 8).map((n) => ({ id: n.id, title: n.title, excerpt: n.excerpt })),
          },
        });
        if (!res.ok) {
          lastError = res.error;
        } else {
          const extra: FaMap = {};
          for (const it of res.items) {
            if (it.title && hasPersian(it.title)) {
              extra[it.id] = { title: it.title, excerpt: it.excerpt };
              done.add(it.id);
            }
          }
          const n = Object.keys(extra).length;
          if (n) {
            translated += n;
            setFa((prev) => {
              const next = { ...prev, ...extra };
              saveFaStore(next);
              return next;
            });
          }
        }
      } catch {
        lastError = "ترجمه ابری انجام نشد";
      }

      const leftovers = missing.filter((n) => !done.has(n.id));
      if (leftovers.length) {
        const got: FaMap = {};
        await Promise.all(
          leftovers.slice(0, 6).map(async (n) => {
            const title = await clientFa(n.title);
            if (!title) return;
            const excerpt = n.excerpt ? await clientFa(n.excerpt) : "";
            got[n.id] = { title, excerpt };
          }),
        );
        const n = Object.keys(got).length;
        if (n) {
          translated += n;
          setFa((prev) => {
            const next = { ...prev, ...got };
            saveFaStore(next);
            return next;
          });
        }
      }

      if (translated) toast.success(`${translated.toLocaleString("fa-IR")} خبر ترجمه شد`);
      else toast.error(lastError || "ترجمه انجام نشد — دوباره بزن");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!hideTags ? (
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            {TAGS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTag(t.id)}
                className={cn(
                  "h-10 shrink-0 rounded-full px-4 text-sm transition-colors duration-150",
                  tag === t.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-muted shadow-[var(--shadow-border)]",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-10 shrink-0"
          disabled={busy !== null || filtered.length === 0}
          onClick={() => void translateItems(filtered, "batch")}
        >
          {busy === "batch" ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}
          {busy === "batch" ? "در حال ترجمه…" : "ترجمه به فارسی"}
        </Button>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-surface px-6 py-16 text-center text-muted shadow-[var(--shadow-border)]">
          خبری در این دسته نیست.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => {
            const tr = fa[item.id];
            const persianish = /[\u0600-\u06FF]/.test(item.title);
            return (
              <li key={item.id}>
                <article className="rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-subtle">
                    <span>{item.source}</span>
                    <span>·</span>
                    <span>{newsWhen(item.publishedAt)}</span>
                    {item.score >= 4 ? <Badge variant="gain">بنیادی قوی</Badge> : null}
                    {item.tags
                      .filter((t) => t !== "markets")
                      .slice(0, 2)
                      .map((t) => (
                        <Badge key={t} variant="outline">
                          {TAG_LABEL[t]}
                        </Badge>
                      ))}
                    {tr || persianish ? <Badge>فارسی</Badge> : null}
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block"
                  >
                    <h2 dir="auto" className="text-base font-medium leading-snug">
                      {tr?.title || item.title}
                    </h2>
                    {(tr?.excerpt || item.excerpt) ? (
                      <p dir="auto" className="mt-1 line-clamp-2 text-sm text-muted">
                        {tr?.excerpt || item.excerpt}
                      </p>
                    ) : null}
                  </a>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {item.coins?.length
                      ? item.coins.map((sym) => (
                          <Link
                            key={sym}
                            to="/coin/$id"
                            params={{ id: sym.toLowerCase() }}
                            className="inline-flex h-7 items-center rounded-full bg-surface-2 px-2.5 font-mono text-[11px] text-muted shadow-[var(--shadow-border)] hover:text-fg"
                          >
                            {faName(sym, sym)}
                            <span className="ms-1.5 uppercase text-subtle">{sym}</span>
                          </Link>
                        ))
                      : null}
                    {!tr && !persianish ? (
                      <button
                        type="button"
                        className="ms-auto inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] text-muted hover:text-fg"
                        disabled={busy !== null}
                        onClick={() => void translateItems([item], item.id)}
                      >
                        {busy === item.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Languages className="size-3.5" />
                        )}
                        فارسی
                      </button>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
