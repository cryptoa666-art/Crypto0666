import { createServerFn } from "@tanstack/react-start";
import { mapPool, translateToFa } from "./fa";
import { faName } from "./names";
import { categoryOf } from "./categories";
import type {
  ChartPoint,
  CoinDetail,
  CoinHit,
  FearGreed,
  GlobalStats,
  ListingItem,
  ListingsPayload,
  MarketCoin,
  MarketsPayload,
  NewsItem,
  NewsTag,
} from "./types";

type CacheEntry<T> = { at: number; data: T };
const mem = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = mem.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  const data = await fn();
  mem.set(key, { at: Date.now(), data });
  return data;
}

async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Crypto666/1.0 (crypto dashboard)",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "Mozilla/5.0 (compatible; Crypto666/1.0)",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

type LoreTicker = {
  id: string;
  symbol: string;
  name: string;
  nameid: string;
  rank: number;
  price_usd: string;
  percent_change_24h: string;
  percent_change_1h: string;
  percent_change_7d: string;
  market_cap_usd: string;
  volume24: number;
};

type LoreGlobal = {
  total_mcap: number;
  total_volume: number;
  btc_d: string;
  coins_count: number;
  mcap_change: string;
};

type OkxTickers = {
  code: string;
  data: {
    instId: string;
    last: string;
    open24h: string;
    high24h: string;
    low24h: string;
    volCcy24h: string;
  }[];
};

type OkxCandles = { code: string; data: string[][] };
type FngPayload = { data: { value: string; value_classification: string }[] };
type FxPayload = { result: string; rates?: Record<string, number> };

function coinImage(symbol: string): string {
  return `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;
}

function num(v: string | number | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function loreToCoin(t: LoreTicker): MarketCoin {
  const symbol = (t.symbol || "").toUpperCase();
  return {
    id: t.nameid || symbol.toLowerCase(),
    symbol,
    name: t.name,
    image: coinImage(symbol),
    rank: Number(t.rank) || 0,
    price: num(t.price_usd),
    change1h: num(t.percent_change_1h),
    change24h: num(t.percent_change_24h),
    change7d: num(t.percent_change_7d),
    change30d: null,
    marketCap: num(t.market_cap_usd),
    volume24h: num(t.volume24),
    ath: null,
    athDate: null,
    sparkline: [],
    high24h: null,
    low24h: null,
    category: categoryOf(symbol, t.name, num(t.price_usd)),
  };
}

type LiveQuote = { last: number; open: number; high: number; low: number; vol: number };

async function okxSpotMap(): Promise<Map<string, LiveQuote>> {
  const json = await fetchJson<OkxTickers>(
    "https://www.okx.com/api/v5/market/tickers?instType=SPOT",
    8000,
  );
  const map = new Map<string, LiveQuote>();
  if (json.code !== "0" || !json.data) return map;
  for (const row of json.data) {
    const id = row.instId || "";
    if (!id.endsWith("-USDT")) continue;
    const base = id.slice(0, -5).toUpperCase();
    if (!base || base.includes("-")) continue;
    const last = num(row.last);
    const open = num(row.open24h);
    if (last <= 0) continue;
    map.set(base, {
      last,
      open,
      high: num(row.high24h),
      low: num(row.low24h),
      vol: num(row.volCcy24h),
    });
  }
  return map;
}

async function loreTickers(): Promise<MarketCoin[]> {
  const pages = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  const settled = await Promise.allSettled(
    pages.map((start) =>
      fetchJson<{ data: LoreTicker[] }>(
        `https://api.coinlore.net/api/tickers/?start=${start}&limit=100`,
        10000,
      ),
    ),
  );
  const coins: MarketCoin[] = [];
  const seen = new Set<string>();
  for (const res of settled) {
    if (res.status !== "fulfilled") continue;
    for (const row of res.value.data ?? []) {
      const coin = loreToCoin(row);
      const key = coin.symbol || coin.id;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      coins.push(coin);
    }
  }
  coins.sort((a, b) => a.rank - b.rank);
  return coins;
}

function overlayLive(coins: MarketCoin[], live: Map<string, LiveQuote>): MarketCoin[] {
  return coins.map((c) => {
    const q = live.get(c.symbol.toUpperCase());
    if (!q) return c;
    const change24h = q.open > 0 ? ((q.last - q.open) / q.open) * 100 : c.change24h;
    return { ...c, price: q.last, change24h, high24h: q.high || null, low24h: q.low || null };
  });
}

