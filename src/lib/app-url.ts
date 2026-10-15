export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as { standalone?: boolean }).standalone)
  );
}

function getPublishedUrl(): string {
  const host = String(import.meta.env.VITE_PUBLIC_HOSTNAME ?? "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();
  if (!host || !host.includes(".") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return "";
  if (host === "localhost" || host.endsWith(".localhost")) return "";
  if (isGrokAccountHost(host) || isEphemeralPreviewHost(host)) return "";
  if (isPublicAppHost(host)) return `https://${host}/`;
  return "";
}

export function isGrokAccountHost(host = typeof window === "undefined" ? "" : window.location.hostname): boolean {
  const h = host.toLowerCase();
  return (
    h === "accounts.x.ai" ||
    h.endsWith(".x.ai") ||
    h === "grok.com" ||
    h.endsWith(".grok.com") ||
    h === "x.com" ||
    h.endsWith(".x.com")
  );
}

export function isEphemeralPreviewHost(host = typeof window === "undefined" ? "" : window.location.hostname): boolean {
  const h = host.toLowerCase();
  return (
    h.endsWith(".grok-sandbox.com") ||
    h.includes(".preview.") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

export function isPublicAppHost(host = typeof window === "undefined" ? "" : window.location.hostname): boolean {
  const h = host.toLowerCase();
  return h.endsWith(".grok.me") && h !== "grok.me" && h !== "auth.grok.me" && h !== "gate.grok.me";
}

/** Origin of this running app (iframe src). Never grok.com / accounts.x.ai. */
export function getAppUrl(): string {
  if (typeof window === "undefined") return "";
  const published = getPublishedUrl();
  if (published) return published;
  if (isGrokAccountHost()) return "";
  const url = new URL(window.location.href);
  url.searchParams.delete("install");
  url.searchParams.delete("platform");
  url.hash = "";
  return `${url.origin}/`;
}

/** URL that is safe to open on a different phone. Empty until the app is published. */
export function getShareInstallUrl(): string {
  const published = getPublishedUrl();
  if (published) return published;
  if (typeof window === "undefined") return "";
  if (isPublicAppHost() && !isGrokAccountHost()) return `${window.location.origin}/`;
  return "";
}

export function parsePublicAppUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase();
    if (isGrokAccountHost(host)) return "";
    if (isEphemeralPreviewHost(host)) return "";
    if (!isPublicAppHost(host)) return "";
    return `${url.origin}/`;
  } catch {
    return "";
  }
}

export function isSafeInstallUrl(raw: string): boolean {
  return Boolean(parsePublicAppUrl(raw));
}

export type InstallHostKind = "public" | "preview" | "account" | "embedded";

export function installHostKind(): InstallHostKind {
  if (isGrokAccountHost()) return "account";
  if (isEmbedded() && !isStandaloneApp()) return "embedded";
  if (isPublicAppHost() || Boolean(getPublishedUrl())) return "public";
  return "preview";
}

export function canInstallPwa(): boolean {
  return installHostKind() === "public";
}

export function isPersistUnreliable(): boolean {
  return isEmbedded() && !isStandaloneApp();
}
