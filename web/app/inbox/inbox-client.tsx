"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCheck } from "lucide-react";
import {
  markAnnouncementRead,
  markAllAnnouncementsRead,
} from "@/lib/actions/announcements";
import type { InboxItem } from "@/lib/queries/announcements";

const fmtRelative = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

export function InboxClient({
  items,
  unreadCount,
}: {
  items: InboxItem[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Optimistic local read state — flips immediately on click, server
  // catches up on the revalidate.
  const [readLocal, setReadLocal] = useState<Set<string>>(
    new Set(items.filter((i) => i.readAt).map((i) => i.id)),
  );

  const onClick = (id: string) => {
    if (readLocal.has(id)) return;
    setReadLocal((prev) => new Set(prev).add(id));
    start(async () => {
      await markAnnouncementRead(id);
      router.refresh();
    });
  };

  const onMarkAll = () => {
    if (unreadCount === 0) return;
    setReadLocal(new Set(items.map((i) => i.id)));
    start(async () => {
      await markAllAnnouncementsRead();
      router.refresh();
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
        No announcements yet. When commissioners or admins send messages,
        they&apos;ll land here.
      </div>
    );
  }

  return (
    <>
      {unreadCount > 0 && (
        <div className="flex justify-end -mt-1">
          <button
            type="button"
            onClick={onMarkAll}
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11.5px] font-semibold tracking-[0.04em] uppercase border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-3)] hover:text-[color:var(--text)] disabled:opacity-60"
          >
            <CheckCheck size={12} /> Mark all read
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const isRead = readLocal.has(item.id);
          return (
            <article
              key={item.id}
              onClick={() => onClick(item.id)}
              className={`relative rounded-[14px] border p-4 cursor-pointer transition-colors ${
                isRead
                  ? "border-[color:var(--hairline-2)] bg-[color:var(--surface)]"
                  : "border-[color:var(--brand-soft)] bg-[color:var(--brand-soft)]/30"
              }`}
            >
              {!isRead && (
                <span
                  aria-hidden
                  className="absolute top-4 left-4 w-2 h-2 rounded-full bg-[color:var(--brand)]"
                />
              )}
              <div className={!isRead ? "pl-5" : ""}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold tracking-[0.05em] uppercase ${
                      item.scope === "global"
                        ? "bg-[color:var(--brand)] text-white"
                        : "bg-[color:var(--surface-2)] text-[color:var(--text-2)] border border-[color:var(--hairline)]"
                    }`}
                  >
                    {item.scope === "global"
                      ? "Global"
                      : item.leagueName ?? "League"}
                  </span>
                  <span className="text-[11px] text-[color:var(--text-4)] font-[family-name:var(--mono)] num">
                    {fmtRelative(item.createdAt)}
                  </span>
                  {item.authorName && (
                    <span className="text-[11px] text-[color:var(--text-3)]">
                      · {item.authorName}
                    </span>
                  )}
                </div>
                <h2 className="font-bold text-[15px] text-[color:var(--text)] mb-1.5">
                  {item.headline}
                </h2>
                <p className="text-[13px] text-[color:var(--text-2)] leading-relaxed whitespace-pre-wrap">
                  {item.body}
                </p>
                {item.ctaLabel && item.ctaUrl && (
                  <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={item.ctaUrl}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[var(--r-md)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[11.5px] tracking-[0.05em] uppercase"
                    >
                      {item.ctaLabel}
                    </Link>
                  </div>
                )}
                {isRead && item.readAt && (
                  <div className="text-[10.5px] text-[color:var(--text-4)] mt-2 inline-flex items-center gap-1">
                    <Check size={11} /> Read
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
