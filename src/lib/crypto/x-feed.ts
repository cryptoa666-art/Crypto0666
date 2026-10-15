import { createServerFn } from "@tanstack/react-start";
import { translateAnyToFa } from "./fa";
import { faName } from "./names";
import type { NewsTag, XPost, XSearchPayload } from "./types";

const MIRRORS = ["https://nitter.kareem.one"];
const MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;

const FA_TO_EN: Record<string, { symbol: string; name: string }> = {
  بیتکوین: { symbol: "BTC", name: "Bitcoin" },
  "بیت‌کوین": { symbol: "BTC", name: "Bitcoin" },
  اتریوم: { symbol: "ETH", name: "Ethereum" },
  سولانا: { symbol: "SOL", name: "Solana" },
  ریپل: { symbol: "XRP", name: "XRP" },
  دوج: { symbol: "DOGE", name: "Dogecoin" },
  "دوج‌کوین": { symbol: "DOGE", name: "Dogecoin" },
  شیبا: { symbol: "SHIB", name: "Shiba Inu" },
  کاردانو: { symbol: "ADA", name: "Cardano" },
  تون: { symbol: "TON", name: "Toncoin" },
  "تون‌کوین": { symbol: "TON", name: "Toncoin" },
  آوالانچ: { symbol: "AVAX", name: "Avalanche" },
  ترون: { symbol: "TRX", name: "TRON" },
  استلار: { symbol: "XLM", name: "Stellar" },
  فایلکوین: { symbol: "FIL", name: "Filecoin" },
  "فایل‌کوین": { symbol: "FIL", name: "Filecoin" },
  پالیگان: { symbol: "POL", name: "Polygon" },
  کازماس: { symbol: "ATOM", name: "Cosmos" },
  اتم: { symbol: "ATOM", name: "Cosmos" },
  ویچین: { symbol: "VET", name: "VeChain" },
  هارمونی: { symbol: "ONE", name: "Harmony" },
  چیلیز: { symbol: "CHZ", name: "Chiliz" },
  زیلیکا: { symbol: "ZIL", name: "Zilliqa" },
  وینک: { symbol: "WIN", name: "WINkLink" },
  بیتتورنت: { symbol: "BTT", name: "BitTorrent" },
  سونیک: { symbol: "S", name: "Sonic" },
  ناتکوین: { symbol: "NOT", name: "Notcoin" },
  هولو: { symbol: "HOT", name: "Holo" },
  کرو: { symbol: "CRV", name: "Curve" },
};

type CacheEntry<T> = { at: number; data: T };
const mem = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = mem.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  const data = await fn();
  mem.set(key, { at: Date.now(), data });
  return data;
}

async function fetchText(url: string, timeoutMs = 9000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function decodeEntities(s: string): string {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  const nbsp = "&" + "nbsp;";
  const apos = "&" + "#39;";
  const aposName = "&" + "apos;";
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replaceAll(nbsp, " ")
    .replaceAll(amp, "&")
    .replaceAll(lt, "<")
    .replaceAll(gt, ">")
    .replaceAll(quot, '"')
    .replaceAll(aposName, "'")
    .replaceAll(apos, "'");
}

function stripHtml(s: string): string {
  return decodeEntities(s)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/t\.co\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function innerTag(block: string, name: string): string {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]).trim() : "";
}

