import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { AddHoldingButton } from "@/components/portfolio/add-holding";
import {
  buildRows,
  HoldingsList,
  PortfolioSummary,
} from "@/components/portfolio/holdings-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAppUrl } from "@/lib/app-url";
import { useMarkets } from "@/lib/crypto/hooks";
import {
  decodePortfolioBackup,
  encodePortfolioBackup,
  exportPortfolioJson,
  usePortfolio,
  type Holding,
} from "@/lib/portfolio/store";
import {
  ensureVaultCode,
  pullPortfolioCloud,
  pushPortfolioCloud,
  readVaultCode,
} from "@/lib/portfolio/cloud";
import { isEmbedded, isStandaloneApp } from "@/lib/app-url";

export const Route = createFileRoute("/portfolio")({ component: PortfolioPage });

function PortfolioPage() {
  const { data } = useMarkets();
  const holdings = usePortfolio((s) => s.holdings);
  const currency = usePortfolio((s) => s.currency);
  const hydrated = usePortfolio((s) => s.hydrated);
  const loadDemo = usePortfolio((s) => s.loadDemo);
  const replaceAll = usePortfolio((s) => s.replaceAll);
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = buildRows(holdings, data?.coins ?? []);
  const [embedded, setEmbedded] = useState(false);
  const [code, setCode] = useState("");
  const [vaultCode, setVaultCode] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);

  useEffect(() => {
    setEmbedded(isEmbedded() && !isStandaloneApp());
    setVaultCode(readVaultCode());
  }, []);

  useEffect(() => {
    if (!hydrated || holdings.length === 0) return;
    const t = window.setTimeout(() => {
      void pushPortfolioCloud().then((res) => {
        if (res.ok) setVaultCode(res.code);
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [hydrated, holdings]);

  function downloadBackup() {
    const blob = new Blob([exportPortfolioJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "crypto666-portfolio.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("فایل پشتیبان دانلود شد");
  }

  async function copyCode() {
    const value = encodePortfolioBackup();
    try {
      await navigator.clipboard.writeText(value);
      toast.success("کد پشتیبان کپی شد");
    } catch {
      setCode(value);
      toast.message("کد را دستی کپی کن");
    }
  }

  async function copyVault() {
    const value = vaultCode || ensureVaultCode();
    setVaultCode(value);
    try {
      await navigator.clipboard.writeText(value);
      toast.success("کد بازیابی کپی شد — روی گوشی دیگر واردش کن");
    } catch {
      toast.message(value);
    }
  }

  async function saveCloud() {
    setCloudBusy(true);
    const res = await pushPortfolioCloud();
    setCloudBusy(false);
    setVaultCode(res.code);
    if (res.ok) toast.success("روی ابر ذخیره شد");
    else toast.error(res.error || "ذخیره ابری نشد");
  }

  async function restoreCloud() {
    const input = code.trim();
    if (/^C666-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(input)) {
      setCloudBusy(true);
      const res = await pullPortfolioCloud(input);
      setCloudBusy(false);
      if (res.ok) {
        setVaultCode(input.toUpperCase());
        toast.success("پورتفولیو از ابر آمد");
        setCode("");
      } else {
        toast.error(res.error || "بازیابی نشد");
      }
      return;
    }
    const snap = decodePortfolioBackup(input);
    if (!snap || !snap.holdings.length) {
      toast.error("کد نامعتبر است");
      return;
    }
    replaceAll(snap);
    toast.success("پورتفولیو بازیابی شد");
    setCode("");
  }

  function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          holdings?: Holding[];
          currency?: "usd" | "toman";
        };
        if (!Array.isArray(parsed.holdings)) throw new Error("bad");
        const ok = replaceAll({
          holdings: parsed.holdings,
          currency: parsed.currency === "toman" ? "toman" : "usd",
        });
        if (ok) toast.success("پورتفولیو بازیابی شد");
        else toast.error("بازیابی ذخیره نشد");
      } catch {
        toast.error("فایل پورتفولیو نامعتبر است");
      }
    };
    reader.readAsText(file);
  }

  return (
    <AppShell active="portfolio">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">پورتفولیو</h1>
            <p className="mt-1 text-sm text-muted">
              با افزودن دارایی یک کد بازیابی ساخته می‌شود. همان کد را روی گوشی دیگر وارد کن — اکانت X لازم نیست.
            </p>
          </div>
          <AddHoldingButton />
        </div>

        {embedded ? (
          <div className="rounded-3xl bg-loss-dim p-4">
            <p className="text-sm font-medium">داخل پیش‌نمایش چت، ذخیره مرورگر پاک می‌شود</p>
            <p className="mt-1 text-sm text-muted">
              کد بازیابی را نگه دار یا اپ را در تب جدا باز کن. صفحه باید بازار Crypto#666 باشد، نه Account.
            </p>
            <div className="mt-3">
              <Button type="button" size="sm" asChild>
                <a href={typeof window === "undefined" ? "/" : getAppUrl() || "/"} target="_blank" rel="noreferrer">
                  باز کردن در مرورگر
                </a>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-3 rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm font-medium">کد بازیابی ابری</p>
          {vaultCode ? (
            <p className="rounded-xl bg-surface-2 px-3 py-2 text-center font-mono text-lg tracking-widest" dir="ltr">
              {vaultCode}
            </p>
          ) : (
            <p className="text-sm text-muted">با ذخیره اولین ارز، کد ساخته می‌شود.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={cloudBusy || holdings.length === 0} onClick={() => void saveCloud()}>
              ذخیره در ابر
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={!vaultCode} onClick={() => void copyVault()}>
              کپی کد بازیابی
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => void copyCode()}>
              کپی پشتیبان
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={downloadBackup}>
              دانلود فایل
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              بازیابی از فایل
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="کد C666-XXXX-XXXX یا پشتیبان"
              className="font-mono text-xs"
              dir="ltr"
            />
            <Button type="button" size="sm" className="shrink-0" disabled={cloudBusy} onClick={() => void restoreCloud()}>
              بازیابی
            </Button>
          </div>
        </div>

        {!hydrated ? (
          <div className="rounded-3xl bg-surface px-6 py-16 text-center text-sm text-muted shadow-[var(--shadow-border)]">
            در حال خواندن دارایی‌های ذخیره‌شده…
          </div>
        ) : holdings.length === 0 ? (
          <div className="rounded-3xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-border)]">
            <p className="text-lg font-medium">هنوز دارایی ثبت نشده</p>
            <p className="mt-1 text-sm text-muted">خریدهایت را وارد کن یا یک پورتفولیوی نمونه ببین.</p>
            <div className="mt-5 flex justify-center">
              <Button variant="secondary" onClick={loadDemo}>
                نمایش نمونه
              </Button>
            </div>
          </div>
        ) : (
          <>
            <PortfolioSummary
              rows={rows}
              currency={currency}
              usdToToman={data?.usdToToman ?? null}
            />
            <HoldingsList
              rows={rows}
              currency={currency}
              usdToToman={data?.usdToToman ?? null}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
