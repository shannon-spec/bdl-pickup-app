import Link from "next/link";
import type { GameStat } from "@/lib/db";

type StatPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  side: "A" | "B";
};

const COLUMNS = [
  { key: "minutes", label: "MIN" },
  { key: "points", label: "PTS" },
  { key: "rebounds", label: "REB" },
  { key: "assists", label: "AST" },
  { key: "steals", label: "STL" },
  { key: "blocks", label: "BLK" },
  { key: "turnovers", label: "TO" },
  { key: "fouls", label: "PF" },
] as const;

type CountKey = (typeof COLUMNS)[number]["key"];

const n = (v: number | null) => v ?? 0;
const pct = (m: number, a: number) => (a > 0 ? `${Math.round((m / a) * 100)}%` : "—");
const hasAnyStat = (s: GameStat | undefined) =>
  !!s &&
  [
    "minutes",
    "points",
    "rebounds",
    "assists",
    "steals",
    "blocks",
    "turnovers",
    "fouls",
    "fgm",
    "fga",
    "tpm",
    "tpa",
    "ftm",
    "fta",
  ].some((k) => (s as unknown as Record<string, number | null>)[k] !== null);

const th =
  "px-2 py-1.5 text-center text-[10px] font-bold tracking-[0.06em] uppercase text-[color:var(--text-3)]";
const td = "px-2 py-1.5 text-center text-[13px] num font-[family-name:var(--mono)]";

function SideTable({
  name,
  players,
  stats,
}: {
  name: string;
  players: StatPlayer[];
  stats: Record<string, GameStat>;
}) {
  const rows = players.filter((p) => hasAnyStat(stats[p.id]));
  if (rows.length === 0) return null;

  const totals = { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 } as Record<
    string,
    number
  >;
  const countTotals: Record<CountKey, number> = {
    minutes: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
  };
  for (const p of rows) {
    const s = stats[p.id];
    for (const c of COLUMNS) countTotals[c.key] += n(s[c.key]);
    for (const k of ["fgm", "fga", "tpm", "tpa", "ftm", "fta"] as const)
      totals[k] += n(s[k]);
  }

  return (
    <div>
      <div className="px-3 py-2 text-[10.5px] font-bold tracking-[0.12em] uppercase text-[color:var(--text-2)] shadow-[inset_0_-1px_0_0_var(--hairline)]">
        {name}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="shadow-[inset_0_-1px_0_0_var(--hairline)]">
              <th className={`${th} sticky left-0 z-10 bg-[color:var(--surface)] text-left min-w-[140px]`}>
                Player
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} className={th}>
                  {c.label}
                </th>
              ))}
              <th className={th}>FG</th>
              <th className={th}>3P</th>
              <th className={th}>FT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const s = stats[p.id];
              return (
                <tr key={p.id} className="shadow-[inset_0_-1px_0_0_var(--hairline)]">
                  <td className="sticky left-0 z-10 bg-[color:var(--surface)] px-3 py-1.5 text-left min-w-[140px]">
                    <Link
                      href={`/players/${p.id}`}
                      className="font-semibold text-[13px] truncate hover:text-[color:var(--brand)]"
                    >
                      {p.firstName} {p.lastName}
                    </Link>
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={td}>
                      {n(s[c.key])}
                    </td>
                  ))}
                  <td className={td}>
                    {n(s.fgm)}-{n(s.fga)}
                  </td>
                  <td className={td}>
                    {n(s.tpm)}-{n(s.tpa)}
                  </td>
                  <td className={td}>
                    {n(s.ftm)}-{n(s.fta)}
                  </td>
                </tr>
              );
            })}
            {/* Totals */}
            <tr className="bg-[color:var(--surface-2)]">
              <td className="sticky left-0 z-10 bg-[color:var(--surface-2)] px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-3)]">
                Totals
              </td>
              {COLUMNS.map((c) => (
                <td key={c.key} className={`${td} font-extrabold`}>
                  {countTotals[c.key]}
                </td>
              ))}
              <td className={`${td} font-extrabold`}>
                {totals.fgm}-{totals.fga}
                <span className="block text-[10px] font-semibold text-[color:var(--text-3)]">
                  {pct(totals.fgm, totals.fga)}
                </span>
              </td>
              <td className={`${td} font-extrabold`}>
                {totals.tpm}-{totals.tpa}
                <span className="block text-[10px] font-semibold text-[color:var(--text-3)]">
                  {pct(totals.tpm, totals.tpa)}
                </span>
              </td>
              <td className={`${td} font-extrabold`}>
                {totals.ftm}-{totals.fta}
                <span className="block text-[10px] font-semibold text-[color:var(--text-3)]">
                  {pct(totals.ftm, totals.fta)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Read-only box score for everyone. Renders nothing if no stats exist. */
export function BoxScore({
  teamAName,
  teamBName,
  players,
  stats,
}: {
  teamAName: string;
  teamBName: string;
  players: StatPlayer[];
  stats: Record<string, GameStat>;
}) {
  const any = players.some((p) => hasAnyStat(stats[p.id]));
  if (!any) return null;

  const a = players.filter((p) => p.side === "A");
  const b = players.filter((p) => p.side === "B");

  return (
    <section className="rounded-[16px] bg-[color:var(--surface-2)] p-4">
      <span className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-[color:var(--brand-ink)]">
        Box Score
      </span>
      <div className="mt-3 flex flex-col gap-3">
        <div className="rounded-[12px] bg-[color:var(--surface)] overflow-hidden shadow-[inset_0_0_0_1px_var(--hairline)]">
          <SideTable name={teamAName} players={a} stats={stats} />
        </div>
        <div className="rounded-[12px] bg-[color:var(--surface)] overflow-hidden shadow-[inset_0_0_0_1px_var(--hairline)]">
          <SideTable name={teamBName} players={b} stats={stats} />
        </div>
      </div>
    </section>
  );
}