function normFa(s: string): string {
  return s.replace(/\u200c/g, "").replace(/\s+/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک").trim();
}

async function resolveCoin(q: string): Promise<{ symbol: string; name: string }> {
  const raw = q.trim();
  const fa = FA_TO_EN[normFa(raw)];
  if (fa) return fa;
  if (/^[a-z0-9]{2,10}$/i.test(raw)) {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(raw)}`, {
        signal: AbortSignal.timeout(6000),
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const body = (await res.json()) as { coins?: { name: string; symbol: string }[] };
        const hit =
          body.coins?.find((c) => c.symbol.toLowerCase() === raw.toLowerCase()) ?? body.coins?.[0];
        if (hit?.symbol && hit.name) return { symbol: hit.symbol.toUpperCase(), name: hit.name };
      }
    } catch {
      /* keep raw */
    }
    return { symbol: raw.toUpperCase(), name: raw };
  }
  return { symbol: raw.toUpperCase().slice(0, 12), name: raw };
}

function toXUrl(link: string, handle: string): string {
  const m = link.match(/status\/(\d+)/);
  if (m) return `https://x.com/${handle}/status/${m[1]}`;
  return `https://x.com/search?q=${encodeURIComponent(handle)}&src=typed_query&f=live`;
}

function parseSearch(xml: string, symbol: string): XPost[] {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const posts: XPost[] = [];
  for (const block of blocks) {
    const title = stripHtml(innerTag(block, "title"));
    const link = innerTag(block, "link").replace(/\s+/g, "");
    const pub = innerTag(block, "pubDate");
    if (!title || !link || !pub) continue;
    const publishedAt = new Date(pub).toISOString();
    if (Number.isNaN(Date.parse(publishedAt))) continue;
    if (Date.now() - Date.parse(publishedAt) > MAX_AGE_MS) continue;
    const desc = stripHtml(innerTag(block, "description"));
    const text = (desc.length > title.length ? desc : title).slice(0, 480);
    if (text.length < 8) continue;
    const creator = innerTag(block, "dc:creator").replace(/^@/, "");
    const fromLink = link.match(/\/([A-Za-z0-9_]{1,20})\/status\//);
    const handle = (creator || fromLink?.[1] || "x").replace(/[^\w]/g, "").slice(0, 20) || "x";
    const tags: NewsTag[] = [];
    if (/\b(etf|sec|regulation|listing|upgrade|institutional)\b/i.test(text)) tags.push("markets");
    posts.push({
      id: `${handle}-${link}`,
      handle,
      name: handle,
      text,
      textFa: "",
      url: toXUrl(link, handle),
      publishedAt,
      coins: [symbol],
      tags,
      score: 1,
    });
  }
  return posts;
}

const AMBIGUOUS = new Set(["VET", "ONE", "WIN", "HOT", "NOT", "SUN", "S"]);

function mentionsCoin(text: string, coin: { symbol: string; name: string }): boolean {
  const name = coin.name.toLowerCase();
  if (name.length >= 4 && text.toLowerCase().includes(name)) return true;
  const sym = coin.symbol.toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(sym)) return false;
  if (new RegExp(`\\$${sym}\\b`, "i").test(text) || new RegExp(`#${sym}\\b`, "i").test(text)) return true;
  if (AMBIGUOUS.has(sym) || sym.length <= 2) return false;
  return new RegExp(`(^|[^A-Za-z0-9])${sym}([^A-Za-z0-9]|$)`).test(text);
}

export const searchXPosts = createServerFn({ method: "POST" })
  .validator((data: { q: string }) => ({ q: String(data?.q ?? "").trim().slice(0, 40) }))
  .handler(async ({ data }): Promise<XSearchPayload> => {
    if (data.q.length < 2) {
      return { query: data.q, symbol: "", name: "", posts: [], updatedAt: new Date().toISOString() };
    }
    const key = normFa(data.q).toLowerCase();
    return cached(`x-search-v5-${key}`, 3 * 60_000, async () => {
      const coin = await resolveCoin(data.q);
      if (!/^[A-Z0-9]{2,10}$/.test(coin.symbol)) {
        return {
          query: data.q,
          symbol: "",
          name: data.q,
          posts: [],
          updatedAt: new Date().toISOString(),
          error: "این اسم را نشناختم. نماد انگلیسی را بنویس، مثل VET یا ETH.",
        };
      }
      const cashtag = `$${coin.symbol}`;
      const queries = AMBIGUOUS.has(coin.symbol)
        ? [[coin.name, cashtag], [coin.name]]
        : [
            [coin.name, coin.symbol, cashtag],
            [cashtag, coin.symbol],
            [coin.name],
          ];
      let xml = "";
      for (const parts of queries) {
        const q = [...new Set(parts)].filter((p) => p.length >= 2).map((p) => (p.includes(" ") ? `"${p}"` : p)).join(" OR ");
        if (!q) continue;
        for (const base of MIRRORS) {
          try {
            const url = `${base}/search/rss?f=tweets&q=${encodeURIComponent(q)}`;
            const text = await fetchText(url, 10000);
            if (text.includes("<item")) {
              xml = text;
              break;
            }
          } catch {
            /* next mirror */
          }
        }
        if (xml.includes("<item")) break;
        xml = "";
      }
      const parsed = xml ? parseSearch(xml, coin.symbol) : [];
      const seen = new Set<string>();
      const unique = parsed.filter((p) => {
        const id = p.url.replace(/[?#].*$/, "");
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      unique.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      const head = unique.filter((post) => mentionsCoin(post.text, coin)).slice(0, 16);
      const posts = head.map((post) => ({ ...post, textFa: "" }));
      const fa = faName(coin.symbol, coin.name);
      return {
        query: data.q,
        symbol: coin.symbol,
        name: fa && fa !== coin.symbol ? fa : coin.name,
        posts,
        updatedAt: new Date().toISOString(),
        error: posts.length ? undefined : "توییتی برای این ارز پیدا نشد",
      };
    });
  });

export const translateXText = createServerFn({ method: "POST" })
  .validator((data: { text: string }) => ({ text: String(data?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 500) }))
  .handler(async ({ data }): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    if (data.text.length < 2) return { ok: false, error: "متنی برای ترجمه نیست" };
    const text = await translateAnyToFa(data.text);
    if (!text) return { ok: false, error: "ترجمه انجام نشد — دوباره بزن" };
    return { ok: true, text };
  });
