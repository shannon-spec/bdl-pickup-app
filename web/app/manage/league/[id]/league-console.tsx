"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, AlertTriangle, Check } from "lucide-react";
import { LeagueAvatar } from "@/components/bdl/league-avatar";
import {
  generateLeagueSchedule,
  clearLeagueSchedule,
} from "@/lib/actions/league";
import type { ManageLeague } from "@/lib/queries/organize";

const TABS = ["Overview", "Schedule", "Members", "Settings"] as const;
type Tab = (typeof TABS)[number];
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function initials(name: string) {
  return (
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() ||
    "•"
  );
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LeagueConsole({ lg }: { lg: ManageLeague }) {
  const [tab, setTab] = useState<Tab>(lg.slots.length ? "Schedule" : "Overview");

  const cadence = (lg.days ?? []).map((d) => DAY[d]).join(" · ") || "Not set";
  const time = lg.startTime ? lg.startTime.slice(0, 5) : "—";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <LeagueAvatar
          kind={lg.avatarKind}
          color={lg.avatarColor}
          emoji={lg.avatarEmoji}
          abbr={initials(lg.name)}
          size={44}
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-[-0.02em] truncate">
            {lg.name}
          </h1>
          <div className="text-[12.5px] text-[color:var(--text-3)]">
            {cadence} · {time} ·{" "}
            {lg.playStyle === "FIXED_TEAMS" ? "Fixed teams" : "Pickup"}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-[color:var(--hairline)] -mb-px overflow-x-auto">
        {TABS.map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setTab(x)}
            className={`px-3.5 py-2.5 text-[13px] font-bold whitespace-nowrap border-b-2 transition-colors ${
              tab === x
                ? "border-[color:var(--brand)] text-[color:var(--text)]"
                : "border-transparent text-[color:var(--text-3)] hover:text-[color:var(--text)]"
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      {tab === "Overview" && <Overview lg={lg} cadence={cadence} time={time} />}
      {tab === "Schedule" && <Schedule lg={lg} />}
      {tab === "Members" && <Members lg={lg} />}
      {tab === "Settings" && <Settings lg={lg} cadence={cadence} time={time} />}
    </div>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-[14px] bg-[color:var(--surface-2)] p-3.5">
      <div className="text-[22px] font-extrabold tracking-[-0.02em]">{value}</div>
      <div className="text-[11px] text-[color:var(--text-3)] mt-0.5">{label}</div>
    </div>
  );
}

function Overview({
  lg,
  cadence,
  time,
}: {
  lg: ManageLeague;
  cadence: string;
  time: string;
}) {
  const next = lg.slots.find((s) => new Date(s.startsAt) >= new Date());
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2.5">
        <Stat value={lg.members.length} label="Members" />
        <Stat value={lg.slots.length} label="Scheduled nights" />
        <Stat value={lg.seasonLength ?? "—"} label="Season weeks" />
      </div>
      <div className="rounded-[12px] bg-[color:var(--surface-2)] p-3.5 text-[13px]">
        <span className="text-[color:var(--text-3)]">Next night: </span>
        <span className="font-semibold">
          {next ? fmtDateTime(next.startsAt) : "None scheduled"}
        </span>
        <div className="text-[12px] text-[color:var(--text-3)] mt-1">
          {cadence} at {time}
        </div>
      </div>
    </div>
  );
}

function Schedule({ lg }: { lg: ManageLeague }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(
    lg.startDate ?? new Date().toISOString().slice(0, 10),
  );
  const [weeks, setWeeks] = useState(String(lg.seasonLength ?? 8));

  const conflicts = useMemo(() => {
    const seen = new Map<string, number>();
    for (const s of lg.slots) {
      const k = `${s.startsAt}|${s.court ?? ""}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    return [...seen.values()].filter((c) => c > 1).length;
  }, [lg.slots]);

  const gen = () =>
    start(async () => {
      setError(null);
      const res = await generateLeagueSchedule(lg.id, {
        startDate,
        weeks: Number(weeks) || undefined,
      });
      if (!res.ok) return setError(res.error);
      router.refresh();
    });

  const clear = () =>
    start(async () => {
      await clearLeagueSchedule(lg.id);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[14px] bg-[color:var(--surface-2)] p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-3)]">
              Season start
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-3 text-[14px]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-3)]">
              Weeks
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={weeks}
              onChange={(e) => setWeeks(e.target.value)}
              className="h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-3 text-[14px]"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={gen}
            disabled={pending}
            className="h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white text-[12px] font-bold uppercase tracking-[0.04em] inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <CalendarDays size={15} />
            {lg.slots.length ? "Regenerate" : "Generate schedule"}
          </button>
          {lg.slots.length > 0 && (
            <button
              type="button"
              onClick={clear}
              disabled={pending}
              className="h-10 px-3 rounded-[var(--r-lg)] text-[12px] font-semibold text-[color:var(--text-3)] hover:text-[color:var(--down)] disabled:opacity-60"
            >
              Clear
            </button>
          )}
        </div>
        {error && <div className="text-[12px] text-[color:var(--down)]">{error}</div>}
      </div>

      {lg.slots.length === 0 ? (
        <p className="text-[13px] text-[color:var(--text-3)]">
          No nights scheduled yet. Generate from the league cadence above.
        </p>
      ) : (
        <>
          <div
            className={`inline-flex items-center gap-1.5 self-start h-7 px-3 rounded-full text-[11px] font-bold ${
              conflicts
                ? "bg-[color:var(--warn-soft)] text-[color:var(--warn)]"
                : "bg-[color:var(--up-soft)] text-[color:var(--up)]"
            }`}
          >
            {conflicts ? <AlertTriangle size={13} /> : <Check size={13} />}
            {conflicts
              ? `${conflicts} time conflict${conflicts > 1 ? "s" : ""}`
              : "No conflicts"}
          </div>
          <div className="flex flex-col gap-1.5">
            {lg.slots.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-[10px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-3 py-2.5"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[color:var(--surface-2)] text-[11px] font-bold text-[color:var(--text-3)] shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 text-[13.5px] font-semibold truncate">
                  {fmtDateTime(s.startsAt)}
                </span>
                {s.court && (
                  <span className="text-[12px] text-[color:var(--text-3)] truncate">
                    {s.court}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Members({ lg }: { lg: ManageLeague }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-3)] mb-2">
          Commissioners ({lg.commissioners.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {lg.commissioners.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center h-7 px-3 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] text-[12.5px] font-semibold"
            >
              {m.name}
            </span>
          ))}
          {lg.commissioners.length === 0 && (
            <span className="text-[13px] text-[color:var(--text-3)]">None</span>
          )}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-3)] mb-2">
          Players ({lg.members.length})
        </p>
        {lg.members.length === 0 ? (
          <p className="text-[13px] text-[color:var(--text-3)]">
            No players yet. Add players from the league page.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {lg.members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center h-7 px-3 rounded-full bg-[color:var(--surface-2)] text-[12.5px] font-medium"
              >
                {m.name}
              </span>
            ))}
          </div>
        )}
        <Link
          href={`/leagues/${lg.id}`}
          className="inline-block mt-3 text-[13px] font-semibold text-[color:var(--brand)] hover:underline"
        >
          Manage roster on the league page →
        </Link>
      </div>
    </div>
  );
}

function Settings({
  lg,
  cadence,
  time,
}: {
  lg: ManageLeague;
  cadence: string;
  time: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[12px] bg-[color:var(--surface-2)] p-4 flex flex-col gap-1.5 text-[13.5px]">
        <Row k="Cadence" v={`${cadence} at ${time}`} />
        <Row
          k="Play style"
          v={lg.playStyle === "FIXED_TEAMS" ? "Fixed teams" : "Pickup — auto-balanced"}
        />
        <Row k="Season" v={lg.seasonLength ? `${lg.seasonLength} weeks` : "—"} />
        <Row k="Venue" v={lg.venueName || "—"} />
        <Row k="Visibility" v={lg.published ? "Published" : "Draft"} />
      </div>
      <Link
        href={`/leagues/${lg.id}`}
        className="text-[13px] font-semibold text-[color:var(--brand)] hover:underline"
      >
        Open public league page →
      </Link>
      <p className="text-[12.5px] text-[color:var(--text-3)]">
        Editing cadence, divisions, and standings tools are coming next.
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[color:var(--text-3)]">{k}</span>
      <span className="font-semibold text-right">{v}</span>
    </div>
  );
}
