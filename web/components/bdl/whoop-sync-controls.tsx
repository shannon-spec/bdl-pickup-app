"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const fmtRelative = (iso: string | null): string => {
  if (!iso) return "Never synced";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "Synced just now";
  if (m < 60) return `Synced ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Synced ${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Synced ${d}d ago`;
  return `Synced ${new Date(iso).toLocaleDateString()}`;
};

/**
 * Last synced + Sync now controls. The button calls /api/whoop/sync
 * and then refreshes the route so the server-rendered list picks up
 * any newly-imported workouts.
 */
export function WhoopSyncControls({
  playerId,
  lastSyncAt,
}: {
  playerId: string;
  lastSyncAt: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSync = () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    start(async () => {
      try {
        const res = await fetch("/api/whoop/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          setError(
            data?.error ?? `Sync failed (${res.status}). Try again.`,
          );
          return;
        }
        if (typeof data.inserted === "number" && data.inserted > 0) {
          setInfo(`Imported ${data.inserted} new session${data.inserted === 1 ? "" : "s"}.`);
        } else {
          setInfo("Already up to date.");
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sync failed.");
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[11px] tracking-[0.06em] uppercase text-[color:var(--text-3)] font-semibold">
        {fmtRelative(lastSyncAt)}
      </span>
      <button
        type="button"
        onClick={onSync}
        disabled={pending || busy}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[11px] font-bold tracking-[0.05em] uppercase text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors disabled:opacity-60"
      >
        <RefreshCw
          size={11}
          className={pending || busy ? "animate-spin" : ""}
        />
        {pending || busy ? "Syncing…" : "Sync now"}
      </button>
      {info && (
        <span className="text-[11px] text-[color:var(--up)]">{info}</span>
      )}
      {error && (
        <span className="text-[11px] text-[color:var(--down)]">{error}</span>
      )}
    </div>
  );
}
