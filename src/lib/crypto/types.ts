import type { CoinUse } from "./categories";

export type MarketCoin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  rank: number;
  price: number;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  marketCap: number;
  volume24h: number;
  ath: number | null;
  athDate: string | null;
  sparkline: number[];
  high24h: number | null;
  low24h: number | null;
  category: CoinUse;
};

export type GlobalStats = {
  marketCap: number;
  volume24h: number;
  btcDominance: number;
  marketCapChange24h: number;
  coins: number;
};

export type FearGreed = {
  value: number;
  label: string;
};

export type MarketsPayload = {
  coins: MarketCoin[];
  global: GlobalStats | null;
  fearGreed: FearGreed | null;
  usdToToman: number | null;
  updatedAt: string;
};

export type ChartPoint = {
  t: number;
  price: number;
};

export type CoinDetail = {
  coin: MarketCoin;
  description: string;
  chart: ChartPoint[];
  days: number;
};

export type NewsTag = "regulation" | "etf" | "adoption" | "protocol" | "markets" | "listing";

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  excerpt: string;
  score: number;
  tags: NewsTag[];
  coins: string[];
};

export type CoinHit = {
  id: string;
  name: string;
  symbol: string;
  rank: number | null;
};

export type ListingItem = {
  id: string;
  name: string;
  symbol: string;
  chain: string | null;
  priceUsd: number | null;
  change24h: number | null;
  liquidityUsd: number | null;
  url: string;
  icon: string | null;
  kind: "dex" | "cex-news";
  headline: string | null;
  exchanges: string[];
};

export type ListingsPayload = {
  dex: ListingItem[];
  cexNews: ListingItem[];
  updatedAt: string;
};

export type VoiceKind = "person" | "coin";

export type XVoice = {
  handle: string;
  name: string;
  en: string;
  always: boolean;
  kind: VoiceKind;
  symbol?: string;
  aliases?: string[];
};

export type XVoiceChip = {
  handle: string;
  name: string;
  count: number;
  kind: VoiceKind;
  symbol?: string;
};

export type XPost = {
  id: string;
  handle: string;
  name: string;
  text: string;
  textFa: string;
  url: string;
  publishedAt: string;
  coins: string[];
  tags: NewsTag[];
  score: number;
};

export type XSearchPayload = {
  query: string;
  symbol: string;
  name: string;
  posts: XPost[];
  updatedAt: string;
  error?: string;
};
