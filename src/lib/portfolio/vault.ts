import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";

const CODE_RE = /^C666-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function hashCode(code: string): string {
  return createHash("sha256").update(`crypto666:${code.trim().toUpperCase()}`).digest("hex");
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export const savePortfolioVault = createServerFn({ method: "POST" })
  .validator((data: { code: string; payload: string }) => ({
    code: normalizeCode(String(data?.code ?? "")).slice(0, 24),
    payload: String(data?.payload ?? "").slice(0, 8000),
  }))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!CODE_RE.test(data.code)) return { ok: false, error: "کد نامعتبر است" };
    if (!data.payload.startsWith("{") && !data.payload.startsWith("C666.")) {
      return { ok: false, error: "داده پورتفولیو نامعتبر است" };
    }
    try {
      const sql = await getSql();
      const hash = hashCode(data.code);
      await sql`
        insert into portfolio_vault (code_hash, payload, updated_at)
        values (${hash}, ${data.payload}, now())
        on conflict (code_hash)
        do update set payload = excluded.payload, updated_at = now()
      `;
      return { ok: true };
    } catch {
      return { ok: false, error: "ذخیره ابری الان ممکن نیست" };
    }
  });

export const loadPortfolioVault = createServerFn({ method: "POST" })
  .validator((data: { code: string }) => ({
    code: normalizeCode(String(data?.code ?? "")).slice(0, 24),
  }))
  .handler(async ({ data }): Promise<{ ok: true; payload: string } | { ok: false; error: string }> => {
    if (!CODE_RE.test(data.code)) return { ok: false, error: "کد نامعتبر است" };
    try {
      const sql = await getSql();
      const hash = hashCode(data.code);
      const rows = await sql<{ payload: string }>`
        select payload from portfolio_vault where code_hash = ${hash} limit 1
      `;
      const payload = rows[0]?.payload;
      if (!payload) return { ok: false, error: "با این کد پورتفولیویی پیدا نشد" };
      return { ok: true, payload };
    } catch {
      return { ok: false, error: "بازیابی ابری الان ممکن نیست" };
    }
  });
