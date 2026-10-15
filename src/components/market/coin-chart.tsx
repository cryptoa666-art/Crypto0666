import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint } from "@/lib/crypto/types";
import { formatUsd } from "@/lib/crypto/format";

export function CoinChart({
  points,
  up,
}: {
  points: ChartPoint[];
  up: boolean;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl bg-surface-2 text-sm text-muted">
        نمودار در دسترس نیست
      </div>
    );
  }
  const stroke = up ? "var(--color-gain)" : "var(--color-loss)";
  const data = points.map((p) => ({
    t: p.t,
    price: p.price,
  }));

  return (
    <div className="h-56 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="nabzFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis domain={["auto", "auto"]} hide />
          <Tooltip
            formatter={(v) => formatUsd(Number(v ?? 0))}
            labelFormatter={(t) =>
              new Date(Number(t)).toLocaleString("fa-IR", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            }
            contentStyle={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              fontFamily: "Vazirmatn, sans-serif",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={stroke}
            strokeWidth={1.8}
            fill="url(#nabzFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