async function loadCoins(): Promise<MarketCoin[]> {
  const [loreResult, liveResult] = await Promise.allSettled([loreTickers(), okxSpotMap()]);
  const live = liveResult.status === "fulfilled" ? liveResult.value : new Map<string, LiveQuote>();
  if (loreResult.status === "fulfilled" && loreResult.value.length) {
    return overlayLive(loreResult.value, live);
  }
  const fallback: MarketCoin[] = [];
  let rank = 1;
  for (const [symbol, q] of live) {
    fallback.push({
      id: symbol.toLowerCase(),
      symbol,
      name: symbol,
      image: coinImage(symbol),
      rank: rank++,
      price: q.last,
      change1h: null,
      change24h: q.open > 0 ? ((q.last - q.open) / q.open) * 100 : null,
      change7d: null,
      change30d: null,
      marketCap: 0,
      volume24h: q.vol,
      ath: null,
      athDate: null,
      sparkline: [],
      high24h: q.high,
      low24h: q.low,
      category: categoryOf(symbol, symbol, q.last),
    });
    if (fallback.length >= 80) break;
  }
  if (!fallback.length) throw new Error("قیمت‌ها در دسترس نیستند");
  return fallback;
}

async function loadGlobal(): Promise<GlobalStats | null> {
  try {
    const g = (await fetchJson<LoreGlobal[]>("https://api.coinlore.net/api/global/", 8000))[0];
    return {
      marketCap: g.total_mcap,
      volume24h: g.total_volume,
      btcDominance: Number(g.btc_d),
      marketCapChange24h: Number(g.mcap_change),
      coins: g.coins_count,
    };
  } catch {
    return null;
  }
}

const FNG_FA: Record<string, string> = {
  "Extreme Fear": "ترس شدید",
  Fear: "ترس",
  Neutral: "خنثی",
  Greed: "طمع",
  "Extreme Greed": "طمع شدید",
};

async function loadFng(): Promise<FearGreed | null> {
  try {
    const j = await fetchJson<FngPayload>("https://api.alternative.me/fng/?limit=1", 6000);
    const row = j.data?.[0];
    if (!row) return null;
    return { value: Number(row.value), label: FNG_FA[row.value_classification] ?? row.value_classification };
  } catch {
    return null;
  }
}

async function loadToman(): Promise<number | null> {
  try {
    const j = await fetchJson<FxPayload>("https://open.er-api.com/v6/latest/USD", 6000);
    const irr = j.rates?.IRR;
    if (!irr || !Number.isFinite(irr) || irr <= 0) return null;
    return irr / 10;
  } catch {
    return null;
  }
}

async function marketsPayload(): Promise<MarketsPayload> {
  const [coins, global, fearGreed, usdToToman] = await Promise.all([
    loadCoins(),
    loadGlobal(),
    loadFng(),
    loadToman(),
  ]);
  return { coins, global, fearGreed, usdToToman, updatedAt: new Date().toISOString() };
}

function cachedMarkets(): Promise<MarketsPayload> {
  return cached("markets-v10", 45_000, marketsPayload);
}

export const getMarkets = createServerFn({ method: "GET" }).handler(async (): Promise<MarketsPayload> => {
  return cachedMarkets();
});

function bnInterval(days: number): { interval: string; limit: number } {
  if (days <= 1) return { interval: "15m", limit: 96 };
  if (days <= 7) return { interval: "1h", limit: 168 };
  if (days <= 30) return { interval: "4h", limit: 180 };
  return { interval: "1d", limit: 90 };
}

function okxBar(days: number): { bar: string; limit: number } {
  if (days <= 1) return { bar: "15m", limit: 96 };
  if (days <= 7) return { bar: "1H", limit: 168 };
  if (days <= 30) return { bar: "4H", limit: 180 };
  return { bar: "1D", limit: 90 };
}

async function loadChart(symbol: string, days: number): Promise<ChartPoint[]> {
  const { interval, limit } = bnInterval(days);
  try {
    const rows = await fetchJson<unknown[][]>(
      `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(symbol.toUpperCase())}USDT&interval=${interval}&limit=${limit}`,
      8000,
    );
    if (Array.isArray(rows) && rows.length) {
      const pts = rows
        .map((r) => ({ t: Number(r[0]), price: Number(r[4]) }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.price));
      if (pts.length >= 2) return pts;
    }
  } catch {
    /* fall through */
  }
  const { bar, limit: okxLimit } = okxBar(days);
  try {
    const json = await fetchJson<OkxCandles>(
      `https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(symbol.toUpperCase())}-USDT&bar=${bar}&limit=${okxLimit}`,
      8000,
    );
    if (json.code === "0" && json.data?.length) {
      return [...json.data]
        .reverse()
        .map((r) => ({ t: Number(r[0]), price: Number(r[4]) }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.price));
    }
  } catch {
    /* empty */
  }
  return [];
}

function findCoin(markets: MarketsPayload, id: string): MarketCoin | undefined {
  const key = id.trim().toLowerCase();
  return (
    markets.coins.find((c) => c.id === key) ||
    markets.coins.find((c) => c.symbol.toLowerCase() === key) ||
    markets.coins.find((c) => `${c.symbol.toLowerCase()}-${c.id}` === key)
  );
}

