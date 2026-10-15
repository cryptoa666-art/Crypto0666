import { create } from "zustand";
import { useEffect } from "react";
import type { QuoteCurrency } from "@/lib/crypto/format";

export type Holding = {
  key: string;
  id: string;
  symbol: string;
  name: string;
  amount: number;
  avgBuyUsd: number;
  addedAt: number;
};

export type Snapshot = { holdings: Holding[]; currency: QuoteCurrency; at?: number };

type PortfolioState = Snapshot & {
  hydrated: boolean;
  persistOk: boolean;
  setHydrated: (v: boolean) => void;
  setCurrency: (c: QuoteCurrency) => void;
  addHolding: (input: Omit<Holding, "key" | "addedAt">) => boolean;
  updateHolding: (key: string, patch: Partial<Pick<Holding, "amount" | "avgBuyUsd">>) => void;
  removeHolding: (key: string) => void;
  loadDemo: () => void;
  replaceAll: (snap: Snapshot) => boolean;
};

const KEY = "crypto666-portfolio-v2";
const LEGACY = "nabz-portfolio-v1";

const DEMO: Omit<Holding, "key" | "addedAt">[] = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", amount: 0.085, avgBuyUsd: 68420 },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", amount: 2.4, avgBuyUsd: 2280 },
  { id: "solana", symbol: "SOL", name: "Solana", amount: 35, avgBuyUsd: 148 },
  { id: "ripple", symbol: "XRP", name: "XRP", amount: 1800, avgBuyUsd: 1.92 },
];

function asHolding(raw: unknown): Holding | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Record<string, unknown>;
  const amount = Number(h.amount);
  const avgBuyUsd = Number(h.avgBuyUsd);
  const symbol = String(h.symbol ?? "").trim().toUpperCase();
  const id = String(h.id ?? symbol.toLowerCase()).trim();
  if (!id || !symbol || !Number.isFinite(amount) || amount <= 0) return null;
  return {
    key: String(h.key ?? `${id}-${h.addedAt ?? Date.now()}`),
    id,
    symbol,
    name: String(h.name ?? symbol),
    amount,
    avgBuyUsd: Number.isFinite(avgBuyUsd) && avgBuyUsd >= 0 ? avgBuyUsd : 0,
    addedAt: Number(h.addedAt) || Date.now(),
  };
}

function parseSnap(raw: string | null | undefined): Snapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: Snapshot } & Snapshot;
    const data = parsed.state ?? parsed;
    if (!data || !Array.isArray(data.holdings)) return null;
    const holdings = data.holdings.map(asHolding).filter((h): h is Holding => Boolean(h));
    return {
      holdings,
      currency: data.currency === "toman" ? "toman" : "usd",
      at: Number(data.at) || 0,
    };
  } catch {
    return null;
  }
}

function betterSnap(a: Snapshot | null, b: Snapshot | null): Snapshot | null {
  if (!a) return b;
  if (!b) return a;
  if (a.holdings.length !== b.holdings.length) {
    return a.holdings.length >= b.holdings.length ? a : b;
  }
  return (a.at ?? 0) >= (b.at ?? 0) ? a : b;
}

