import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";
import { ExternalLink, Languages, Loader2 } from "lucide-react";
import type { XPost } from "@/lib/crypto/types";
import { translateXText } from "@/lib/crypto/x-feed";

function whenFa(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return formatDistanceToNow(new Date(t), { addSuffix: true, locale: faIR });
}

function PostCard({ post }: { post: XPost }) {
  const [fa, setFa] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function translate() {
    setBusy(true);
    setErr("");
    try {
      const res = await translateXText({ data: { text: post.text } });
      if (!res.ok) setErr(res.error);
      else setFa(res.text);
    } catch {
      setErr("ترجمه انجام نشد — دوباره بزن");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-3xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-subtle">
        <span className="font-mono text-fg" dir="ltr">
          @{post.handle}
        </span>
        <span>·</span>
        <span>{whenFa(post.publishedAt)}</span>
      </div>
      <p dir="auto" className="mt-2 break-words text-base font-medium leading-snug">
        {post.text}
      </p>
      {fa ? (
        <div className="mt-3 rounded-2xl bg-surface-2 px-3 py-2 shadow-[var(--shadow-border)]">
          <p className="mb-1 text-[11px] text-subtle">ترجمه فارسی</p>
          <p dir="rtl" className="break-words text-sm leading-6 text-fg">
            {fa}
          </p>
        </div>
      ) : null}
      {err ? <p className="mt-2 text-xs text-loss">{err}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void translate()}
          disabled={busy || Boolean(fa)}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-2 px-3 text-[11px] text-fg shadow-[var(--shadow-border)] disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Languages className="size-3.5" />}
          {fa ? "ترجمه‌شد" : "ترجمه به فارسی"}
        </button>
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          className="ms-auto inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] text-muted hover:text-fg"
        >
          <ExternalLink className="size-3.5" />
          پست در X
        </a>
      </div>
    </article>
  );
}

export function XFeed({ posts }: { posts: XPost[] }) {
  if (!posts.length) {
    return (
      <div className="rounded-3xl bg-surface px-6 py-16 text-center text-muted shadow-[var(--shadow-border)]">
        توییتی برای این جستجو نیست.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {posts.map((post) => (
        <li key={post.id}>
          <PostCard post={post} />
        </li>
      ))}
    </ul>
  );
}