export const getCoinDetail = createServerFn({ method: "POST" })
  .validator((data: { id: string; days?: number }) => {
    const id = String(data?.id ?? "").slice(0, 80);
    const days = [1, 7, 30, 90].includes(Number(data?.days)) ? Number(data.days) : 7;
    if (!id) throw new Error("شناسه نامعتبر است");
    return { id, days };
  })
  .handler(async ({ data }): Promise<CoinDetail> => {
    return cached(`coin-v2-${data.id}-${data.days}`, 30_000, async () => {
      const markets = await cachedMarkets();
      const found = findCoin(markets, data.id);
      if (!found) throw new Error("ارز پیدا نشد");
      const chart = await loadChart(found.symbol, data.days);
      return { coin: found, description: "", chart, days: data.days };
    });
  });

export const searchCoins = createServerFn({ method: "POST" })
  .validator((data: { q: string }) => ({ q: String(data?.q ?? "").trim().slice(0, 40) }))
  .handler(async ({ data }): Promise<CoinHit[]> => {
    if (data.q.length < 1) return [];
    return cached(`search-${data.q.toLowerCase()}`, 60_000, async () => {
      const markets = await cachedMarkets();
      const q = data.q.toLowerCase();
      const faQuery = data.q.trim();
      return markets.coins
        .filter((c) => {
          const fa = faName(c.symbol, "");
          return (
            c.symbol.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            c.id.includes(q) ||
            (fa && fa.includes(faQuery))
          );
        })
        .slice(0, 10)
        .map((c) => ({ id: c.id, name: c.name, symbol: c.symbol, rank: c.rank }));
    });
  });

const FUND_TAGS = new Set<NewsTag>(["etf", "regulation", "adoption", "protocol"]);

const FUNDAMENTAL: { re: RegExp; tag: NewsTag }[] = [
  { re: /\b(etf|exchange[- ]traded|spot bitcoin|spot ether|ishares|grayscale|ibt[c]?|fb[t]c|zcsh)\b/i, tag: "etf" },
  {
    re: /\b(sec|cftc|occ|mica|regulation|regulatory|senate|congress|clarity act|genius act|license|lawsuit|approval|bill|lawmakers?|policy|compliance|ban|banned|legal tender|ruling|white house|charter)\b/i,
    tag: "regulation",
  },
  {
    re: /\b(institutional|treasury|reserve|blackrock|fidelity|adoption|custody|sovereign|nation state|central bank|cbdc|pension|microstrategy|strategy inc|corporate treasury|asset managers?)\b/i,
    tag: "adoption",
  },
  {
    re: /\b(upgrade|mainnet|protocol|hard fork|soft fork|layer-?2|rollup|staking|validator|halving|hashrate|testnet|eip[- ]?\d*|pectra|fusaka|dencun|nu7)\b/i,
    tag: "protocol",
  },
  { re: /\b(fed|federal reserve|interest rate|inflation|liquidity|outflow|inflow|fomc|rate hike)\b/i, tag: "markets" },
  { re: /صندوق\s*(قابل\s*معامله|بیت[\s‌]*کوین|اتریوم)|ای[\s‌]*تی[\s‌]*اف/i, tag: "etf" },
  { re: /قانون[\s‌]*گذار|رگولاتور|سازمان\s*بورس|بانک\s*مرکزی|ممنوعیت|مجوز\s*(فعالیت|ارز)|کمیسیون\s*(اقتصاد|بلاک)/i, tag: "regulation" },
  { re: /پذیرش\s*نهادی|سرمایه‌گذاری\s*نهادی|خزانه‌داری\s*(شرکت|ملی|استراتژیک)|ذخیره\s*استراتژیک|صندوق\s*بازنشستگی/i, tag: "adoption" },
  { re: /هارد\s*فورک|سافت\s*فورک|ارتقا(ی)?\s*(شبکه|پروتکل|اتریوم)|هاوینگ|مین[\s‌]*نت|لایه[\s‌]*۲/i, tag: "protocol" },
  { re: /\b(will list|lists on|listing on|listed on|to list|new listing|spot listing|futures listing|lists)\b/i, tag: "listing" },
  { re: /لیست(ینگ)?\s*(در|روی|صرافی)|پذیرش\s*در\s*صرافی/i, tag: "listing" },
];

const SPAM =
  /\b(price prediction|to the moon|next 100x?|signals? group|giveaway|airdrop alert|will reach \$?\d|rsi|macd|bullish pattern|you should buy|how to buy)\b/i;
const OFFTOPIC = /\b(openai|anthropic|chatgpt|claude|nuclear weapons?|nukes?|million math problem)\b/i;
const CRYPTO_CTX = /\b(bitcoin|btc|ethereum|ether|eth|crypto|blockchain|token|defi|stablecoin|web3|etf|sec|cftc)\b/i;

