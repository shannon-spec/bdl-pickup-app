"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelInvite,
  createInvites,
  extendInvite,
  resendInvite,
  bulkCancelGameInvites,
} from "@/lib/actions/game-invites";
import type { ActivityRow, InviteRow, InviteSettings } from "@/lib/queries/game-invites";

type PoolPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  cell: string | null;
  level: string;
  status: string;
};

type Mode = "single" | "group" | "fcfs";

const STATE_TONE: Record<string, { label: string; cls: string }> = {
  queued: { label: "Queued", cls: "bg-[color:var(--surface-2)] text-[color:var(--text-3)]" },
  pending: {
    label: "Pending",
    cls: "bg-[color:var(--warn-soft)] text-[color:var(--warn)]",
  },
  confirmed: {
    label: "Confirmed",
    cls: "bg-[color:var(--up-soft)] text-[color:var(--up)]",
  },
  declined: {
    label: "Declined",
    cls: "bg-[color:var(--down-soft)] text-[color:var(--down)]",
  },
  expired: {
    label: "Expired",
    cls: "bg-[color:var(--surface-2)] text-[color:var(--text-3)]",
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-[color:var(--surface-2)] text-[color:var(--text-3)]",
  },
  superseded: {
    label: "Superseded",
    cls: "bg-[color:var(--surface-2)] text-[color:var(--text-4)]",
  },
};

