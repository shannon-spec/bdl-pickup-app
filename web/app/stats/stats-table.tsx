"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { StatLine } from "@/lib/queries/player-stats";

type ColKey = keyof StatLine;
type SortKey = ColKey | "name";
const COLS: { key: ColKey; label: string; pct?: boolean }[] = [
  { key: "gp", label: "GP" },
  { key: "ppg", label: "PPG" },
  { key: "rpg", label: "RPG" },
  { key: "apg", label: "APG" },
  { key: "spg", label: "SPG" },
  { key: "bpg", label: "BPG" },
  { key: "fgPct", label: "FG%", pct: true },
  { key: "tpPct", label: "3P%", pct: true },
  { key: "ftPct", label: "FT%", pct: true },
  { key: "power", label: "BDL" },
];

const fmt = (v: number | null, pct?: boolean) => {
  if (v === null || v === undefined) return "—";
  if (pct) return `${Math.round(v)}%`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

export function StatsTable({
  rows,
  meId,
}: {
  rows: StatLine[];
  meId: string | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("power");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  // Category leaders → award badges by the player's name.
  const maxOf = (sel: (r: StatLine) => number | null) => {
    let m = -Infinity;
    for (const r of rows) {
      const v = sel(r);
      if (v !== null && v > m) m = v;
    }
    return m;
  };
  const leaders = {
    ppg: maxOf((r) => r.ppg),
    rpg: maxOf((r) => r.rpg),
    apg: maxOf((r) => r.apg),
    spg: maxOf((r) => r.spg),
    tp: maxOf((r) => r.tpPct),
  };
  const eq = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const awardsFor = (p: StatLine): { emoji: string; title: string }[] => {
    const a: { emoji: string; title: string }[] = [];
    if (p.ppg > 0 && eq(p.ppg, leaders.ppg)) a.push({ emoji: "🏀", title: "Leading scorer" });
    if (p.rpg > 0 && eq(p.rpg, leaders.rpg)) a.push({ emoji: "💪", title: "Leading rebounder" });
    if (p.apg > 0 && eq(p.apg, leaders.apg)) a.push({ emoji: "🎯", title: "Leading assists" });
    if (p.spg > 0 && eq(p.spg, leaders.spg)) a.push({ emoji: "🧤", title: "Leading steals" });
    if (p.tpPct !== null && leaders.tp > -Infinity && eq(p.tpPct, leaders.tp))
      a.push({ emoji: "🏹", title: "Leading 3PT %" });
    if (p.ppg >= 10 && p.rpg >= 10 && p.apg >= 10)
      a.push({ emoji: "💎", title: "Triple-double average" });
    return a;
  };

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      // Names default A→Z; stat columns default high→low.
      setDir(key === "name" ? "asc" : "desc");
    }
  };

  const sorted = [...rows].sort((a, b) => {
    let cmp: number;
    if (sortKey === "name") {
      cmp = `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
      );
    } else {
      const av = a[sortKey as ColKey];
      const bv = b[sortKey as ColKey];
      const an = typeof av === "number" ? av : -Infinity;
      const bn = typeof bv === "number" ? bv : -Infinity;
      cmp = an - bn;
    }
    return dir === "asc" ? cmp : -cmp;
  });

  const arrow = (active: boolean) =>
    !active ? null : dir === "desc" ? (
      <ChevronDown size={12} className="inline -mt-0.5" />
    ) : (
      <ChevronUp size={12} className="inline -mt-0.5" />
    );

  const headCls = (active: boolean) =>
    `cursor-pointer select-none transition-colors ${
      active ? "text-[color:var(--brand-ink)]" : "hover:text-[color:var(--text)]"
    }`;

  return (
    <div className="overflow-x-auto rounded-[16px] bg-[color:var(--surface)] shadow-[inset_0_0_0_1px_var(--hairline-2)]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10px] font-bold tracking-[0.08em] uppercase text-[color:var(--text-3)]">
            <th
              onClick={() => onSort("name")}
              className={`sticky left-0 z-10 bg-[color:var(--surface)] text-left px-4 py-2.5 min-w-[170px] ${headCls(
                sortKey === "name",
              )}`}
            >
              Player {arrow(sortKey === "name")}
            </th>
            {COLS.map((c) => (
              <th
                key={c.key}
                onClick={() => onSort(c.key)}
                className={`px-3 py-2.5 text-center whitespace-nowrap ${headCls(
                  sortKey === c.key,
                )}`}
              >
                {c.label} {arrow(sortKey === c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const isMe = p.id === meId;
            return (
              <tr
                key={p.id}
                className={`shadow-[inset_0_-1px_0_0_var(--hairline)] ${
                  isMe ? "bg-[color:var(--brand-soft)]" : ""
                }`}
              >
                <td
                  className={`sticky left-0 z-10 px-4 py-2 min-w-[170px] ${
                    isMe ? "bg-[color:var(--brand-soft)]" : "bg-[color:var(--surface)]"
                  }`}
                >
                  <Link
                    href={`/players/${p.id}`}
                    className="flex items-center gap-2 hover:text-[color:var(--brand)]"
                  >
                    <span className="text-[color:var(--text-4)] font-[family-name:var(--mono)] text-[11px] num w-5 text-right shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex flex-col leading-tight min-w-0">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-[13.5px]">
                          {p.firstName} {p.lastName}
                        </span>
                        {awardsFor(p).map((aw) => (
                          <span
                            key={aw.title}
                            title={aw.title}
                            aria-label={aw.title}
                            className="text-[14px] leading-none"
                          >
                            {aw.emoji}
                          </span>
                        ))}
                      </span>
                      {p.team && (
                        <span className="text-[10.5px] uppercase tracking-[0.06em] text-[color:var(--text-4)] truncate">
                          {p.team}
                        </span>
                      )}
                    </span>
                  </Link>
                </td>
                {COLS.map((c) => {
                  const v = p[c.key] as number | null;
                  const headline = c.key === sortKey;
                  return (
                    <td
                      key={c.key}
                      className={`px-3 py-2 text-center text-[13px] num font-[family-name:var(--mono)] ${
                        headline
                          ? "font-extrabold text-[color:var(--brand-ink)]"
                          : "text-[color:var(--text-2)]"
                      }`}
                    >
                      {fmt(v, c.pct)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
