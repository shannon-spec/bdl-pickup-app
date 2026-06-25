"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Check } from "lucide-react";
import { saveGameStats, type StatRowInput } from "@/lib/actions/games";

const COLUMNS = [
  { key: "minutes", label: "MIN" },
  { key: "points", label: "PTS" },
  { key: "rebounds", label: "REB" },
  { key: "assists", label: "AST" },
  { key: "steals", label: "STL" },
  { key: "blocks", label: "BLK" },
  { key: "turnovers", label: "TO" },
  { key: "fouls", label: "PF" },
  { key: "fgm", label: "FGM" },
  { key: "fga", label: "FGA" },
  { key: "tpm", label: "3PM" },
  { key: "tpa", label: "3PA" },
  { key: "ftm", label: "FTM" },
  { key: "fta", label: "FTA" },
] as const;

type StatKey = (typeof COLUMNS)[number]["key"];

export type StatPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  side: "A" | "B";
};

type Row = Record<StatKey, string>;

const emptyRow = (): Row =>
  Object.fromEntries(COLUMNS.map((c) => [c.key, ""])) as Row;

export function BoxScoreEditor({
  gameId,
  teamAName,
  teamBName,
  players,
  initial,
}: {
  gameId: string;
  teamAName: string;
  teamBName: string;
  players: StatPlayer[];
  initial: Record<string, Partial<Record<StatKey, number | null>>>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const o: Record<string, Row> = {};
    for (const p of players) {
      const r = emptyRow();
      const src = initial[p.id];
      if (src) {
        for (const c of COLUMNS) {
          const v = src[c.key];
          if (v !== null && v !== undefined) r[c.key] = String(v);
        }
      }
      o[p.id] = r;
    }
    return o;
  });

  const setCell = (pid: string, key: StatKey, value: string) => {
    setSaved(false);
    setRows((prev) => ({ ...prev, [pid]: { ...prev[pid], [key]: value } }));
  };

  const onSave = () => {
    setError(null);
    const payload: StatRowInput[] = players.map((p) => ({
      playerId: p.id,
      ...rows[p.id],
    }));
    start(async () => {
      const res = await saveGameStats(gameId, payload);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  };

  if (players.length === 0) {
    return (
      <div className="text-[13px] text-[color:var(--text-3)]">
        Add players to the rosters first, then enter their stats here.
      </div>
    );
  }

  const cellInput =
    "w-12 h-8 rounded-[8px] bg-[color:var(--surface-2)] text-center text-[13px] num font-[family-name:var(--mono)] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  const sideName = (s: "A" | "B") => (s === "A" ? teamAName : teamBName);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-[12px] bg-[color:var(--surface)] shadow-[inset_0_0_0_1px_var(--hairline)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[10px] font-bold tracking-[0.08em] uppercase text-[color:var(--text-3)]">
              <th className="sticky left-0 z-10 bg-[color:var(--surface)] text-left px-3 py-2 min-w-[150px]">
                Player
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-1.5 py-2 text-center">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.id}
                className="shadow-[inset_0_1px_0_0_var(--hairline)]"
              >
                <td className="sticky left-0 z-10 bg-[color:var(--surface)] px-3 py-1.5 min-w-[150px]">
                  <div className="flex flex-col leading-tight">
                    <span className="font-semibold text-[13.5px] truncate">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-4)] truncate">
                      {sideName(p.side)}
                    </span>
                  </div>
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-1 py-1.5 text-center">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={rows[p.id][c.key]}
                      onChange={(e) => setCell(p.id, c.key, e.target.value)}
                      className={cellInput}
                      aria-label={`${p.firstName} ${p.lastName} ${c.label}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && !pending && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--up)]">
            <Check size={14} /> Saved
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
        >
          <BarChart3 size={14} strokeWidth={2.5} />
          {pending ? "Saving…" : "Save box score"}
        </button>
      </div>
    </div>
  );
}
