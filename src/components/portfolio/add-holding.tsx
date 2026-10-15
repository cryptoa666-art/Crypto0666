import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCoinSearch, useMarkets } from "@/lib/crypto/hooks";
import { faName } from "@/lib/crypto/names";
import { pushPortfolioCloud } from "@/lib/portfolio/cloud";
import { usePortfolio } from "@/lib/portfolio/store";
import type { CoinHit } from "@/lib/crypto/types";

export function AddHoldingButton({ preset }: { preset?: CoinHit }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>افزودن دارایی</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ثبت خرید</DialogTitle>
          <DialogDescription>
            مقدار و میانگین قیمت خرید را وارد کن تا ارزش لحظه‌ای محاسبه شود.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <AddHoldingForm
            preset={preset}
            onDone={() => {
              setOpen(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddHoldingForm({ preset, onDone }: { preset?: CoinHit; onDone: () => void }) {
  const { data } = useMarkets();
  const addHolding = usePortfolio((s) => s.addHolding);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<CoinHit | null>(preset ?? null);
  const [amount, setAmount] = useState("");
  const [avg, setAvg] = useState(() => {
    if (!preset) return "";
    const live = data?.coins.find((c) => c.id === preset.id || c.symbol === preset.symbol);
    return live ? String(Number(live.price.toPrecision(6))) : "";
  });
  const remote = useCoinSearch(query.length >= 2 && !picked ? query : "");

  const localHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data?.coins) return [];
    return data.coins
      .filter(
        (c) =>
          c.symbol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          faName(c.symbol, "").includes(query),
      )
      .slice(0, 8)
      .map((c) => ({ id: c.id, name: c.name, symbol: c.symbol, rank: c.rank }));
  }, [query, data?.coins]);

  const hits = picked ? [] : localHits.length ? localHits : (remote.data ?? []);

  function pick(hit: CoinHit) {
    setPicked(hit);
    setQuery("");
    const live = data?.coins.find((c) => c.id === hit.id || c.symbol === hit.symbol);
    if (live) setAvg(String(Number(live.price.toPrecision(6))));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!picked) {
      toast.error("یک ارز انتخاب کن");
      return;
    }
    const amt = Number(amount.replace(/,/g, ""));
    const buy = Number(avg.replace(/,/g, ""));
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("مقدار نامعتبر است");
      return;
    }
    if (!Number.isFinite(buy) || buy < 0) {
      toast.error("قیمت خرید نامعتبر است");
      return;
    }
    addHolding({
      id: picked.id,
      symbol: picked.symbol,
      name: picked.name,
      amount: amt,
      avgBuyUsd: buy,
    });
    const cloud = await pushPortfolioCloud();
    if (cloud.ok) {
      toast.success(`ذخیره شد · کد بازیابی ${cloud.code}`);
    } else {
      toast.success("روی این دستگاه ذخیره شد");
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="coin">ارز</Label>
        {picked ? (
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="flex h-11 w-full items-center justify-between rounded-lg bg-surface-2 px-3 text-start shadow-[var(--shadow-border)]"
          >
            <span>
              {faName(picked.symbol, picked.name)}
              <span className="ms-2 font-mono text-xs text-subtle">{picked.symbol}</span>
            </span>
            <span className="text-xs text-muted">تغییر</span>
          </button>
        ) : (
          <div className="relative">
            <Input
              id="coin"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو: بیت‌کوین، ETH، solana"
              autoComplete="off"
            />
            {query.trim() && hits.length > 0 ? (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl bg-surface-2 p-1 shadow-[var(--shadow-border)]">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => pick(hit)}
                      className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-sm hover:bg-surface-3"
                    >
                      <span>
                        {faName(hit.symbol, hit.name)}
                        <span className="ms-2 font-mono text-xs text-subtle">{hit.symbol}</span>
                      </span>
                      {hit.rank ? (
                        <span className="font-mono text-xs text-subtle">#{hit.rank}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">مقدار</Label>
          <Input
            id="amount"
            inputMode="decimal"
            dir="ltr"
            className="font-mono"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.15"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="avg">میانگین خرید (دلار)</Label>
          <Input
            id="avg"
            inputMode="decimal"
            dir="ltr"
            className="font-mono"
            value={avg}
            onChange={(e) => setAvg(e.target.value)}
            placeholder="68420"
          />
        </div>
      </div>
      <Button type="submit" className="w-full">
        ذخیره
      </Button>
    </form>
  );
}
