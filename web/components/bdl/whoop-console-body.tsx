"use client";

import { useEffect, useMemo, useState } from "react";
import type { WhoopGameMetric } from "@/lib/whoop/game-metrics";
import { WhoopConnectButton } from "@/components/bdl/whoop-connect-button";
import { WhoopSyncControls } from "@/components/bdl/whoop-sync-controls";

type Range = "MTD" | "YTD";
type Scope = "league" | "other";

const YTD_PAGE_SIZE = 25;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StrainBar({ strain }: { strain: number }) {
  const pct = Math.min((strain / 21) * 100, 100);
  const color =
    strain >= 18
      ? "var(--down)"
      : strain >= 14
        ? "#f97316"
        : strain >= 10
          ? "#eab308"
          : "var(--up)";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-[color:var(--surface-2)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="font-[family-name:var(--mono)] font-extrabold text-[13px] num w-8 text-right"
        style={{ color }}
      >
        {strain.toFixed(1)}
      </span>
    </div>
  );
}

function avg(nums: Array<number | null | undefined>): number | null {
  const filtered = nums.filter((n): n is number => typeof n === "number");
  if (filtered.length === 0) return null;
  return filtered.reduce((s, n) => s + n, 0) / filtered.length;
}

/** A roster game is "upcoming" if it has no outcome AND its scheduled
 *  start hasn't passed yet. Past games without an outcome stay
 *  unlabeled — they're either unscored or were never played. */
function isUpcomingGame(m: WhoopGameMetric): boolean {
  if (m.outcome !== null) return false;
  return new Date(m.date).getTime() > Date.now();
}

