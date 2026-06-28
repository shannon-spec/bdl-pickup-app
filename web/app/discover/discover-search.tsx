"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, X, Check, Clock } from "lucide-react";
import { LeagueAvatar } from "@/components/bdl/league-avatar";
import { requestToJoin, getContextPlayers } from "@/lib/actions/join";

export type JoinStatus = "pending" | "accepted" | "denied" | "hold";

export type DiscoverItem = {
  type: "league" | "team";
  id: string;
  name: string;
  location: string;
  avatarKind: string;
  avatarColor: string;
  avatarEmoji: string | null;
  href: string;
  role?: string;
  status?: JoinStatus | null;
  visibility?: "OPEN" | "CLOSED" | "PRIVATE";
};

function VisibilityPill({ v }: { v: "OPEN" | "CLOSED" | "PRIVATE" }) {
  const map = {
    OPEN: { label: "Open", cls: "bg-[color:var(--up-soft)] text-[color:var(--up)]" },
    CLOSED: { label: "Closed", cls: "bg-[color:var(--warn-soft)] text-[color:var(--warn)]" },
    PRIVATE: { label: "Private", cls: "bg-[color:var(--surface-2)] text-[color:var(--text-3)]" },
  }[v];
  return (
    <span className={`shrink-0 inline-flex items-center h-6 px-2.5 rounded-full text-[10.5px] font-bold uppercase tracking-[0.06em] ${map.cls}`}>
      {map.label}
    </span>
  );
}

function initials(name: string) {
  return (
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() ||
    "•"
  );
}

/** Row used for "your" leagues/teams — links through, shows role. */
export function DiscoverRow({ item }: { item: DiscoverItem }) {
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3.5 rounded-[14px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] px-3.5 py-3 hover:bg-[color:var(--surface-2)] transition-colors"
    >
      <LeagueAvatar kind={item.avatarKind} color={item.avatarColor} emoji={item.avatarEmoji} abbr={initials(item.name)} size={40} />
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-[15px] tracking-[-0.01em] truncate">{item.name}</span>
        <span className="block text-[12px] text-[color:var(--text-3)] truncate mt-0.5">
          {item.location || (item.type === "league" ? "League" : "Team")}
        </span>
      </span>
      {item.role && (
        <span className="shrink-0 inline-flex items-center h-6 px-2.5 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] text-[10.5px] font-bold uppercase tracking-[0.06em]">
          {item.role}
        </span>
      )}
      <ChevronRight size={18} className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)] shrink-0" />
    </Link>
  );
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "league", label: "Leagues" },
  { key: "team", label: "Teams" },
] as const;

