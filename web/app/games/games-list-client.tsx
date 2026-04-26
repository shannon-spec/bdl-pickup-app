"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Pill } from "@/components/bdl/pill";
import { HeroTag, isHeroGame } from "@/components/bdl/hero-tag";
import type { GameListRow } from "@/lib/queries/games";

const PAGE_SIZE = 25;

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()]} · ${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getMonth()]
  } ${dt.getDate()}, ${dt.getFullYear()}`;
};

export function GamesListClient({ rows }: { rows: GameListRow[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Reset paging whenever the parent passes a different row set
  // (e.g. user changes year/status/league). Tying to row identity is
  // good enough — the array reference changes on each server render.
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [rows]);

  const filtered = rows;
  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > shown.length;

  return (
    <>
      {filtered.length === 0 ? (
        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
          No games match the current filter.
        </div>
      ) : (
        <>
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
            {shown.map((g) => {
              const completed =
                (g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null;
              const isHero =
                isHeroGame({
                  gameWinner: g.gameWinner,
                  scoreA: g.scoreA,
                  scoreB: g.scoreB,
                }) && !!g.gameWinnerName;
              return (
                <Link
                  key={g.id}
                  href={`/games/${g.id}`}
                  className="grid grid-cols-[160px_1fr_auto_auto] max-sm:grid-cols-[1fr_auto] gap-4 items-center px-5 py-3 border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] transition-colors text-[14px]"
                >
                  <div className="font-bold text-[12.5px]">{fmtDate(g.gameDate)}</div>
                  <div className="min-w-0 max-sm:col-span-2 max-sm:order-3 flex items-center gap-2 flex-wrap">
                    <span className="text-[color:var(--text-3)] text-[12px]">
                      {g.leagueName}
                    </span>
                    <TeamLabel side="A" winTeam={g.winTeam} name={g.teamAName} />
                    <span className="text-[color:var(--text-4)] font-medium">vs</span>
                    <TeamLabel side="B" winTeam={g.winTeam} name={g.teamBName} />
                    {isHero && <HeroTag name={g.gameWinnerName!} size="sm" />}
                  </div>
                  <div className="font-[family-name:var(--mono)] text-[13px] num">
                    {g.scoreA !== null && g.scoreB !== null ? (
                      <>
                        <span className={g.winTeam === "A" ? "" : "text-[color:var(--text-3)]"}>
                          {g.scoreA}
                        </span>
                        <span className="text-[color:var(--text-4)] mx-1">—</span>
                        <span className={g.winTeam === "B" ? "" : "text-[color:var(--text-3)]"}>
                          {g.scoreB}
                        </span>
                      </>
                    ) : (
                      <span className="text-[color:var(--text-3)]">—</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 justify-self-end">
                    {completed ? (
                      g.locked ? (
                        <Pill tone="win" dot>
                          Final
                        </Pill>
                      ) : (
                        <Pill tone="neutral">Open</Pill>
                      )
                    ) : (
                      <Pill tone="neutral">Upcoming</Pill>
                    )}
                    <ChevronRight size={14} className="text-[color:var(--text-3)]" />
                  </div>
                </Link>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-semibold tracking-[0.06em] uppercase text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors"
              >
                <ChevronDown size={14} />
                Show more
                <span className="text-[color:var(--text-3)] font-medium normal-case tracking-normal">
                  ({filtered.length - shown.length} left)
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function TeamLabel({
  side,
  winTeam,
  name,
}: {
  side: "A" | "B";
  winTeam: "A" | "B" | "Tie" | null;
  name: string;
}) {
  const isWinner = winTeam === side;
  const isLoser = winTeam === "A" || winTeam === "B" ? !isWinner : false;
  if (isWinner) {
    const isSilver = side === "A";
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-extrabold text-[color:var(--text)] border"
        style={{
          background: isSilver ? "rgba(170,178,192,.22)" : "rgba(212,175,55,.22)",
          borderColor: isSilver ? "rgba(170,178,192,.45)" : "rgba(212,175,55,.55)",
        }}
      >
        ✓ {name}
      </span>
    );
  }
  return (
    <span className={isLoser ? "font-medium text-[color:var(--text-3)]" : "font-bold"}>
      {name}
    </span>
  );
}