export function WhoopConsoleBody({
  playerId,
  connected,
  lastSyncAt,
  metrics,
  otherMetrics,
}: {
  playerId: string;
  connected: boolean;
  lastSyncAt: string | null;
  metrics: WhoopGameMetric[];
  otherMetrics: WhoopGameMetric[];
}) {
  const [scope, setScope] = useState<Scope>("league");
  const [range, setRange] = useState<Range>("MTD");
  const [visibleCount, setVisibleCount] = useState(YTD_PAGE_SIZE);

  const sourceMetrics = scope === "league" ? metrics : otherMetrics;

  // Reset pagination whenever the active range OR scope changes —
  // either tab switch should drop the user back to the first page.
  useEffect(() => {
    setVisibleCount(YTD_PAGE_SIZE);
  }, [range, scope]);

  const filtered = useMemo(() => {
    const now = new Date();
    const start =
      range === "MTD"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(now.getFullYear(), 0, 1);
    return sourceMetrics.filter((m) => new Date(m.date) >= start);
  }, [sourceMetrics, range]);

  // Pagination only kicks in on YTD where lists are long. MTD is a
  // month at most and shows everything.
  const visibleRows =
    range === "YTD" ? filtered.slice(0, visibleCount) : filtered;
  const moreAvailable = range === "YTD" && visibleCount < filtered.length;

  const summary = useMemo(() => {
    // Hero/W-L averages exclude DAY-source rows. A "DAY" strain is the
    // whole-day cycle average, not the game window — including it
    // drags a 16-strain basketball session down to ~4 because most of
    // the day was sleep/sedentary. We still show DAY rows in the table
    // so the player knows we have *something* for that game; they just
    // don't count toward the averages.
    const scorable = filtered.filter((m) => m.source === "workout");
    const wins = scorable.filter((m) => m.outcome === "W");
    const losses = scorable.filter((m) => m.outcome === "L");
    return {
      total: filtered.length,
      scoredCount: scorable.length,
      avgStrain: avg(scorable.map((m) => m.strain)),
      avgHr: avg(scorable.map((m) => m.avgHr)),
      maxHr: scorable.reduce((m, w) => Math.max(m, w.maxHr ?? 0), 0),
      avgCal: avg(scorable.map((m) => m.calories)),
      avgHighZone: avg(scorable.map((m) => m.highZoneMin)),
      avgHighZonePct: avg(
        scorable.map((m) =>
          m.highZoneMin !== null && m.durationMin && m.durationMin > 0
            ? (m.highZoneMin / m.durationMin) * 100
            : null,
        ),
      ),
      strainW: avg(wins.map((m) => m.strain)),
      strainL: avg(losses.map((m) => m.strain)),
      hrW: avg(wins.map((m) => m.avgHr)),
      hrL: avg(losses.map((m) => m.avgHr)),
      winCount: wins.length,
      lossCount: losses.length,
      avgScore: avg(scorable.map((m) => m.performanceScore)),
      bestScore: scorable.reduce(
        (best, m) =>
          m.performanceScore !== null && m.performanceScore > (best ?? -1)
            ? m.performanceScore
            : best,
        null as number | null,
      ),
    };
  }, [filtered]);

  // "Last Game Strain" should represent an actual game session, so
  // skip DAY rows here too. Same rule for the "Last Game" pillar in the
  // BDL Score hero.
  const lastWithStrain =
    filtered.find((m) => m.source === "workout" && m.strain !== null) ?? null;
  const lastScored =
    filtered.find((m) => m.source === "workout" && m.performanceScore !== null) ??
    null;

  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="w-[3px] h-[12px] rounded-sm bg-[#000] dark:bg-white"
          />
          <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-2)]">
            Whoop · BDL Games
          </span>
          {connected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:var(--up-soft)] text-[color:var(--up)] text-[10px] font-semibold tracking-[0.08em] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--up)]" />
              Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {connected &&
            (metrics.length > 0 || otherMetrics.length > 0) && (
              <ScopeTabs scope={scope} onChange={setScope} />
            )}
          {connected && sourceMetrics.length > 0 && (
            <RangeTabs range={range} onChange={setRange} />
          )}
          <WhoopConnectButton connected={connected} />
        </div>
      </div>

      {connected && (
        <WhoopSyncControls playerId={playerId} lastSyncAt={lastSyncAt} />
      )}

      {!connected && (
        <div className="flex flex-col gap-3 py-4 items-center text-center">
          <p className="text-[13px] text-[color:var(--text-3)] max-w-md leading-relaxed">
            Connect your Whoop and BDL will pair strain, heart rate, and
            calories to every scheduled game on your roster — even if
            you never tagged the session as basketball in the Whoop app.
          </p>
          <p className="text-[12px] text-[color:var(--text-3)] max-w-md leading-relaxed">
            <strong className="text-[color:var(--text-2)]">Private by default.</strong>{" "}
            Your Whoop data is visible only to you. You can opt in to share
            with your league for head-to-head and leaderboard products in
            <em> Edit Player → Whoop Privacy</em>.
          </p>
        </div>
      )}

      {connected && sourceMetrics.length === 0 && (
        <p className="text-[13px] text-[color:var(--text-3)] py-2">
          {scope === "league"
            ? "No BDL games on your roster yet. Once you're scheduled, we'll pull strain from the matching Whoop session."
            : "No off-league basketball sessions in Whoop yet. Pickup or open-gym games tagged Basketball in the Whoop app will land here."}
        </p>
      )}

      {connected && sourceMetrics.length > 0 && (
        <>
          <BdlScoreHero
            avgScore={summary.avgScore}
            lastScore={lastScored?.performanceScore ?? null}
            bestScore={summary.bestScore}
            scoredCount={summary.scoredCount}
            scope={scope}
            range={range}
          />
          <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
            <SummaryBlock
              label="Avg Strain"
              value={summary.avgStrain ? summary.avgStrain.toFixed(1) : "—"}
            />
            <SummaryBlock
              label="Avg HR"
              value={summary.avgHr ? `${Math.round(summary.avgHr)}` : "—"}
              unit="bpm"
            />
            <SummaryBlock
              label="Avg Cal"
              value={
                summary.avgCal !== null
                  ? Math.round(summary.avgCal).toLocaleString()
                  : "—"
              }
            />
            <SummaryBlock
              label="Avg Max Effort"
              hint="Z4+5"
              value={
                summary.avgHighZone !== null
                  ? `${Math.round(summary.avgHighZone)} min${
                      summary.avgHighZonePct !== null
                        ? ` / ${Math.round(summary.avgHighZonePct)}%`
                        : ""
                    }`
                  : "—"
              }
            />
          </div>

          {scope === "league" && (
            <div className="flex items-center gap-2 flex-wrap">
              <SplitPill
                label="Strain"
                wins={summary.strainW}
                losses={summary.strainL}
                winCount={summary.winCount}
                lossCount={summary.lossCount}
                decimals={1}
              />
              <SplitPill
                label="Avg HR"
                wins={summary.hrW}
                losses={summary.hrL}
                winCount={summary.winCount}
                lossCount={summary.lossCount}
                decimals={0}
                unit="bpm"
              />
            </div>
          )}

          {summary.scoredCount < summary.total && (
            <p className="text-[10.5px] text-[color:var(--text-3)] -mt-1">
              Averages exclude{" "}
              <span className="inline-flex items-center justify-center px-1.5 h-3.5 align-middle rounded-sm text-[8.5px] font-bold tracking-[0.08em] uppercase bg-[color:var(--surface-2)] text-[color:var(--text-3)] mx-0.5">
                Day
              </span>{" "}
              rows — those are whole-day strain, not game-window strain.
            </p>
          )}

          {lastWithStrain?.strain !== undefined &&
            lastWithStrain?.strain !== null && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
                  {scope === "league" ? "Last Game Strain" : "Last Session Strain"}
                </span>
                <StrainBar strain={lastWithStrain.strain} />
              </div>
            )}

          {filtered.length === 0 ? (
            <p className="text-[13px] text-[color:var(--text-3)] py-2">
              No games in this {range === "MTD" ? "month" : "year"} yet.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-[color:var(--hairline)]">
              <div className="grid grid-cols-[1fr_44px_56px_48px_64px_60px_60px_60px_92px] gap-3 pb-2 text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
                <span>Game</span>
                <span className="text-right">W/L</span>
                <span className="text-right">Source</span>
                <span className="text-right">Score</span>
                <span className="text-right">Strain</span>
                <span className="text-right">Avg HR</span>
                <span className="text-right">Max HR</span>
                <span className="text-right">Cal</span>
                <span className="text-right">Z4+5</span>
              </div>
              {visibleRows.map((m) => {
                const isUpcoming = isUpcomingGame(m);
                return (
                  <div
                    key={m.gameId}
                    className="grid grid-cols-[1fr_44px_56px_48px_64px_60px_60px_60px_92px] gap-3 items-center py-3"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[13px] font-semibold truncate">
                        {fmtDate(m.date)}
                      </span>
                      <span className="text-[11px] text-[color:var(--text-3)] truncate">
                        {m.leagueName ?? "Basketball"}
                        {m.durationMin ? ` · ${m.durationMin}m` : ""}
                      </span>
                    </div>
                    {isUpcoming ? (
                      <div
                        className="col-span-8 flex justify-end"
                        aria-label="Upcoming game"
                      >
                        <UpcomingPill />
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-end">
                          <OutcomeBadge outcome={m.outcome} />
                        </div>
                        <div className="flex justify-end">
                          <SourceBadge source={m.source} />
                        </div>
                        <PerformanceScoreCell score={m.performanceScore} />
                        <div className="flex justify-end">
                          {m.strain !== null ? (
                            <span
                              className="font-[family-name:var(--mono)] font-bold text-[13px] num"
                              style={{
                                color: aboveAvg(m.strain, summary.avgStrain)
                                  ? "var(--up)"
                                  : undefined,
                              }}
                            >
                              {m.strain.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-[color:var(--text-4)]">—</span>
                          )}
                        </div>
                        <span className="font-[family-name:var(--mono)] num text-[13px] text-right">
                          {m.avgHr ?? "—"}
                        </span>
                        <span className="font-[family-name:var(--mono)] num text-[13px] font-bold text-right">
                          {m.maxHr ?? "—"}
                        </span>
                        <span
                          className="font-[family-name:var(--mono)] num text-[12px] font-bold text-right"
                          style={{
                            color: aboveAvg(m.calories, summary.avgCal)
                              ? "var(--up)"
                              : "var(--text-3)",
                          }}
                        >
                          {m.calories ?? "—"}
                        </span>
                        <HighZoneCell
                          highZoneMin={m.highZoneMin}
                          durationMin={m.durationMin}
                          highlight={aboveAvg(
                            m.highZoneMin,
                            summary.avgHighZone,
                          )}
                          avgPct={summary.avgHighZonePct}
                        />
                      </>
                    )}
                  </div>
                );
              })}
              {moreAvailable && (
                <div className="flex items-center justify-center pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((n) => n + YTD_PAGE_SIZE)
                    }
                    className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[11px] font-bold tracking-[0.06em] uppercase text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors"
                  >
                    Show {Math.min(YTD_PAGE_SIZE, filtered.length - visibleCount)} more
                    <span className="text-[color:var(--text-4)] font-semibold normal-case tracking-normal">
                      · {visibleCount} of {filtered.length}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RangeTabs({
  range,
  onChange,
}: {
  range: Range;
  onChange: (r: Range) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-[color:var(--surface-2)] p-0.5">
      {(["MTD", "YTD"] as const).map((r) => {
        const active = r === range;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={`px-2.5 h-6 rounded-full text-[10px] font-bold tracking-[0.12em] uppercase transition-colors ${
              active
                ? "bg-[color:var(--surface)] text-[color:var(--text)] shadow-sm"
                : "text-[color:var(--text-3)] hover:text-[color:var(--text-2)]"
            }`}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}

function ScopeTabs({
  scope,
  onChange,
}: {
  scope: Scope;
  onChange: (s: Scope) => void;
}) {
  const tabs: Array<{ key: Scope; label: string }> = [
    { key: "league", label: "By League" },
    { key: "other", label: "All Other" },
  ];
  return (
    <div className="inline-flex rounded-full bg-[color:var(--surface-2)] p-0.5">
      {tabs.map((t) => {
        const active = t.key === scope;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`px-3 h-6 rounded-full text-[10px] font-bold tracking-[0.12em] uppercase transition-colors ${
              active
                ? "bg-[color:var(--surface)] text-[color:var(--text)] shadow-sm"
                : "text-[color:var(--text-3)] hover:text-[color:var(--text-2)]"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function SplitPill({
  label,
  wins,
  losses,
  winCount,
  lossCount,
  decimals,
  unit,
}: {
  label: string;
  wins: number | null;
  losses: number | null;
  winCount: number;
  lossCount: number;
  decimals: 0 | 1;
  unit?: string;
}) {
  const fmt = (n: number | null) =>
    n === null
      ? "—"
      : decimals === 0
        ? `${Math.round(n)}`
        : n.toFixed(decimals);
  return (
    <div className="inline-flex items-stretch h-9 rounded-full overflow-hidden border border-[color:var(--hairline-2)] bg-[color:var(--surface)]">
      <span className="flex items-center px-3 text-[10px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-3)] border-r border-[color:var(--hairline-2)]">
        {label}
      </span>
      <span className="flex items-center gap-1.5 px-3 text-[11px] font-semibold border-r border-[color:var(--hairline-2)]">
        <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-[color:var(--up)]">
          W
        </span>
        <span className="font-[family-name:var(--mono)] font-extrabold text-[13px] num">
          {fmt(wins)}
        </span>
        {unit && (
          <span className="text-[9px] text-[color:var(--text-4)] uppercase">
            {unit}
          </span>
        )}
        <span className="text-[9px] text-[color:var(--text-4)]">
          ·{winCount}
        </span>
      </span>
      <span className="flex items-center gap-1.5 px-3 text-[11px] font-semibold">
        <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-[color:var(--down)]">
          L
        </span>
        <span className="font-[family-name:var(--mono)] font-extrabold text-[13px] num">
          {fmt(losses)}
        </span>
        {unit && (
          <span className="text-[9px] text-[color:var(--text-4)] uppercase">
            {unit}
          </span>
        )}
        <span className="text-[9px] text-[color:var(--text-4)]">
          ·{lossCount}
        </span>
      </span>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: "W" | "L" | "T" | null }) {
  if (!outcome) {
    return (
      <span className="text-[color:var(--text-4)] text-[10px]">—</span>
    );
  }
  const cls =
    outcome === "W"
      ? "bg-[color:var(--up-soft)] text-[color:var(--up)]"
      : outcome === "L"
        ? "bg-[color:var(--down-soft)] text-[color:var(--down)]"
        : "bg-[color:var(--surface-2)] text-[color:var(--text-3)]";
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-extrabold ${cls}`}
    >
      {outcome}
    </span>
  );
}

/** Grade band for a BDL Performance Score, in five tiers that match
 *  the pill colors below. */
type ScoreGrade = "elite" | "strong" | "avg" | "below" | "poor";
function scoreGrade(score: number): ScoreGrade {
  if (score >= 80) return "elite";
  if (score >= 65) return "strong";
  if (score >= 45) return "avg";
  if (score >= 30) return "below";
  return "poor";
}

/** Hero-text color for the avg BDL Score — pulls the same accent used
 *  in the pill text so the hero and table reads as one system. */
function scoreColor(score: number | null | undefined): string | undefined {
  if (score === null || score === undefined) return undefined;
  switch (scoreGrade(score)) {
    case "elite":
    case "strong":
      return "var(--up)";
    case "avg":
      return "var(--text-2)";
    case "below":
      return "#f97316";
    case "poor":
      return "var(--down)";
  }
}

/** Background + text classes for the score pill, keyed off the grade. */
function scorePillClasses(grade: ScoreGrade): string {
  switch (grade) {
    case "elite":
    case "strong":
      return "bg-[color:var(--up-soft)] text-[color:var(--up)]";
    case "avg":
      return "bg-[color:var(--surface-2)] text-[color:var(--text-2)]";
    case "below":
      return "bg-[#f97316]/15 text-[#f97316]";
    case "poor":
      return "bg-[color:var(--down-soft)] text-[color:var(--down)]";
  }
}

function PerformanceScoreCell({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex justify-end">
        <span className="text-[color:var(--text-4)] text-[12px]">—</span>
      </div>
    );
  }
  const grade = scoreGrade(score);
  return (
    <div className="flex justify-end">
      <span
        className={`inline-flex items-center justify-center min-w-[34px] h-6 px-2 rounded-full font-[family-name:var(--mono)] font-extrabold text-[12px] num ${scorePillClasses(grade)}`}
        title="BDL Performance Score — player-relative composite of intensity (Z4+Z5%) and load (strain). 50 = your average game."
      >
        {score}
      </span>
    </div>
  );
}

/* ── BDL Score hero ─────────────────────────────────────────────────
 * Three pillars (Season Avg / Last Game / All Time Best) above a
 * tier-segmented scale bar with a needle pinned at the season avg.
 * Replaces the small "BDL Score" SummaryBlock previously in the hero
 * strip — same data, more legible at a glance.
 * ──────────────────────────────────────────────────────────────── */
function BdlScoreHero({
  avgScore,
  lastScore,
  bestScore,
  scoredCount,
  scope,
  range,
}: {
  avgScore: number | null;
  lastScore: number | null;
  bestScore: number | null;
  scoredCount: number;
  scope: "league" | "other";
  range: Range;
}) {
  const noun = scope === "league" ? "Game" : "Session";
  return (
    <div className="rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-6 py-6 flex flex-col items-center gap-5">
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-[12px] font-bold tracking-[0.1em] uppercase text-[color:var(--text)]">
          BDL Max Effort{" "}
          <span className="text-[11px] font-medium tracking-[0.04em] normal-case text-[color:var(--text-3)]">
            (Personal Scale)
          </span>
        </h3>
        <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-4)]">
          {scoredCount} {noun}
          {scoredCount === 1 ? "" : "s"} · {range}
        </p>
      </div>

      <div className="inline-flex items-stretch rounded-[12px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden max-sm:flex-col">
        <ScorePillar
          label={scope === "league" ? "Season Avg" : "Avg"}
          score={avgScore !== null ? Math.round(avgScore) : null}
        />
        <Divider />
        <ScorePillar label={`Last ${noun}`} score={lastScore} />
        <Divider />
        <ScorePillar label="All Time Best" score={bestScore} />
      </div>

      {avgScore !== null && <ScaleBar score={Math.round(avgScore)} />}
    </div>
  );
}

function Divider() {
  return (
    <div className="w-px self-stretch bg-[color:var(--hairline-2)] max-sm:w-full max-sm:h-px" />
  );
}

const TIER_LABEL: Record<ScoreGrade, string> = {
  elite: "Elite",
  strong: "Strong",
  avg: "Avg",
  below: "Below",
  poor: "Poor",
};

function ScorePillar({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  const grade = score !== null ? scoreGrade(score) : null;
  const color = score !== null ? scoreColor(score) : "var(--text-4)";
  return (
    <div className="flex flex-col items-center gap-2 px-7 py-4 max-sm:px-4 max-sm:py-3">
      <span className="text-[9px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
        {label}
      </span>
      <span
        className="font-[family-name:var(--mono)] font-extrabold text-[32px] num leading-none"
        style={{ color }}
      >
        {score !== null ? score : "—"}
      </span>
      {grade ? (
        <span
          className={`text-[8.5px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-full ${scorePillClasses(grade)}`}
        >
          {TIER_LABEL[grade]}
        </span>
      ) : (
        <span className="text-[8.5px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-full bg-[color:var(--surface-2)] text-[color:var(--text-4)]">
          —
        </span>
      )}
    </div>
  );
}

const SCALE_TIERS: Array<{
  grade: ScoreGrade;
  name: string;
  min: number;
  max: number;
  /** Flex-grow weight = numeric width of the band (max−min+1). */
  w: number;
}> = [
  { grade: "poor", name: "Poor", min: 0, max: 29, w: 30 },
  { grade: "below", name: "Below", min: 30, max: 44, w: 15 },
  { grade: "avg", name: "Avg", min: 45, max: 64, w: 20 },
  { grade: "strong", name: "Strong", min: 65, max: 79, w: 15 },
  { grade: "elite", name: "Elite", min: 80, max: 100, w: 21 },
];

function tierColor(g: ScoreGrade): string {
  switch (g) {
    case "elite":
    case "strong":
      return "var(--up)";
    case "avg":
      return "var(--text-3)";
    case "below":
      return "#f97316";
    case "poor":
      return "var(--down)";
  }
}

function ScaleBar({ score }: { score: number }) {
  const grade = scoreGrade(score);
  const activeColor = tierColor(grade);
  return (
    <div className="w-full max-w-[640px] flex flex-col gap-1.5">
      {/* Tier name labels */}
      <div className="flex">
        {SCALE_TIERS.map((t) => {
          const isActive = t.grade === grade;
          return (
            <div
              key={t.name}
              className="text-center text-[9.5px] font-bold tracking-[0.13em] uppercase"
              style={{
                flex: t.w,
                color: isActive ? tierColor(t.grade) : "var(--text-4)",
              }}
            >
              {t.name}
            </div>
          );
        })}
      </div>

      {/* Bar with needle */}
      <div className="relative pt-7">
        <div
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center gap-0.5 z-10"
          style={{ left: `${Math.max(0, Math.min(100, score))}%` }}
        >
          <div
            className="font-[family-name:var(--mono)] font-extrabold text-[10.5px] px-1.5 py-0.5 rounded leading-none border bg-[color:var(--surface)] num"
            style={{ color: activeColor, borderColor: activeColor }}
          >
            {score}
          </div>
          <div
            className="w-0 h-0 border-l-[5px] border-r-[5px] border-l-transparent border-r-transparent"
            style={{
              borderTopWidth: 6,
              borderTopStyle: "solid",
              borderTopColor: activeColor,
            }}
          />
        </div>
        <div className="flex h-[18px] rounded-md overflow-hidden border border-[color:var(--hairline-2)]">
          {SCALE_TIERS.map((t) => {
            const c = tierColor(t.grade);
            const isActive = t.grade === grade;
            return (
              <div
                key={t.name}
                style={{
                  flex: t.w,
                  background: isActive
                    ? c
                    : `color-mix(in oklab, ${c} 28%, transparent)`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Range labels */}
      <div className="flex">
        {SCALE_TIERS.map((t) => {
          const isActive = t.grade === grade;
          return (
            <div
              key={t.name}
              className="text-center text-[9px] font-medium tracking-[0.04em] num"
              style={{
                flex: t.w,
                color: isActive ? tierColor(t.grade) : "var(--text-4)",
              }}
            >
              {t.min}–{t.max}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function aboveAvg(
  value: number | null | undefined,
  average: number | null | undefined,
): boolean {
  if (value === null || value === undefined) return false;
  if (average === null || average === undefined) return false;
  return value > average;
}

function HighZoneCell({
  highZoneMin,
  durationMin,
  highlight,
  avgPct,
}: {
  highZoneMin: number | null;
  durationMin: number | null;
  highlight?: boolean;
  avgPct?: number | null;
}) {
  if (highZoneMin === null) {
    return (
      <div className="flex justify-end">
        <span className="text-[color:var(--text-4)]">—</span>
      </div>
    );
  }
  const pct =
    durationMin && durationMin > 0
      ? Math.round((highZoneMin / durationMin) * 100)
      : null;
  // Above-the-player's-own-average wins. When this row's % beats the
  // scope's average %, paint it green to match the same-row strain
  // and calorie highlights. Otherwise fall back to the intensity
  // band (red/orange/yellow) for absolute workload shape.
  const pctAboveAvg = pct !== null && aboveAvg(pct, avgPct ?? null);
  // Green is the win-state for percentage too — used to be a yellow
  // band at 25–39%, but the user reads green as "good" and yellow
  // as "meh", so promote anything in basketball-realistic territory
  // (>=25%) to green. Orange/red stay for genuinely all-out games.
  const pctColor =
    pct === null
      ? "var(--text-3)"
      : pct >= 60
        ? "var(--down)"
        : pct >= 40
          ? "#f97316"
          : pct >= 25
            ? "var(--up)"
            : pctAboveAvg
              ? "var(--up)"
              : "var(--text-3)";
  return (
    <div className="flex items-baseline justify-end gap-1 font-[family-name:var(--mono)] num">
      <span
        className="text-[13px] font-bold"
        style={{ color: highlight ? "var(--up)" : undefined }}
      >
        {highZoneMin}
        <span className="text-[10px] text-[color:var(--text-4)] ml-0.5 font-semibold">
          m
        </span>
      </span>
      {pct !== null && (
        <>
          <span className="text-[10px] text-[color:var(--text-4)]">/</span>
          <span
            className="text-[12px] font-semibold"
            style={{ color: pctColor }}
          >
            {pct}%
          </span>
        </>
      )}
    </div>
  );
}

function UpcomingPill() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 h-5 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand)] text-[10px] font-bold tracking-[0.1em] uppercase">
      <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--brand)] animate-pulse" />
      Upcoming Game
    </span>
  );
}

function SourceBadge({ source }: { source: "workout" | "cycle" | "none" }) {
  if (source === "none") {
    return (
      <span className="text-[9.5px] font-semibold tracking-[0.1em] uppercase text-[color:var(--text-4)]">
        —
      </span>
    );
  }
  const label = source === "workout" ? "Game" : "Day";
  const cls =
    source === "workout"
      ? "bg-[color:var(--up-soft)] text-[color:var(--up)]"
      : "bg-[color:var(--surface-2)] text-[color:var(--text-3)]";
  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 h-4 rounded-sm text-[9px] font-bold tracking-[0.08em] uppercase ${cls}`}
    >
      {label}
    </span>
  );
}

function SummaryBlock({
  label,
  hint,
  value,
  unit,
  scoreColor: color,
}: {
  label: string;
  hint?: string;
  value: string;
  unit?: string;
  scoreColor?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-baseline gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
        <span>{label}</span>
        {hint && (
          <span className="text-[9px] font-semibold tracking-[0.06em] text-[color:var(--text-4)] normal-case">
            {hint}
          </span>
        )}
      </span>
      <span
        className="font-[family-name:var(--mono)] font-extrabold text-[22px] num"
        style={{ color: color ?? "var(--text)" }}
      >
        {value}
        {unit && (
          <span className="text-[12px] font-semibold text-[color:var(--text-3)] ml-1">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}