export function DiscoverSearch({
  items,
  profileChips,
  signedIn,
}: {
  items: DiscoverItem[];
  profileChips: string[];
  signedIn: boolean;
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "league" | "team">("all");
  const [active, setActive] = useState<DiscoverItem | null>(null);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (tab === "all" || i.type === tab) &&
        (n === "" || i.name.toLowerCase().includes(n) || i.location.toLowerCase().includes(n)),
    );
  }, [items, q, tab]);
  const shown = filtered.slice(0, 60);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-3)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search leagues & teams by name or location"
          className="h-11 w-full rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] pl-9 pr-3 text-[15px] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]"
        />
      </div>

      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setTab(f.key)}
            className={`h-8 px-3.5 rounded-full text-[12px] font-semibold transition-colors ${
              tab === f.key
                ? "bg-[color:var(--brand)] text-white"
                : "bg-[color:var(--surface-2)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[14px] bg-[color:var(--surface-2)] p-8 text-center text-[13px] text-[color:var(--text-3)]">
          {q ? `No matches for “${q}”.` : "Nothing to browse yet."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((i) => (
            <RequestRow
              key={`${i.type}:${i.id}`}
              item={i}
              signedIn={signedIn}
              onRequest={() => setActive(i)}
            />
          ))}
        </div>
      )}
      {filtered.length > shown.length && (
        <p className="text-[12px] text-[color:var(--text-3)] text-center">
          Showing {shown.length} of {filtered.length} — refine your search.
        </p>
      )}

      {active && (
        <RequestDialog
          item={active}
          profileChips={profileChips}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function RequestRow({
  item,
  signedIn,
  onRequest,
}: {
  item: DiscoverItem;
  signedIn: boolean;
  onRequest: () => void;
}) {
  const st = item.status;
  const vis = item.visibility ?? "OPEN";
  const isPrivate = vis === "PRIVATE";
  const inner = (
    <>
      <LeagueAvatar kind={item.avatarKind} color={item.avatarColor} emoji={item.avatarEmoji} abbr={initials(item.name)} size={40} />
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-[15px] tracking-[-0.01em] truncate">{item.name}</span>
        <span className="block text-[12px] text-[color:var(--text-3)] truncate mt-0.5">
          {item.location || (item.type === "league" ? "League" : "Team")}
        </span>
      </span>
    </>
  );
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] px-3.5 py-3">
      {isPrivate ? (
        <div className="flex items-center gap-3.5 flex-1 min-w-0">{inner}</div>
      ) : (
        <Link href={item.href} className="flex items-center gap-3.5 flex-1 min-w-0 hover:opacity-90">
          {inner}
        </Link>
      )}
      <VisibilityPill v={vis} />
      {!isPrivate &&
        (st === "pending" ? (
          <span className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[color:var(--warn-soft)] text-[color:var(--warn)] text-[11px] font-bold">
            <Clock size={12} /> Pending
          </span>
        ) : st === "hold" ? (
          <span className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[color:var(--warn-soft)] text-[color:var(--warn)] text-[11px] font-bold">
            On hold
          </span>
        ) : !signedIn ? (
          <Link
            href="/login?next=/discover"
            className="shrink-0 inline-flex items-center h-8 px-3 rounded-[var(--r-lg)] bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] text-[12px] font-bold"
          >
            Request to join
          </Link>
        ) : (
          <button
            type="button"
            onClick={onRequest}
            className="shrink-0 inline-flex items-center h-8 px-3 rounded-[var(--r-lg)] bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] text-[12px] font-bold hover:brightness-95"
          >
            {st === "denied" ? "Re-request" : "Request to join"}
          </button>
        ))}
    </div>
  );
}

function RequestDialog({
  item,
  profileChips,
  onClose,
}: {
  item: DiscoverItem;
  profileChips: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sponsors, setSponsors] = useState<{ id: string; name: string }[]>([]);
  const [sponsorId, setSponsorId] = useState("");
  const ctxType = item.type === "league" ? "LEAGUE" : "TEAM";

  useEffect(() => {
    let live = true;
    getContextPlayers(ctxType, item.id).then((list) => {
      if (live) setSponsors(list);
    });
    return () => {
      live = false;
    };
  }, [ctxType, item.id]);

  const send = () =>
    start(async () => {
      setError(null);
      const res = await requestToJoin(
        ctxType,
        item.id,
        message,
        sponsorId || null,
      );
      if (!res.ok) return setError(res.error);
      onClose();
      router.refresh();
    });

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] bg-black/40 flex items-end sm:items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-[18px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[18px] font-extrabold tracking-[-0.02em]">
              Request to join
            </h3>
            <p className="text-[12.5px] text-[color:var(--text-3)] mt-0.5">
              Sends an in-app request to {item.name}&apos;s commissioner with your
              profile.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[color:var(--text-3)] hover:text-[color:var(--text)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-[12px] border border-[color:var(--hairline-2)] p-3">
          <LeagueAvatar kind={item.avatarKind} color={item.avatarColor} emoji={item.avatarEmoji} abbr={initials(item.name)} size={36} />
          <div className="min-w-0">
            <div className="font-bold text-[14.5px] truncate">{item.name}</div>
            <div className="text-[12px] text-[color:var(--text-3)] truncate">
              {item.location || (item.type === "league" ? "League" : "Team")}
            </div>
          </div>
        </div>

        {profileChips.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-3)] mb-1.5">
              Profile shared
            </p>
            <div className="flex flex-wrap gap-1.5">
              {profileChips.map((c) => (
                <span key={c} className="inline-flex items-center h-7 px-2.5 rounded-full bg-[color:var(--surface-2)] text-[12px] font-medium">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {sponsors.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-3)]">
              Player sponsor (optional)
            </span>
            <select
              value={sponsorId}
              onChange={(e) => setSponsorId(e.target.value)}
              className="h-11 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none focus:border-[color:var(--brand)]"
            >
              <option value="">No sponsor</option>
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-[color:var(--text-3)]">
              A current member who&apos;ll vouch for you. They confirm before the
              commissioner sees it.
            </span>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-3)]">
            Message (optional)
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Hi — I'd love to join. I play guard and can make most weeknights."
            className="rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 py-2 text-[14px] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)] resize-none"
          />
        </label>

        {error && (
          <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="h-12 rounded-[12px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.04em] uppercase inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Check size={16} />
          {pending ? "Sending…" : "Send join request"}
        </button>
      </div>
    </div>
  );
}
