"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Pill } from "@/components/bdl/pill";
import { GradePill } from "@/components/bdl/grade-pill-color";
import type { DirectoryPlayer } from "@/lib/queries/players-directory";
import type { GradeKey } from "@/lib/queries/player-grades";

type DirectoryPlayerWithGrade = DirectoryPlayer & {
  displayGrade: GradeKey | null;
};

export function PlayersGrid({ players }: { players: DirectoryPlayerWithGrade[] }) {
  const [q, setQ] = useState("");

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
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-4)]"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, city…"
          className="w-full h-10 pl-9 pr-3 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[14px] outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
          {players.length === 0 ? "No players to show." : "No matches."}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-2 max-sm:grid-cols-1">
          {filtered.map((p) => (
            <PlayerCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </>
  );
}

function PlayerCard({ p }: { p: DirectoryPlayerWithGrade }) {
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
  return (
    <Link
      href={`/players/${p.id}`}
      className="group flex items-center gap-3 rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-2)] transition-colors px-4 py-3"
    >
      {p.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.avatarUrl}
          alt=""
          aria-hidden
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-extrabold text-[13px] flex-shrink-0"
          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-2))" }}
        >
          {initials}
        </span>
      )}
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
        <ChevronRight size={14} className="text-[color:var(--text-4)]" />
      </div>
    </Link>
  );
}