const fmtCountdown = (expiresAt: Date | null) => {
  if (!expiresAt) return "";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m left`;
  const hr = Math.round(min / 60);
  return `${hr}h left`;
};

export function InviteManager({
  gameId,
  initialInvites,
  initialPool,
  initialActivity,
  settings,
}: {
  gameId: string;
  initialInvites: InviteRow[];
  initialPool: PoolPlayer[];
  initialActivity: ActivityRow[];
  settings: InviteSettings;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [expiryOverride, setExpiryOverride] = useState<number>(
    settings.expiryMinutes,
  );

  const togglePick = (id: string, multi: boolean) => {
    setPicked((prev) => {
      if (!multi) {
        return prev.has(id) ? new Set() : new Set([id]);
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredPool = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialPool;
    return initialPool.filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q),
    );
  }, [initialPool, search]);

  // Group active vs final
  const activeInvites = initialInvites.filter(
    (i) => i.state === "pending" || i.state === "queued",
  );
  const finalInvites = initialInvites.filter(
    (i) =>
      i.state !== "pending" &&
      i.state !== "queued" &&
      i.state !== "superseded",
  );

  const confirmedCount = initialInvites.filter(
    (i) => i.state === "confirmed",
  ).length;

  const send = () => {
    setError(null);
    if (mode !== "fcfs" && picked.size === 0) {
      setError("Pick at least one player.");
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.append("gameId", gameId);
      fd.append("mode", mode);
      fd.append("channels", "email");
      fd.append("expiryMinutesOverride", String(expiryOverride));
      if (mode !== "fcfs") {
        fd.append("playerIds", Array.from(picked).join(","));
      }
      const res = await createInvites(fd);
      if (res.ok) {
        setPicked(new Set());
        router.refresh();
      } else setError(res.error);
    });
  };

  const onCancel = (id: string) => {
    setError(null);
    start(async () => {
      const res = await cancelInvite(id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };
  const onResend = (id: string) => {
    setError(null);
    start(async () => {
      const res = await resendInvite(id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };
  const onExtend = (id: string) => {
    setError(null);
    start(async () => {
      const res = await extendInvite(id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };
  const onBulkCancel = () => {
    setError(null);
    start(async () => {
      const res = await bulkCancelGameInvites(gameId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-[color:var(--text-2)] flex items-center gap-2">
            <span aria-hidden className="w-[3px] h-[12px] rounded-sm bg-[color:var(--brand)]" />
            Invite Manager
          </div>
          <div className="text-[12px] text-[color:var(--text-3)] mt-1">
            {confirmedCount} of {settings.targetSeats} seats confirmed · expiry {settings.expiryMinutes}m
            {settings.fcfsEnabled ? " · FCFS on" : ""}
            {settings.autoBackfill ? " · auto-backfill on" : ""}
          </div>
        </div>
        {activeInvites.length > 0 && (
          <button
            type="button"
            onClick={onBulkCancel}
            disabled={pending}
            className="h-9 px-3 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-2)] text-[11px] font-bold tracking-[0.06em] uppercase text-[color:var(--text-3)]"
          >
            Cancel all pending
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        {/* Available pool */}
        <div className="rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] flex flex-col min-h-[320px]">
          <div className="px-4 py-3 border-b border-[color:var(--hairline)]">
            <div className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)] mb-2">
              Available · {filteredPool.length}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search league members…"
              className="w-full h-9 px-3 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] text-[13px] outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto max-h-[420px]">
            {filteredPool.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-[color:var(--text-3)]">
                Everyone in the league is already on the roster or has an active invite.
              </div>
            ) : (
              filteredPool.map((p) => {
                const isPicked = picked.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={(e) => togglePick(p.id, mode === "group" || e.shiftKey || e.metaKey)}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 border-t border-[color:var(--hairline)] first:border-t-0 text-left text-[13px] hover:bg-[color:var(--surface-2)] ${
                      isPicked ? "bg-[color:var(--brand-soft)]" : ""
                    }`}
                  >
                    <span className="font-bold truncate">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="text-[10px] text-[color:var(--text-4)] uppercase tracking-[0.08em]">
                      {p.email ? "✉" : ""}
                      {p.cell ? " ☎" : ""}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Send panel */}
        <div className="rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-4 flex flex-col gap-3">
          <div className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
            Send Mode
          </div>
          <div className="flex gap-1 rounded-[var(--r-md)] bg-[color:var(--surface-2)] p-1">
            {(["single", "group", "fcfs"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  if (m === "single") setPicked(new Set());
                }}
                className={`flex-1 h-8 rounded text-[11px] font-bold tracking-[0.06em] uppercase ${
                  mode === m
                    ? "bg-[color:var(--brand)] text-white"
                    : "text-[color:var(--text-2)] hover:text-[color:var(--text)]"
                }`}
              >
                {m === "fcfs" ? "FCFS" : m}
              </button>
            ))}
          </div>
          <p className="text-[11.5px] text-[color:var(--text-3)] leading-snug">
            {mode === "single"
              ? "Pick one player. Click Send."
              : mode === "group"
                ? "Pick a hand-picked group. Each gets their own invite."
                : "Blast every eligible league member. Seats awarded in order players accept."}
          </p>

          <div className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)] mt-2">
            Expiry (min)
          </div>
          <input
            type="number"
            min={15}
            max={1440}
            value={expiryOverride}
            onChange={(e) => setExpiryOverride(Math.max(15, Math.min(1440, Number(e.target.value) || 0)))}
            className="w-full h-9 px-3 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] text-[13px] num font-[family-name:var(--mono)] outline-none"
          />

          <div className="text-[11px] text-[color:var(--text-3)] mt-1">
            {mode === "fcfs"
              ? `Will invite all eligible league members.`
              : `${picked.size} selected.`}
          </div>

          <button
            type="button"
            onClick={send}
            disabled={pending || (mode !== "fcfs" && picked.size === 0)}
            className="h-10 mt-2 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending
              ? "Sending…"
              : mode === "fcfs"
                ? "Send FCFS to all"
                : `Send ${picked.size > 1 ? "group" : "invite"}`}
          </button>

          {error && (
            <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Active invites */}
        <div className="rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] flex flex-col min-h-[320px]">
          <div className="px-4 py-3 border-b border-[color:var(--hairline)]">
            <div className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
              In Flight · {activeInvites.length}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[420px]">
            {activeInvites.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-[color:var(--text-3)]">
                No invites in flight.
              </div>
            ) : (
              activeInvites.map((inv) => {
                const tone = STATE_TONE[inv.state];
                return (
                  <div
                    key={inv.id}
                    className="px-4 py-3 border-t border-[color:var(--hairline)] first:border-t-0 flex items-center justify-between gap-2"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-[13px] truncate">
                        {inv.player.firstName} {inv.player.lastName}
                      </span>
                      <span className="text-[10.5px] text-[color:var(--text-3)] flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.08em] ${tone.cls}`}
                        >
                          {tone.label}
                        </span>
                        <span>{fmtCountdown(inv.expiresAt)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => onExtend(inv.id)}
                        disabled={pending || (inv.extendedCount ?? 0) >= 1}
                        title={(inv.extendedCount ?? 0) >= 1 ? "Already extended" : "Extend"}
                        className="h-7 px-2 rounded text-[10px] font-bold uppercase tracking-[0.06em] border border-[color:var(--hairline-2)] hover:bg-[color:var(--surface-2)] disabled:opacity-40"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => onResend(inv.id)}
                        disabled={pending}
                        className="h-7 px-2 rounded text-[10px] font-bold uppercase tracking-[0.06em] border border-[color:var(--hairline-2)] hover:bg-[color:var(--surface-2)]"
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        onClick={() => onCancel(inv.id)}
                        disabled={pending}
                        className="h-7 px-2 rounded text-[10px] font-bold uppercase tracking-[0.06em] text-[color:var(--down)] hover:bg-[color:var(--down-soft)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* History */}
      {(finalInvites.length > 0 || initialActivity.length > 0) && (
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <div className="rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
            <div className="px-4 py-3 text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)] border-b border-[color:var(--hairline)]">
              Recent Outcomes · {finalInvites.length}
            </div>
            {finalInvites.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-[color:var(--text-3)]">
                None yet.
              </div>
            ) : (
              finalInvites.slice(0, 12).map((inv) => {
                const tone = STATE_TONE[inv.state];
                return (
                  <div
                    key={inv.id}
                    className="px-4 py-2.5 border-t border-[color:var(--hairline)] first:border-t-0 flex items-center justify-between gap-2 text-[13px]"
                  >
                    <span className="font-bold truncate">
                      {inv.player.firstName} {inv.player.lastName}
                    </span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.08em] ${tone.cls}`}
                    >
                      {tone.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
            <div className="px-4 py-3 text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)] border-b border-[color:var(--hairline)]">
              Activity
            </div>
            <div className="max-h-[340px] overflow-y-auto">
              {initialActivity.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-[color:var(--text-3)]">
                  No events yet.
                </div>
              ) : (
                initialActivity.slice(0, 30).map((e) => (
                  <div
                    key={e.id}
                    className="px-4 py-2 border-t border-[color:var(--hairline)] first:border-t-0 text-[12px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {e.player.firstName} {e.player.lastName}
                      </span>
                      <span className="text-[10px] text-[color:var(--text-4)] uppercase tracking-[0.08em]">
                        {e.type.replace(/^[a-z]+\./, "").replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-[color:var(--text-3)] mt-0.5">
                      {new Date(e.createdAt).toLocaleString()}
                      {e.note ? ` · ${e.note}` : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
