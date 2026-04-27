"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Mail, MessageSquare } from "lucide-react";
import {
  cancelInvite,
  createInvites,
  extendInvite,
  resendInvite,
  bulkCancelGameInvites,
} from "@/lib/actions/game-invites";
import type {
  ActivityRow,
  InviteRow,
  InviteSettings,
  PoolPlayer,
} from "@/lib/queries/game-invites";

type Mode = "single" | "group" | "fcfs";
type Channel = "email" | "sms";

export type InviteGameContext = {
  leagueName: string;
  dateLabel: string; // pre-formatted: "Mon · Apr 27 · 5:30 AM"
  venue: string | null;
};

const AVAIL_TAG: Record<
  PoolPlayer["availability"],
  { label: string; cls: string } | null
> = {
  available: null,
  roster_a: {
    label: "On Team A",
    cls: "bg-[rgba(170,178,192,.22)] text-[color:var(--text-2)]",
  },
  roster_b: {
    label: "On Team B",
    cls: "bg-[rgba(212,175,55,.22)] text-[color:var(--text-2)]",
  },
  roster_invited: {
    label: "Invited (roster)",
    cls: "bg-[color:var(--surface-2)] text-[color:var(--text-3)]",
  },
  pending: {
    label: "Pending invite",
    cls: "bg-[color:var(--warn-soft)] text-[color:var(--warn)]",
  },
};

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

const buildDefaultMessage = (game: InviteGameContext) => {
  const venueLine = game.venue ? ` at ${game.venue}` : "";
  return `Hi {firstName},\n\nYou're invited to ${game.leagueName} — ${game.dateLabel}${venueLine}.\n\nTap the link to claim your seat or pass. Invite expires {expires}.\n\n— BDL`;
};

