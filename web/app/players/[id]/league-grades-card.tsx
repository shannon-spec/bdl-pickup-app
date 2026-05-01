import Link from "next/link";
import { GradePill } from "@/components/bdl/grade-pill-color";
import type { LeagueGradeRow } from "@/lib/queries/player-grades";

/**
 * Per-league grade breakdown on the player profile.
 *
 * One row per league the player is currently in. Each row shows the
 * crowd-derived grade for that specific league (or the admin-set
 * override if no votes yet, or "Not yet rated"). The row links into
 * the league detail page so the viewer can switch context.
 */
export function LeagueGradesCard({ rows }: { rows: LeagueGradeRow[] }) {
  return (
    <section className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
      <div className="px-6 py-4 border-b border-[color:var(--hairline)] flex items-center gap-2">
        <span aria-hidden className="w-[3px] h-[12px] rounded-sm bg-[color:var(--brand)]" />
        <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-2)]">
          Grade by League
        </span>
      </div>
      <ul>
        {rows.map((r) => {
          const display = r.crowdGrade ?? r.adminLevel;
          const totalVotes = r.peerCount + r.commissionerCount;
          return (
            <li
              key={r.leagueId}
              className="border-t border-[color:var(--hairline)] first:border-t-0"
            >
              <Link
                href={`/leagues/${r.leagueId}`}
                className="flex items-center justify-between gap-3 px-6 py-3.5 hover:bg-[color:var(--surface-2)] transition-colors"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-[14px] truncate">
                    {r.leagueName}
                  </span>
                  <span className="text-[11px] text-[color:var(--text-3)]">
                    {totalVotes > 0
                      ? `${r.peerCount} player ${r.peerCount === 1 ? "vote" : "votes"} · ${r.commissionerCount} commissioner ${r.commissionerCount === 1 ? "vote" : "votes"}`
                      : r.adminLevel
                        ? "Set by admin · No peer votes yet"
                        : "Not yet rated"}
                  </span>
                </div>
                {display ? (
                  <GradePill grade={display} />
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10.5px] font-bold tracking-[0.06em] uppercase bg-[color:var(--surface-2)] text-[color:var(--text-4)] border border-dashed border-[color:var(--hairline-2)]">
                    Ungraded
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
