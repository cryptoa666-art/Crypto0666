import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AtSign, CandlestickChart, Newspaper, Sparkles, Wallet } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHydratePortfolio, usePortfolio } from "@/lib/portfolio/store";
import { useMarkets } from "@/lib/crypto/hooks";
import { isEmbedded, isStandaloneApp } from "@/lib/app-url";

const NAV = [
  { to: "/", label: "بازار", icon: CandlestickChart, id: "market" as const },
  { to: "/listings", label: "لیستینگ", icon: Sparkles, id: "listings" as const },
  { to: "/portfolio", label: "پورتفولیو", icon: Wallet, id: "portfolio" as const },
  { to: "/news", label: "اخبار", icon: Newspaper, id: "news" as const },
  { to: "/xnews", label: "توییتر", icon: AtSign, id: "xnews" as const },
];

export type ShellTab = (typeof NAV)[number]["id"];

export function AppShell({
  active,
  children,
}: {
  active: ShellTab;
  children: ReactNode;
}) {
  useHydratePortfolio();
  const currency = usePortfolio((s) => s.currency);
  const setCurrency = usePortfolio((s) => s.setCurrency);
  const persistOk = usePortfolio((s) => s.persistOk);
  const { data } = useMarkets();
  const tomanReady = Boolean(data?.usdToToman);
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    setEmbedded(isEmbedded() && !isStandaloneApp());
  }, []);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="shrink-0 text-fg">
            <Wordmark compact />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-lg px-3 text-sm transition-colors duration-150",
                  active === item.id
                    ? "bg-surface-2 text-fg"
                    : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1 shadow-[var(--shadow-border)]">
              <Button
                size="sm"
                variant={currency === "usd" ? "default" : "ghost"}
                className="h-8 px-3"
                onClick={() => setCurrency("usd")}
              >
                دلار
              </Button>
              <Button
                size="sm"
                variant={currency === "toman" ? "default" : "ghost"}
                className="h-8 px-3"
                disabled={!tomanReady && currency !== "toman"}
                onClick={() => setCurrency("toman")}
              >
                تومان
              </Button>
            </div>
          </div>
        </div>
        {!persistOk && !embedded ? (
          <div className="border-t border-border bg-surface-2 px-4 py-2 text-center text-xs text-loss">
            ذخیره روی این صفحه ممکن نشد. از دانلود پشتیبان در پورتفولیو استفاده کن.
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 overflow-x-hidden px-4 pb-28 pt-6 md:pb-12">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] leading-none",
                active === item.id ? "text-fg" : "text-subtle",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
