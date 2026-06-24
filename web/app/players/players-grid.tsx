"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, LayoutGrid, List, Search } from "lucide-react";
import { Pill } from "@/components/bdl/pill";
import { GradePill } from "@/components/bdl/grade-pill-color";
import type { DirectoryPlayer } from "@/lib/queries/players-directory";
import type { GradeKey } from "@/lib/queries/player-grades";

type DirectoryPlayerWithGrade = DirectoryPlayer & {
  displayGrade: GradeKey | null;
};

type ViewMode = "grid" | "list";

export function PlayersGrid({
  players,
}: {
  players: DirectoryPlayerWithGrade[];
}) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewMode>("grid");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return players;
    return players.filter((p) => {
      const full = `${p.firstName} ${p.lastName}`.toLowerCase();
      return (
        full.includes(ql) ||
        p.firstName.toLowerCase().includes(ql) ||
        p.lastName.toLowerCase().includes(ql) ||
        (p.email ?? "").toLowerCase().includes(ql) ||
        (p.city ?? "").toLowerCase().includes(ql) ||
        (p.position ?? "").toLowerCase().includes(ql) ||
        p.leagueNames.some((n) => n.toLowerCase().includes(ql))
      );
    });
  }, [players, q]);

  return (
    <>
      <div className="flex items-center gap-3 max-sm:flex-col max-sm:items-stretch">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-4)]"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, city…"
            className="w-full h-11 pl-9 pr-3 rounded-[var(--r-lg)] bg-[color:var(--surface)] text-[14px] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)] transition-shadow"
          />
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[16px] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px] shadow-[inset_0_0_0_1px_var(--hairline-2)]">
          {players.length === 0 ? "No players to show." : "No matches."}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-2 max-sm:grid-cols-1">
          {filtered.map((p) => (
            <PlayerCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] bg-[color:var(--surface)] overflow-hidden shadow-[inset_0_0_0_1px_var(--hairline-2)]">
          {filtered.map((p) => (
            <PlayerRow key={p.id} p={p} />
          ))}
        </div>
      )}
    </>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const opts: [ViewMode, typeof LayoutGrid, string][] = [
    ["grid", LayoutGrid, "Grid"],
    ["list", List, "List"],
  ];
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-[var(--r-lg)] bg-[color:var(--surface-2)] flex-shrink-0 max-sm:self-end">
      {opts.map(([key, Icon, label]) => {
        const active = view === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(key)}
            className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] text-[12px] font-bold tracking-[0.04em] uppercase transition-colors ${
              active
                ? "bg-[color:var(--brand)] text-white"
                : "text-[color:var(--text-2)] hover:text-[color:var(--text)]"
            }`}
          >
            <Icon size={14} strokeWidth={2.25} /> {label}
          </button>
        );
      })}
    </div>
  );
}

/** Brand-blue avatar — uploaded headshot when set, else initials disc. */
function Avatar({
  url,
  initials,
  size,
}: {
  url: string | null;
  initials: string;
  size: number;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        aria-hidden
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full bg-[color:var(--brand)] text-white font-extrabold flex-shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials}
    </span>
  );
}

function initialsOf(p: DirectoryPlayerWithGrade) {
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
}

function PlayerCard({ p }: { p: DirectoryPlayerWithGrade }) {
  return (
    <Link
      href={`/players/${p.id}`}
      className="group flex items-center gap-3 rounded-[14px] bg-[color:var(--surface)] px-4 py-3 transition-shadow hover:shadow-[inset_0_0_0_1.5px_var(--brand)] focus-visible:shadow-[inset_0_0_0_1.5px_var(--brand)] focus-visible:outline-none"
    >
      <Avatar url={p.avatarUrl} initials={initialsOf(p)} size={40} />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-bold text-[14px] truncate group-hover:text-[color:var(--brand)]">
          {p.firstName} {p.lastName}
        </span>
        <span className="text-[11.5px] text-[color:var(--text-3)] truncate">
          {p.position ? `${p.position} · ` : ""}
          {p.leagueNames.length > 0 ? p.leagueNames.join(", ") : "No league"}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {p.displayGrade && <GradePill grade={p.displayGrade} />}
        {p.status !== "Active" && (
          <Pill tone={p.status === "IR" ? "loss" : "neutral"}>{p.status}</Pill>
        )}
        <ChevronRight
          size={14}
          className="text-[color:var(--text-4)] group-hover:text-[color:var(--brand)] transition-colors"
        />
      </div>
    </Link>
  );
}

function PlayerRow({ p }: { p: DirectoryPlayerWithGrade }) {
  return (
    <Link
      href={`/players/${p.id}`}
      className="group flex items-center gap-3 px-4 h-[52px] transition-colors hover:bg-[color:var(--brand-soft)] focus-visible:bg-[color:var(--brand-soft)] focus-visible:outline-none [&:not(:first-child)]:shadow-[inset_0_1px_0_0_var(--hairline)]"
    >
      <Avatar url={p.avatarUrl} initials={initialsOf(p)} size={34} />
      <span className="flex-1 min-w-0 font-bold text-[14px] truncate group-hover:text-[color:var(--brand)]">
        {p.firstName} {p.lastName}
      </span>
      <span className="flex-shrink-0 w-8 text-center text-[12px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
        {p.position || "—"}
      </span>
      <span className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
        {p.displayGrade && <GradePill grade={p.displayGrade} />}
        {p.status !== "Active" && (
          <Pill tone={p.status === "IR" ? "loss" : "neutral"}>{p.status}</Pill>
        )}
      </span>
      <ChevronRight
        size={15}
        className="flex-shrink-0 text-[color:var(--text-4)] group-hover:text-[color:var(--brand)] transition-colors"
      />
    </Link>
  );
}
