type CacheEntry = { at: number; data: string };
const mem = new Map<string, CacheEntry>();

function hasPersian(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s);
}

function pickFa(json: unknown): string {
  if (typeof json === "string") return json.trim();
  if (!Array.isArray(json) || json.length === 0) return "";
  const first = json[0];
  if (typeof first === "string") return json.filter((part) => typeof part === "string").join("").trim();
  if (Array.isArray(first)) {
    if (typeof first[0] === "string") return String(first[0]).trim();
    return first
      .map((part) => (Array.isArray(part) ? String((part as unknown[])[0] ?? "") : ""))
      .join("")
      .trim();
  }
  return "";
}

async function fetchFa(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return "";
    const text = await res.text();
    if (!text || text.startsWith("<")) return "";
    const out = pickFa(JSON.parse(text) as unknown);
    return hasPersian(out) ? out : "";
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

export async function translateAnyToFa(text: string): Promise<string> {
  const q = text.replace(/\s+/g, " ").trim().slice(0, 450);
  if (!q) return "";
  const key = `any:${q}`;
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < 24 * 60 * 60 * 1000 && hit.data) return hit.data;
  const encoded = encodeURIComponent(q);
  const dict = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=fa&dt=t&q=${encoded}`;
  const out = (await fetchFa(dict)) || (await new Promise((r) => setTimeout(r, 250)).then(() => fetchFa(dict)));
  if (!out) return "";
  mem.set(key, { at: Date.now(), data: out });
  return out;
}

export async function translateToFa(text: string): Promise<string> {
  const q = text.replace(/\s+/g, " ").trim().slice(0, 450);
  if (!q || hasPersian(q)) return hasPersian(q) ? q : "";
  const hit = mem.get(q);
  if (hit && Date.now() - hit.at < 24 * 60 * 60 * 1000 && hit.data) return hit.data;
  const encoded = encodeURIComponent(q);
  const dict = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=fa&dt=t&q=${encoded}`;
  const out = (await fetchFa(dict)) || (await new Promise((r) => setTimeout(r, 250)).then(() => fetchFa(dict)));
  if (!out) return "";
  mem.set(q, { at: Date.now(), data: out });
  return out;
}

export async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = await Promise.all(items.slice(i, i + size).map(fn));
    out.push(...chunk);
  }
  return out;
}