export function InviteManager({
  gameId,
  initialInvites,
  initialPool,
  initialActivity,
  settings,
  game,
}: {
  gameId: string;
  initialInvites: InviteRow[];
  initialPool: PoolPlayer[];
  initialActivity: ActivityRow[];
  settings: InviteSettings;
  game: InviteGameContext;
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
  const [channels, setChannels] = useState<Set<Channel>>(new Set(["email"]));
  const [compose, setCompose] = useState<null | { message: string }>(null);

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

  const toggleChannel = (c: Channel) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      // Don't allow both off — re-add the one that was just toggled.
      if (next.size === 0) next.add(c);
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

  const availableCount = useMemo(
    () => initialPool.filter((p) => p.availability === "available").length,
    [initialPool],
  );

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

  // Warn if SMS is selected but any picked recipient has no cell on file.
  const smsMissing = useMemo(() => {
    if (!channels.has("sms")) return [] as PoolPlayer[];
    if (mode === "fcfs") return [];
    return Array.from(picked)
      .map((id) => initialPool.find((p) => p.id === id))
      .filter((p): p is PoolPlayer => !!p && !p.cell);
  }, [channels, mode, picked, initialPool]);

  const openCompose = () => {
    setError(null);
    if (mode !== "fcfs" && picked.size === 0) {
      setError("Pick at least one player.");
      return;
    }
    setCompose({ message: buildDefaultMessage(game) });
  };

  // Reset compose textarea if the user toggles channels / mode mid-flow.
  useEffect(() => {
    if (!compose) return;
    // No-op: keep the user's edits unless they reset manually.
  }, [compose]);

  const confirmSend = () => {
    if (!compose) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.append("gameId", gameId);
      fd.append("mode", mode);
      fd.append("channels", Array.from(channels).join(","));
      fd.append("expiryMinutesOverride", String(expiryOverride));
      fd.append("customMessage", compose.message);
      if (mode !== "fcfs") {
        fd.append("playerIds", Array.from(picked).join(","));
      }
      const res = await createInvites(fd);
      if (res.ok) {
        setPicked(new Set());
        setCompose(null);
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
            <div className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)] mb-2 flex items-center gap-2 flex-wrap">
              <span>League · {initialPool.length}</span>
              <span className="text-[color:var(--text-4)]">·</span>
              <span>{availableCount} available</span>
              {picked.size > 0 && (
                <span className="ml-1 text-[color:var(--up)]">
                  · {picked.size} selected
                </span>
              )}
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
                No league members match.
              </div>
            ) : (
              filteredPool.map((p) => {
                const isPicked = picked.has(p.id);
                const disabled = p.availability !== "available";
                const tag = AVAIL_TAG[p.availability];
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabled}
                    onClick={(e) =>
                      !disabled &&
                      togglePick(
                        p.id,
                        mode === "group" || e.shiftKey || e.metaKey,
                      )
                    }
                    aria-pressed={isPicked}
                    title={tag ? `Unavailable: ${tag.label}` : undefined}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 border-t border-[color:var(--hairline)] first:border-t-0 text-left text-[13px] transition-colors ${
                      isPicked
                        ? "bg-[color:var(--up-soft)]"
                        : disabled
                          ? "opacity-55 cursor-not-allowed"
                          : "hover:bg-[color:var(--surface-2)]"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-full border flex-shrink-0 transition-colors ${
                          isPicked
                            ? "bg-[color:var(--up)] border-[color:var(--up)] text-white"
                            : "border-[color:var(--hairline-2)] text-transparent"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span className="font-bold truncate">
                        {p.firstName} {p.lastName}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 flex-shrink-0">
                      {tag && (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.08em] ${tag.cls}`}
                        >
                          {tag.label}
                        </span>
                      )}
                      <span className="text-[10px] text-[color:var(--text-4)] uppercase tracking-[0.08em] flex items-center gap-1">
                        {p.email && <Mail size={11} />}
                        {p.cell && <MessageSquare size={11} />}
                      </span>
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
            Channel
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => toggleChannel("email")}
              className={`flex-1 h-9 rounded-[var(--r-md)] border text-[11.5px] font-bold tracking-[0.06em] uppercase inline-flex items-center justify-center gap-1.5 transition-colors ${
                channels.has("email")
                  ? "bg-[color:var(--brand-soft)] border-[color:var(--brand)] text-[color:var(--brand)]"
                  : "border-[color:var(--hairline-2)] text-[color:var(--text-3)] hover:text-[color:var(--text-2)]"
              }`}
            >
              <Mail size={13} /> Email
            </button>
            <button
              type="button"
              onClick={() => toggleChannel("sms")}
              className={`flex-1 h-9 rounded-[var(--r-md)] border text-[11.5px] font-bold tracking-[0.06em] uppercase inline-flex items-center justify-center gap-1.5 transition-colors ${
                channels.has("sms")
                  ? "bg-[color:var(--brand-soft)] border-[color:var(--brand)] text-[color:var(--brand)]"
                  : "border-[color:var(--hairline-2)] text-[color:var(--text-3)] hover:text-[color:var(--text-2)]"
              }`}
            >
              <MessageSquare size={13} /> Text
            </button>
          </div>
          {channels.has("sms") && (
            <p className="text-[11px] text-[color:var(--text-3)] leading-snug">
              SMS dispatch is logged but not yet sent over Twilio. Recipients
              must have a cell on file.
            </p>
          )}
          {smsMissing.length > 0 && (
            <p className="text-[11px] text-[color:var(--warn)] bg-[color:var(--warn-soft)] rounded-[var(--r-md)] px-2.5 py-1.5">
              {smsMissing.length} selected player
              {smsMissing.length === 1 ? "" : "s"} have no cell on file — SMS
              skipped for them.
            </p>
          )}

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
            onClick={openCompose}
            disabled={pending || (mode !== "fcfs" && picked.size === 0)}
            className="h-10 mt-2 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mode === "fcfs"
              ? "Compose FCFS blast"
              : `Compose ${picked.size > 1 ? "group" : "invite"}`}
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

      {/* Compose dialog */}
      {compose && (
        <ComposeDialog
          message={compose.message}
          onMessageChange={(m) => setCompose({ message: m })}
          recipientCount={mode === "fcfs" ? availableCount : picked.size}
          mode={mode}
          channels={channels}
          pending={pending}
          onCancel={() => setCompose(null)}
          onConfirm={confirmSend}
          onReset={() => setCompose({ message: buildDefaultMessage(game) })}
          error={error}
        />
      )}
    </section>
  );
}

function ComposeDialog({
  message,
  onMessageChange,
  recipientCount,
  mode,
  channels,
  pending,
  onCancel,
  onConfirm,
  onReset,
  error,
}: {
  message: string;
  onMessageChange: (m: string) => void;
  recipientCount: number;
  mode: Mode;
  channels: Set<Channel>;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onReset: () => void;
  error: string | null;
}) {
  // Esc closes when not pending.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pending, onCancel]);

  const channelLabel = Array.from(channels)
    .map((c) => (c === "email" ? "Email" : "Text"))
    .join(" + ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.45)]">
      <div className="w-full max-w-[560px] rounded-[18px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-[color:var(--hairline)]">
          <div className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            Compose Invite
          </div>
          <div className="text-[16px] font-extrabold tracking-[-0.01em] mt-0.5">
            {mode === "fcfs"
              ? `FCFS blast · ${channelLabel}`
              : `${recipientCount} recipient${recipientCount === 1 ? "" : "s"} · ${channelLabel}`}
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-2 overflow-y-auto">
          <label className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={9}
            className="w-full px-3 py-2.5 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] text-[13.5px] leading-[1.55] outline-none focus:border-[color:var(--brand)] resize-y font-[family-name:inherit]"
          />
          <div className="text-[10.5px] text-[color:var(--text-3)] leading-snug mt-0.5">
            Tokens like <code className="bg-[color:var(--surface-2)] px-1 rounded">{"{firstName}"}</code>,{" "}
            <code className="bg-[color:var(--surface-2)] px-1 rounded">{"{expires}"}</code>, and{" "}
            <code className="bg-[color:var(--surface-2)] px-1 rounded">{"{claimUrl}"}</code> are filled in per recipient.
            The claim link is appended automatically if you remove it.
          </div>

          {error && (
            <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2 mt-1">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[color:var(--hairline)] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={pending}
            className="text-[11px] font-bold tracking-[0.06em] uppercase text-[color:var(--text-3)] hover:text-[color:var(--text-2)] disabled:opacity-50"
          >
            Reset to default
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="h-9 px-4 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-2)] text-[11.5px] font-bold tracking-[0.06em] uppercase text-[color:var(--text-2)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className="h-9 px-4 rounded-[var(--r-md)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white text-[11.5px] font-bold tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
