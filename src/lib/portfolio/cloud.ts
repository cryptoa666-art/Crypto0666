import { loadPortfolioVault, savePortfolioVault } from "./vault";
import {
  decodePortfolioBackup,
  encodePortfolioBackup,
  usePortfolio,
  type Snapshot,
} from "./store";

const CODE_KEY = "crypto666-vault-code";
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateVaultCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (const b of bytes) raw += ALPHA[b % ALPHA.length];
  return `C666-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function cookieGet(name: string): string {
  if (typeof document === "undefined") return "";
  const raw = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return raw ? decodeURIComponent(raw) : "";
}

function cookieSet(name: string, value: string) {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
}

export function readVaultCode(): string {
  if (typeof window === "undefined") return "";
  try {
    const local = (window.localStorage.getItem(CODE_KEY) ?? "").trim().toUpperCase();
    if (local) return local;
    const session = (window.sessionStorage.getItem(CODE_KEY) ?? "").trim().toUpperCase();
    if (session) return session;
    return cookieGet(CODE_KEY).trim().toUpperCase();
  } catch {
    return cookieGet(CODE_KEY).trim().toUpperCase();
  }
}

export function writeVaultCode(code: string) {
  if (typeof window === "undefined") return;
  const value = code.trim().toUpperCase();
  try {
    window.localStorage.setItem(CODE_KEY, value);
    window.sessionStorage.setItem(CODE_KEY, value);
  } catch {
    /* ignore */
  }
  cookieSet(CODE_KEY, value);
}

export function ensureVaultCode(): string {
  const existing = readVaultCode();
  if (/^C666-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(existing)) return existing;
  const next = generateVaultCode();
  writeVaultCode(next);
  return next;
}

export async function pushPortfolioCloud(): Promise<{ ok: boolean; code: string; error?: string }> {
  const code = ensureVaultCode();
  const payload = encodePortfolioBackup();
  const res = await savePortfolioVault({ data: { code, payload } });
  if (!res.ok) return { ok: false, code, error: res.error };
  writeVaultCode(code);
  return { ok: true, code };
}

export async function pullPortfolioCloud(code: string): Promise<{ ok: boolean; error?: string }> {
  const normalized = code.trim().toUpperCase();
  const res = await loadPortfolioVault({ data: { code: normalized } });
  if (!res.ok) return { ok: false, error: res.error };
  const snap: Snapshot | null = decodePortfolioBackup(res.payload) ?? null;
  if (!snap || !snap.holdings.length) return { ok: false, error: "پورتفولیوی این کد خالی است" };
  writeVaultCode(normalized);
  usePortfolio.getState().replaceAll(snap);
  return { ok: true };
}

export async function restoreCloudIfEmpty(): Promise<boolean> {
  if (usePortfolio.getState().holdings.length) return false;
  const code = readVaultCode();
  if (!/^C666-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return false;
  const res = await pullPortfolioCloud(code);
  return res.ok;
}