function readWebStorage(): Snapshot | null {
  if (typeof window === "undefined") return null;
  let best: Snapshot | null = null;
  for (const store of [window.localStorage, window.sessionStorage]) {
    for (const k of [KEY, LEGACY]) {
      try {
        best = betterSnap(best, parseSnap(store.getItem(k)));
      } catch {
        /* ignore */
      }
    }
  }
  return best;
}

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open("crypto666", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(): Promise<Snapshot | null> {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("kv", "readonly");
      const req = tx.objectStore("kv").get(KEY);
      req.onsuccess = () => resolve(parseSnap(typeof req.result === "string" ? req.result : null));
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(payload: string): Promise<boolean> {
  const db = await openIdb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(payload, KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function cookieGet(): Snapshot | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${KEY}=`))
    ?.slice(KEY.length + 1);
  if (!raw) return null;
  try {
    return parseSnap(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

function cookieSet(payload: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const value = encodeURIComponent(payload);
    if (value.length > 3500) return false;
    const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${KEY}=${value}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    return Boolean(cookieGet());
  } catch {
    return false;
  }
}

export function exportPortfolioJson(): string {
  const { holdings, currency } = usePortfolio.getState();
  return JSON.stringify({ holdings, currency, app: "Crypto#666", at: Date.now() }, null, 2);
}

export function encodePortfolioBackup(): string {
  const { holdings, currency } = usePortfolio.getState();
  const compact = {
    c: currency,
    h: holdings.map((x) => [x.symbol, x.id, x.amount, x.avgBuyUsd, x.name] as const),
  };
  const json = JSON.stringify(compact);
  return `C666.${btoa(unescape(encodeURIComponent(json)))}`;
}

export function decodePortfolioBackup(raw: string): Snapshot | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    if (text.startsWith("C666.")) {
      const json = decodeURIComponent(escape(atob(text.slice(5))));
      const parsed = JSON.parse(json) as { c?: string; h?: unknown[] };
      const holdings = (parsed.h ?? [])
        .map((row) => {
          if (!Array.isArray(row) || row.length < 4) return null;
          return asHolding({
            symbol: row[0],
            id: row[1],
            amount: row[2],
            avgBuyUsd: row[3],
            name: row[4] ?? row[0],
          });
        })
        .filter((h): h is Holding => Boolean(h));
      return { holdings, currency: parsed.c === "toman" ? "toman" : "usd" };
    }
    return parseSnap(text);
  } catch {
    return null;
  }
}

function readHashSnap(): Snapshot | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return null;
  const params = new URLSearchParams(raw.includes("=") ? raw : `pf=${raw}`);
  const bag = params.get("pf");
  if (!bag) return null;
  try {
    return decodePortfolioBackup(decodeURIComponent(bag));
  } catch {
    return null;
  }
}

function writeHashSnap(snap: Snapshot) {
  if (typeof window === "undefined") return;
  if (!snap.holdings.length) return;
  try {
    const bag = encodePortfolioBackup();
    if (bag.length > 1500) return;
    const url = new URL(window.location.href);
    url.hash = `pf=${encodeURIComponent(bag)}`;
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    /* ignore */
  }
}

function writeSnap(snap: Snapshot): boolean {
  if (typeof window === "undefined") return false;
  const payload = JSON.stringify({
    holdings: snap.holdings,
    currency: snap.currency,
    at: Date.now(),
    app: "Crypto#666",
  });
  let ok = false;
  try {
    window.localStorage.setItem(KEY, payload);
    ok = window.localStorage.getItem(KEY) === payload;
  } catch {
    /* blocked */
  }
  try {
    window.sessionStorage.setItem(KEY, payload);
    if (!ok) ok = window.sessionStorage.getItem(KEY) === payload;
  } catch {
    /* blocked */
  }
  if (cookieSet(payload)) ok = true;
  void idbSet(payload);
  writeHashSnap(snap);
  return ok;
}

function readAllStores(): Snapshot | null {
  return betterSnap(betterSnap(readWebStorage(), cookieGet()), readHashSnap());
}

export const usePortfolio = create<PortfolioState>((set, get) => ({
  holdings: [],
  currency: "usd",
  at: 0,
  hydrated: false,
  persistOk: true,
  setHydrated: (hydrated) => set({ hydrated }),
  setCurrency: (currency) => {
    set({ currency });
    const ok = writeSnap({ holdings: get().holdings, currency });
    set({ persistOk: ok });
  },
  addHolding: (input) => {
    const existing = get().holdings.find(
      (h) => h.id === input.id || h.symbol.toUpperCase() === input.symbol.toUpperCase(),
    );
    let holdings: Holding[];
    if (existing) {
      const totalAmt = existing.amount + input.amount;
      const avg =
        totalAmt > 0
          ? (existing.avgBuyUsd * existing.amount + input.avgBuyUsd * input.amount) / totalAmt
          : input.avgBuyUsd;
      holdings = get().holdings.map((h) =>
        h.key === existing.key ? { ...h, id: input.id, amount: totalAmt, avgBuyUsd: avg } : h,
      );
    } else {
      holdings = [
        ...get().holdings,
        {
          ...input,
          key: `${input.id}-${Date.now()}`,
          addedAt: Date.now(),
        },
      ];
    }
    const wrote = writeSnap({ holdings, currency: get().currency });
    set({ holdings, persistOk: wrote });
    return wrote;
  },
  updateHolding: (key, patch) => {
    const holdings = get().holdings.map((h) => (h.key === key ? { ...h, ...patch } : h));
    const persistOk = writeSnap({ holdings, currency: get().currency });
    set({ holdings, persistOk });
  },
  removeHolding: (key) => {
    const holdings = get().holdings.filter((h) => h.key !== key);
    const persistOk = writeSnap({ holdings, currency: get().currency });
    set({ holdings, persistOk });
  },
  loadDemo: () => {
    const holdings = DEMO.map((h, i) => ({
      ...h,
      key: `demo-${h.id}`,
      addedAt: Date.now() - i * 86400000,
    }));
    const persistOk = writeSnap({ holdings, currency: get().currency });
    set({ holdings, persistOk });
  },
  replaceAll: (snap) => {
    const holdings = (snap.holdings ?? []).map(asHolding).filter((h): h is Holding => Boolean(h));
    const currency = snap.currency === "toman" ? "toman" : "usd";
    const persistOk = writeSnap({ holdings, currency });
    set({ holdings, currency, persistOk, hydrated: true });
    return persistOk;
  },
}));

function applyHydrate(saved: Snapshot | null) {
  const current = usePortfolio.getState();
  if (current.holdings.length && (!saved || saved.holdings.length === 0)) {
    const persistOk = writeSnap({ holdings: current.holdings, currency: current.currency });
    usePortfolio.setState({ hydrated: true, persistOk });
    return;
  }
  const chosen = betterSnap(saved, current.holdings.length ? current : null);
  if (chosen && chosen.holdings.length) {
    usePortfolio.setState({ ...chosen, hydrated: true, persistOk: true });
    writeSnap(chosen);
  } else {
    usePortfolio.setState({ hydrated: true });
  }
}

export function useHydratePortfolio() {
  useEffect(() => {
    applyHydrate(readAllStores());
    let cancelled = false;
    void idbGet().then((saved) => {
      if (!cancelled) applyHydrate(betterSnap(saved, readAllStores()));
    });
    void import("./cloud").then(({ restoreCloudIfEmpty }) => {
      window.setTimeout(() => {
        if (!cancelled && usePortfolio.getState().holdings.length === 0) {
          void restoreCloudIfEmpty();
        }
      }, 250);
    });
    try {
      void navigator.storage?.persist?.();
    } catch {
      /* optional */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      applyHydrate(parseSnap(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    const onShow = () => applyHydrate(betterSnap(readAllStores(), null));
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onShow();
    });
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);
}