const COIN_HINTS: { re: RegExp; symbol: string }[] = [
  { re: /\b(bitcoin|btc)\b/i, symbol: "BTC" },
  { re: /\b(ethereum|ether|eth)\b/i, symbol: "ETH" },
  { re: /\b(solana|sol)\b/i, symbol: "SOL" },
  { re: /\b(xrp|ripple)\b/i, symbol: "XRP" },
  { re: /\b(dogecoin|doge)\b/i, symbol: "DOGE" },
  { re: /\b(cardano|ada)\b/i, symbol: "ADA" },
  { re: /\b(avalanche|avax)\b/i, symbol: "AVAX" },
  { re: /\b(chainlink|link)\b/i, symbol: "LINK" },
  { re: /\b(binance coin|bnb)\b/i, symbol: "BNB" },
  { re: /\b(toncoin|ton)\b/i, symbol: "TON" },
  { re: /\b(litecoin|ltc)\b/i, symbol: "LTC" },
  { re: /\b(uniswap|uni)\b/i, symbol: "UNI" },
  { re: /\b(arbitrum|arb)\b/i, symbol: "ARB" },
  { re: /\b(zcash|zec)\b/i, symbol: "ZEC" },
  { re: /\b(hyperliquid|hype)\b/i, symbol: "HYPE" },
  { re: /\b(stellar|xlm)\b/i, symbol: "XLM" },
  { re: /\b(tron|trx)\b/i, symbol: "TRX" },
  { re: /\bsui\b/i, symbol: "SUI" },
  { re: /\b(near protocol|near)\b/i, symbol: "NEAR" },
  { re: /\baave\b/i, symbol: "AAVE" },
  { re: /\b(polkadot|dot)\b/i, symbol: "DOT" },
  { re: /\b(polygon|matic|pol)\b/i, symbol: "POL" },
  { re: /\b(shiba|shib)\b/i, symbol: "SHIB" },
  { re: /\bpepe\b/i, symbol: "PEPE" },
  { re: /\b(optimism|op token)\b/i, symbol: "OP" },
  { re: /\b(render|rndr)\b/i, symbol: "RENDER" },
  { re: /\b(aptos|apt)\b/i, symbol: "APT" },
];

function detectCoins(text: string): string[] {
  const out: string[] = [];
  for (const h of COIN_HINTS) {
    if (h.re.test(text) && !out.includes(h.symbol)) out.push(h.symbol);
  }
  return out.slice(0, 4);
}

function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    rsquo: "\u2019",
    lsquo: "\u2018",
    rdquo: "\u201d",
    ldquo: "\u201c",
    ndash: "\u2013",
    mdash: "\u2014",
    hellip: "\u2026",
  };
  let out = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let i = 0; i < 4; i++) {
    const next = out.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, ent: string) => {
      if (ent[0] === "#") {
        const n = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : Number(ent.slice(1));
        return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : full;
      }
      return named[ent.toLowerCase()] ?? full;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

function innerTag(block: string, name: string): string {
  const re = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]).trim() : "";
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim());
}

