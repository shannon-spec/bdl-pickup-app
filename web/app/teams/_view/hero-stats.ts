import type { TeamGameRow } from "@/lib/queries/teams";
import type { TeamHeroStats } from "./team-page-view";

/**
 * Team-wide aggregates across completed games, from the perspective of the
 * given team id (whichever side the rows place it on). Ties are excluded
 * from W/L; margin averages every decided game; PPM uses only games with a
 * recorded length.
 */
export function computeHeroStats(
  games: TeamGameRow[],
  teamId: string,
): TeamHeroStats {
  let wins = 0;
  let losses = 0;
  let marginSum = 0;
  let decidedCount = 0;
  let pointsTotal = 0;
  let minutesTotal = 0;
  for (const g of games) {
    const isA = g.teamAId === teamId;
    const sA = g.scoreA;
    const sB = g.scoreB;
    const decided =
      g.winTeam ??
      (sA !== null && sB !== null
        ? sA > sB
          ? "A"
          : sB > sA
            ? "B"
            : "Tie"
        : null);
    if (decided === null) continue;
    const myScore = isA ? sA : sB;
    const oppScore = isA ? sB : sA;
    if (myScore !== null && oppScore !== null) {
      marginSum += myScore - oppScore;
      decidedCount++;
    }
    if (decided !== "Tie") {
      if ((decided === "A") === isA) wins++;
      else losses++;
    }
    if (g.gameLengthMinutes && g.gameLengthMinutes > 0 && myScore !== null) {
      pointsTotal += myScore;
      minutesTotal += g.gameLengthMinutes;
    }
  }
  const decidedTotal = wins + losses;
  return {
    wins,
    losses,
    winPct: decidedTotal > 0 ? (wins / decidedTotal) * 100 : null,
    avgMargin: decidedCount > 0 ? marginSum / decidedCount : null,
    ppm: minutesTotal > 0 ? pointsTotal / minutesTotal : null,
    hasStats: decidedCount > 0 || decidedTotal > 0,
  };
}
