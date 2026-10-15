import { cn } from "@/lib/utils";

export function PulseMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-surface-3" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="currentColor"
        className="text-accent"
        fontFamily="IBM Plex Mono, ui-monospace, monospace"
      >
        666
      </text>
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <PulseMark />
      <div className="leading-none">
        <div className="font-mono text-base font-semibold tracking-tight md:text-lg">
          Crypto<span className="text-muted">#666</span>
        </div>
        {!compact ? (
          <div className="mt-0.5 text-[11px] text-subtle">رصد زنده رمزارز</div>
        ) : null}
      </div>
    </div>
  );
}