function cleanExcerpt(title: string, excerpt: string): string {
  let e = decodeEntities(excerpt).replace(/\s+/g, " ").trim();
  if (!e) return "";
  if (e.startsWith(title.slice(0, Math.min(40, title.length)))) return "";
  e = e.replace(/\s+[·|]\s+[A-Za-z0-9 .&'-]{2,40}$/, "").trim();
  e = e.replace(/\s*View Full Coverage on Google News.*$/i, "").trim();
  if (/&#\d+|&#x[0-9a-f]+|&[a-z]+;/i.test(e)) return "";
  return e.slice(0, 220);
}

const MAX_NEWS_AGE_MS = 21 * 24 * 60 * 60 * 1000;

function parseRss(xml: string, source: string, maxAgeMs = MAX_NEWS_AGE_MS): NewsItem[] {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const items: NewsItem[] = [];
  for (const block of blocks) {
    const title = stripHtml(innerTag(block, "title"));
    let url = innerTag(block, "link") || innerTag(block, "guid");
    url = url.replace(/\s+/g, "");
    if (!title || !url) continue;
    const pub = innerTag(block, "pubDate") || innerTag(block, "published");
    if (!pub) continue;
    const publishedAt = new Date(pub).toISOString();
    if (Number.isNaN(Date.parse(publishedAt))) continue;
    if (Date.now() - Date.parse(publishedAt) > maxAgeMs) continue;
    const rawExcerpt = stripHtml(innerTag(block, "description") || innerTag(block, "summary"));
    const sourceTag = stripHtml(innerTag(block, "source"));
    let resolvedTitle = title;
    const resolvedSource = sourceTag || source;
    const suffix = ` - ${resolvedSource}`;
    if (resolvedTitle.endsWith(suffix)) resolvedTitle = resolvedTitle.slice(0, -suffix.length).trim();
    const excerpt = cleanExcerpt(resolvedTitle, rawExcerpt);
    const hay = `${resolvedTitle} ${excerpt}`;
    if (SPAM.test(hay)) continue;
    if (OFFTOPIC.test(hay) && !CRYPTO_CTX.test(hay)) continue;
    const tags: NewsTag[] = [];
    let score = 0;
    for (const f of FUNDAMENTAL) {
      if (f.re.test(hay)) {
        if (!tags.includes(f.tag)) tags.push(f.tag);
        if (FUND_TAGS.has(f.tag)) score += 2;
        else score += 1;
      }
    }
    const hasFund = tags.some((t) => FUND_TAGS.has(t));
    if (hasFund) {
      if (resolvedSource === "The Block" || resolvedSource === "CoinDesk") score += 2;
      if (resolvedSource === "Decrypt" || resolvedSource === "Blockworks") score += 1;
    }
    items.push({
      id: `${resolvedSource}-${url}`,
      title: resolvedTitle,
      url,
      source: resolvedSource,
      publishedAt,
      excerpt,
      score,
      tags: tags.length ? tags : ["markets"],
      coins: detectCoins(hay),
    });
  }
  return items;
}

function hasPersian(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s);
}

async function gtxFa(text: string): Promise<string> {
  return translateToFa(text);
}

async function fallbackTranslate(
  items: { id: string; title: string; excerpt: string }[],
): Promise<{ id: string; title: string; excerpt: string }[]> {
  const settled = await mapPool(items.slice(0, 8), 3, async (it) => {
    const title = await gtxFa(it.title);
    if (!title) return null;
    const excerpt = it.excerpt ? await gtxFa(it.excerpt) : "";
    return { id: it.id, title, excerpt };
  });
  return settled.filter((row): row is { id: string; title: string; excerpt: string } => Boolean(row));
}

async function localizeNews(items: NewsItem[]): Promise<NewsItem[]> {
  return mapPool(items, 6, async (item) => {
    if (hasPersian(item.title)) return item;
    const title = await gtxFa(item.title);
    if (!title) return item;
    const excerpt = item.excerpt ? (await gtxFa(item.excerpt)) || item.excerpt : "";
    return { ...item, title, excerpt };
  });
}

const FEEDS: { url: string; source: string }[] = [
  { url: "https://www.theblock.co/rss.xml", source: "The Block" },
  { url: "https://decrypt.co/feed", source: "Decrypt" },
  { url: "https://cointelegraph.com/rss", source: "Cointelegraph" },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss", source: "CoinDesk" },
  { url: "https://blockworks.co/feed", source: "Blockworks" },
  {
    url: "https://news.google.com/rss/search?q=bitcoin+ETF+OR+SEC+crypto+regulation+OR+%22bitcoin+reserve%22+OR+ethereum+upgrade+OR+institutional+crypto&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
  },
];

export const getNews = createServerFn({ method: "GET" }).handler(async (): Promise<NewsItem[]> => {
  const picked = await cached("news-rss-v11", 5 * 60_000, async () => {
    const settled = await Promise.allSettled(FEEDS.map((f) => fetchText(f.url, 10000)));
    const all: NewsItem[] = [];
    settled.forEach((res, i) => {
      if (res.status !== "fulfilled") return;
      try {
        all.push(...parseRss(res.value, FEEDS[i].source));
      } catch {
        /* skip */
      }
    });
    const unique = uniqueNews(all);
    const strong = unique.filter((n) => n.tags.some((t) => FUND_TAGS.has(t)));
    const picked = (strong.length >= 8 ? strong : unique).slice(0, 36);
    return picked;
  });
  return localizeNews(picked);
});

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const EXCHANGES = ["Binance", "Coinbase", "OKX", "Bybit", "Upbit", "Kraken", "Bitget", "Gate.io", "KuCoin", "MEXC"];

function uniqueNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const unique: NewsItem[] = [];
  for (const item of items) {
    const key =
      item.url.replace(/[?#].*$/, "").toLowerCase() ||
      item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").slice(0, 80);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  unique.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  });
  return unique;
}

function resolveCoinQuery(q: string, coins: MarketCoin[]): { symbol: string; name: string; aliases: string[] } {
  const raw = q.trim();
  const lower = raw.toLowerCase();
  const hit =
    coins.find((c) => c.symbol.toLowerCase() === lower) ||
    coins.find((c) => c.id === lower) ||
    coins.find((c) => c.name.toLowerCase() === lower) ||
    coins.find((c) => faName(c.symbol, "") === raw) ||
    coins.find(
      (c) =>
        c.symbol.toLowerCase().includes(lower) ||
        c.name.toLowerCase().includes(lower) ||
        faName(c.symbol, "").includes(raw),
    );
  if (hit) {
    const fa = faName(hit.symbol, hit.name);
    return {
      symbol: hit.symbol,
      name: hit.name,
      aliases: [...new Set([hit.symbol, hit.name, fa, hit.id].filter(Boolean))],
    };
  }
  return { symbol: raw.toUpperCase(), name: raw, aliases: [raw] };
}

export const getCoinNews = createServerFn({ method: "POST" })
  .validator((data: { q: string }) => ({ q: String(data?.q ?? "").trim().slice(0, 40) }))
  .handler(async ({ data }): Promise<{ query: string; symbol: string; name: string; items: NewsItem[] }> => {
    if (data.q.length < 2) return { query: data.q, symbol: "", name: "", items: [] };
    const fresh = await cached(`coin-news-rss-v4-${data.q.toLowerCase()}`, 10 * 60_000, async () => {
      const markets = await cachedMarkets();
      const resolved = resolveCoinQuery(data.q, markets.coins);
      const orNames = resolved.aliases.slice(0, 3).map((n) => `"${n}"`).join(" OR ");
      const googleQ = `(${orNames}) (ETF OR SEC OR regulation OR upgrade OR fork OR listing OR institutional OR protocol OR approved OR قانون OR پذیرش OR ارتقا)`;
      const tag = resolved.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const encoded = encodeURIComponent(googleQ);
      const feeds: { url: string; source: string }[] = [
        { url: `https://news.google.com/rss/search?q=${encoded}+when:1y&hl=en-US&gl=US&ceid=US:en`, source: "Google News" },
        { url: `https://news.google.com/rss/search?q=${encoded}+when:1y&hl=fa&gl=IR&ceid=IR:fa`, source: "گوگل نیوز" },
        ...(tag
          ? [{ url: `https://cointelegraph.com/rss/tag/${encodeURIComponent(tag)}`, source: "Cointelegraph" }]
          : []),
      ];
      const settled = await Promise.allSettled(feeds.map((f) => fetchText(f.url, 10000)));
      const all: NewsItem[] = [];
      settled.forEach((res, i) => {
        if (res.status !== "fulfilled") return;
        try {
          all.push(...parseRss(res.value, feeds[i].source, YEAR_MS));
        } catch {
          /* skip */
        }
      });
      const needle = resolved.aliases.map((a) => a.toLowerCase());
      const matched = uniqueNews(all).filter((item) => {
        const hay = `${item.title} ${item.excerpt} ${item.coins.join(" ")}`.toLowerCase();
        return (
          item.coins.some((c) => c.toUpperCase() === resolved.symbol.toUpperCase()) ||
          needle.some((n) => n.length >= 2 && hay.includes(n.toLowerCase()))
        );
      });
      const withCoin = matched.map((item) => ({
        ...item,
        coins: item.coins.includes(resolved.symbol) ? item.coins : [resolved.symbol, ...item.coins].slice(0, 4),
      }));
      const strong = withCoin.filter((n) => n.tags.some((t) => FUND_TAGS.has(t) || t === "listing"));
      const items = (strong.length >= 5 ? strong : withCoin).slice(0, 24);
      return { query: data.q, symbol: resolved.symbol, name: resolved.name, items };
    });
    return { ...fresh, items: await localizeNews(fresh.items) };
  });

export const translateNews = createServerFn({ method: "POST" })
  .validator((data: { items: { id: string; title: string; excerpt: string }[] }) => {
    const items = Array.isArray(data?.items) ? data.items.slice(0, 8) : [];
    return {
      items: items.map((it) => ({
        id: String(it?.id ?? "").slice(0, 240),
        title: String(it?.title ?? "").slice(0, 280),
        excerpt: String(it?.excerpt ?? "").slice(0, 280),
      })),
    };
  })
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; items: { id: string; title: string; excerpt: string }[] } | { ok: false; error: string }> => {
      const fresh = data.items.filter((it) => it.id && it.title);
      if (!fresh.length) return { ok: true, items: [] };
      const cachedHits: { id: string; title: string; excerpt: string }[] = [];
      const missing: typeof fresh = [];
      for (const it of fresh) {
        const hit = mem.get(`tr-${it.id}`) as { at: number; data: { title: string; excerpt: string } } | undefined;
        if (hit && Date.now() - hit.at < 24 * 60 * 60 * 1000) cachedHits.push({ id: it.id, ...hit.data });
        else missing.push(it);
      }
      if (!missing.length) return { ok: true, items: cachedHits };

      const fallback = await fallbackTranslate(missing);
      const got = new Set(fallback.map((item) => item.id));
      const still = missing.filter((item) => !got.has(item.id));
      if (!still.length) {
        for (const item of fallback) {
          mem.set(`tr-${item.id}`, { at: Date.now(), data: { title: item.title, excerpt: item.excerpt } });
        }
        return { ok: true, items: [...cachedHits, ...fallback] };
      }

      const apiKey = process.env.XAI_API_KEY;
      if (apiKey) {
        try {
          const res = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            signal: AbortSignal.timeout(8000),
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "grok-4.5",
              max_tokens: 1400,
              temperature: 0.2,
              messages: [
                {
                  role: "system",
                  content:
                    "تو مترجم اخبار رمزارز هستی. عنوان و خلاصه را به فارسی روان برگردان. نام ارز، تیکر، ETF و SEC را انگلیسی نگه دار. فقط JSON: {\"items\":[{\"id\":\"...\",\"title\":\"...\",\"excerpt\":\"...\"}]}",
                },
                { role: "user", content: JSON.stringify(still) },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (res.ok) {
            const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
            const raw = body.choices?.[0]?.message?.content ?? "";
            const parsedUnknown = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim()) as
              | { items?: { id: string; title: string; excerpt: string }[] }
              | { id: string; title: string; excerpt: string }[];
            const parsed = Array.isArray(parsedUnknown)
              ? parsedUnknown
              : Array.isArray(parsedUnknown.items)
                ? parsedUnknown.items
                : [];
            const out = parsed
              .filter((p) => p && p.id && hasPersian(String(p.title ?? "")))
              .map((p) => ({ id: String(p.id), title: String(p.title ?? ""), excerpt: String(p.excerpt ?? "") }));
            if (out.length) {
              for (const item of out) mem.set(`tr-${item.id}`, { at: Date.now(), data: { title: item.title, excerpt: item.excerpt } });
              const leftover = still.filter((m) => !out.some((o) => o.id === m.id));
              const extra = leftover.length ? await fallbackTranslate(leftover) : [];
              return { ok: true, items: [...cachedHits, ...fallback, ...out, ...extra] };
            }
          }
        } catch {
          /* fallback */
        }
      }

      if (!fallback.length) return { ok: false, error: "ترجمه انجام نشد — دوباره بزن" };
      for (const item of fallback) mem.set(`tr-${item.id}`, { at: Date.now(), data: { title: item.title, excerpt: item.excerpt } });
      return { ok: true, items: [...cachedHits, ...fallback] };
    },
  );

type DexProfile = {
  url: string;
  chainId: string;
  tokenAddress: string;
  icon?: string;
  description?: string;
};

type DexPairs = {
  pairs?: {
    url: string;
    chainId: string;
    dexId: string;
    priceUsd?: string;
    liquidity?: { usd?: number };
    priceChange?: { h24?: number };
    pairCreatedAt?: number;
    baseToken?: { address: string; name: string; symbol: string };
  }[];
};

function mentionExchanges(text: string): string[] {
  return EXCHANGES.filter((ex) => new RegExp(`\\b${ex.replace(".", "\\.")}\\b`, "i").test(text));
}

async function loadDexListings(): Promise<ListingItem[]> {
  try {
    const [profilesRes, boostsRes] = await Promise.allSettled([
      fetchJson<DexProfile[]>("https://api.dexscreener.com/token-profiles/latest/v1", 8000),
      fetchJson<DexProfile[]>("https://api.dexscreener.com/token-boosts/latest/v1", 8000),
    ]);
    const sources: DexProfile[] = [];
    const seenAddr = new Set<string>();
    for (const res of [profilesRes, boostsRes]) {
      if (res.status !== "fulfilled" || !Array.isArray(res.value)) continue;
      for (const p of res.value) {
        if (!p.chainId || !p.tokenAddress) continue;
        const key = `${p.chainId}:${p.tokenAddress.toLowerCase()}`;
        if (seenAddr.has(key)) continue;
        seenAddr.add(key);
        sources.push(p);
      }
    }
    const slice = sources.slice(0, 18);
    if (!slice.length) return [];
    const byChain = new Map<string, DexProfile[]>();
    for (const p of slice) {
      const list = byChain.get(p.chainId) ?? [];
      list.push(p);
      byChain.set(p.chainId, list);
    }
    type Pair = NonNullable<DexPairs["pairs"]>[number];
    const pairByAddress = new Map<string, Pair>();
    await Promise.allSettled(
      [...byChain.entries()].map(async ([chain, rows]) => {
        for (let i = 0; i < rows.length; i += 6) {
          const addrs = rows.slice(i, i + 6).map((r) => r.tokenAddress).join(",");
          try {
            const json = await fetchJson<Pair[] | DexPairs>(
              `https://api.dexscreener.com/tokens/v1/${encodeURIComponent(chain)}/${addrs}`,
              7000,
            );
            const pairs = Array.isArray(json) ? json : (json.pairs ?? []);
            for (const pair of pairs) {
              const addr = pair.baseToken?.address?.toLowerCase();
              if (!addr) continue;
              const prev = pairByAddress.get(addr);
              if (!prev || (pair.liquidity?.usd ?? 0) > (prev.liquidity?.usd ?? 0)) pairByAddress.set(addr, pair);
            }
          } catch {
            /* optional */
          }
        }
      }),
    );
    const items: ListingItem[] = [];
    for (const profile of slice) {
      const pair = pairByAddress.get(profile.tokenAddress.toLowerCase());
      const base = pair?.baseToken;
      const created = pair?.pairCreatedAt ?? 0;
      const ageMs = created ? Date.now() - created : 0;
      if (ageMs && ageMs > 180 * 24 * 60 * 60 * 1000) continue;
      items.push({
        id: `${profile.chainId}-${profile.tokenAddress}`,
        name: (base?.name || profile.description || profile.tokenAddress.slice(0, 8)).slice(0, 48),
        symbol: (base?.symbol || "NEW").toUpperCase().trim() || "NEW",
        chain: profile.chainId,
        priceUsd: pair?.priceUsd ? Number(pair.priceUsd) : null,
        change24h: pair?.priceChange?.h24 ?? null,
        liquidityUsd: pair?.liquidity?.usd ?? null,
        url: pair?.url || profile.url,
        icon: profile.icon?.startsWith("http") ? profile.icon : null,
        kind: "dex",
        headline: (profile.description || "").replace(/\s+/g, " ").slice(0, 160) || null,
        exchanges: [],
      });
    }
    return items.slice(0, 24);
  } catch {
    return [];
  }
}

type BinanceCms = { data?: { articles?: { id: number; code: string; title: string }[] } };

async function loadBinanceListings(): Promise<ListingItem[]> {
  try {
    const json = await fetchJson<BinanceCms>(
      "https://www.binance.com/bapi/composite/v1/public/cms/article/catalog/list/query?catalogId=48&pageNo=1&pageSize=20",
      8000,
    );
    const items: ListingItem[] = [];
    const seen = new Set<string>();
    for (const a of json.data?.articles ?? []) {
      const title = a.title || "";
      if (!title || !/will list|will add|new listing|\blists\b|listed |trading pair/i.test(title)) continue;
      const symbol = [...title.matchAll(/\(([A-Z0-9]{2,15})\)/g)].map((m) => m[1])[0] || "—";
      const url = `https://www.binance.com/en/support/announcement/${a.code || a.id}`;
      if (seen.has(url)) continue;
      seen.add(url);
      items.push({
        id: `binance-${a.code || a.id}`,
        name: symbol,
        symbol,
        chain: null,
        priceUsd: null,
        change24h: null,
        liquidityUsd: null,
        url,
        icon: null,
        kind: "cex-news",
        headline: title,
        exchanges: ["Binance"],
      });
    }
    return items;
  } catch {
    return [];
  }
}

type OkxAnn = { code: string; data?: { details?: { title: string; url: string; pTime?: string }[] }[] };

async function loadCexListingNews(): Promise<ListingItem[]> {
  const items: ListingItem[] = [];
  try {
    const json = await fetchJson<OkxAnn>(
      "https://www.okx.com/api/v5/support/announcements?annType=announcements-new-listings",
      8000,
    );
    const seen = new Set<string>();
    for (const row of json.data?.[0]?.details ?? []) {
      const title = row.title || "";
      const url = row.url || "";
      if (!title || !url) continue;
      const pair = title.match(/\b([A-Z0-9]{2,12})\s*\/\s*(USDT|USD|USDC)\b/i);
      const named = title.match(/\(([^)]+)\)/);
      const symbol = (pair?.[1] || "—").toUpperCase();
      const key = `${symbol}-${title.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `okx-${url}`,
        name: named?.[1] || symbol,
        symbol,
        chain: null,
        priceUsd: null,
        change24h: null,
        liquidityUsd: null,
        url,
        icon: null,
        kind: "cex-news",
        headline: title,
        exchanges: ["OKX"],
      });
    }
  } catch {
    /* optional */
  }
  const feeds = [
    { url: "https://cointelegraph.com/rss", source: "Cointelegraph" },
    { url: "https://decrypt.co/feed", source: "Decrypt" },
  ];
  const settled = await Promise.allSettled(feeds.map((f) => fetchText(f.url, 10000)));
  const all: NewsItem[] = [];
  settled.forEach((res, i) => {
    if (res.status !== "fulfilled") return;
    try {
      all.push(...parseRss(res.value, feeds[i].source, 45 * 24 * 60 * 60 * 1000));
    } catch {
      /* skip */
    }
  });
  for (const n of uniqueNews(all)
    .filter((n) => n.tags.includes("listing") || mentionExchanges(`${n.title} ${n.excerpt}`).length > 0)
    .slice(0, 12)) {
    items.push({
      id: n.id,
      name: n.coins[0] ? faName(n.coins[0], n.coins[0]) : n.title.slice(0, 48),
      symbol: n.coins[0] || "—",
      chain: null,
      priceUsd: null,
      change24h: null,
      liquidityUsd: null,
      url: n.url,
      icon: null,
      kind: "cex-news",
      headline: n.title,
      exchanges: mentionExchanges(`${n.title} ${n.excerpt}`),
    });
  }
  const seenUrl = new Set<string>();
  return items.filter((it) => {
    const key = it.url.replace(/[?#].*$/, "").toLowerCase();
    if (seenUrl.has(key)) return false;
    seenUrl.add(key);
    return true;
  }).slice(0, 20);
}

export const getListings = createServerFn({ method: "GET" }).handler(async (): Promise<ListingsPayload> => {
  return cached("listings-v4", 5 * 60_000, async () => {
    const [dexResult, newsResult, binanceResult] = await Promise.allSettled([
      loadDexListings(),
      loadCexListingNews(),
      loadBinanceListings(),
    ]);
    const dex = dexResult.status === "fulfilled" ? dexResult.value : [];
    const news = newsResult.status === "fulfilled" ? newsResult.value : [];
    const binance = binanceResult.status === "fulfilled" ? binanceResult.value : [];
    const seen = new Set<string>();
    const cexNews: ListingItem[] = [];
    for (const item of [...binance, ...news]) {
      const key = item.url.replace(/[?#].*$/, "").toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      cexNews.push(item);
    }
    return { dex, cexNews: cexNews.slice(0, 24), updatedAt: new Date().toISOString() };
  });
});
