"use client";

import { useEffect, useMemo, useState } from "react";
import type { WhoopGameMetric } from "@/lib/whoop/game-metrics";
import { WhoopConnectButton } from "@/components/bdl/whoop-connect-button";
import { WhoopSyncControls } from "@/components/bdl/whoop-sync-controls";

type Range = "MTD" | "YTD";

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
}: {
  playerId: string;
  connected: boolean;
  lastSyncAt: string | null;
  metrics: WhoopGameMetric[];
}) {
  const [range, setRange] = useState<Range>("MTD");
  const [visibleCount, setVisibleCount] = useState(YTD_PAGE_SIZE);

  // Reset pagination whenever the range tab changes — switching to
  // YTD shouldn't keep an arbitrarily-grown page count from a prior
  // session.
  useEffect(() => {
    setVisibleCount(YTD_PAGE_SIZE);
  }, [range]);

  const filtered = useMemo(() => {
    const now = new Date();
    const start =
      range === "MTD"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(now.getFullYear(), 0, 1);
    return metrics.filter((m) => new Date(m.date) >= start);
  }, [metrics, range]);

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
    };
  }, [filtered]);

  // "Last Game Strain" should represent an actual game session, so
  // skip DAY rows here too.
  const lastWithStrain =
    filtered.find((m) => m.source === "workout" && m.strain !== null) ?? null;

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
          {connected && metrics.length > 0 && (
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

      {connected && metrics.length === 0 && (
        <p className="text-[13px] text-[color:var(--text-3)] py-2">
          No BDL games on your roster yet. Once you&apos;re scheduled,
          we&apos;ll pull strain from the matching Whoop session.
        </p>
      )}

      {connected && metrics.length > 0 && (
        <>
          <div className="grid grid-cols-5 gap-3 max-md:grid-cols-3 max-sm:grid-cols-2">
            <SummaryBlock
              label={
                summary.scoredCount < summary.total
                  ? `Games · ${summary.scoredCount} scored`
                  : `Games · ${summary.total}`
              }
              value={`${summary.total}`}
            />
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
              label="Avg Hard Min"
              hint={
                summary.avgHighZonePct !== null
                  ? `Z4+5 · ${Math.round(summary.avgHighZonePct)}%`
                  : "Z4+5"
              }
              value={
                summary.avgHighZone !== null
                  ? Math.round(summary.avgHighZone).toString()
                  : "—"
              }
              unit="min"
            />
          </div>

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
                  Last Game Strain
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
              <div className="grid grid-cols-[1fr_44px_56px_64px_60px_60px_60px_92px] gap-3 pb-2 text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
                <span>Game</span>
                <span className="text-right">W/L</span>
                <span className="text-right">Source</span>
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
                    className="grid grid-cols-[1fr_44px_56px_64px_60px_60px_60px_92px] gap-3 items-center py-3"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[13px] font-semibold truncate">
                        {fmtDate(m.date)}
                      </span>
                      <span className="text-[11px] text-[color:var(--text-3)] truncate">
                        {m.leagueName ?? "—"}
                        {m.durationMin ? ` · ${m.durationMin}m` : ""}
                      </span>
                    </div>
                    {isUpcoming ? (
                      <div
                        className="col-span-7 flex justify-end"
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
  const pctColor =
    pct === null
      ? "var(--text-3)"
      : pctAboveAvg
        ? "var(--up)"
        : pct >= 60
          ? "var(--down)"
          : pct >= 40
            ? "#f97316"
            : pct >= 25
              ? "#eab308"
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
}: {
  label: string;
  hint?: string;
  value: string;
  unit?: string;
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
      <span className="font-[family-name:var(--mono)] font-extrabold text-[22px] num text-[color:var(--text)]">
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
