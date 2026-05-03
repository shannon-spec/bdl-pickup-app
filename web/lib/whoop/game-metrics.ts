/**
 * Pair Whoop strain to BDL games on the player's roster.
 *
 * For each game the player was rostered on (side A or B), we look for
 * a Whoop workout whose [start, end] overlaps the game's scheduled
 * window. If we find one, we attach its strain/HR/calories as the
 * "game" metric. If not, we fall back to the day's cycle (whole-day
 * strain) so the player still sees something on game day.
 *
 * The matching window is generous (±90 minutes around the scheduled
 * start) because BDL games rarely tip exactly on time and Whoop's
 * auto-detection can start the workout a few minutes early.
 */
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  db,
  gameRoster,
  games,
  whoopCycles,
  whoopWorkouts,
} from "@/lib/db";

const MATCH_WINDOW_MS = 90 * 60 * 1000;
const ASSUMED_GAME_MIN = 90;

export type WhoopGameMetric = {
  gameId: string;
  date: string; // ISO of game's scheduled start (UTC)
  leagueId: string | null;
  leagueName: string | null;
  side: "A" | "B" | "invited";
  scoreA: number | null;
  scoreB: number | null;
  winTeam: "A" | "B" | "Tie" | null;
  /** Resolved outcome from the player's perspective. */
  outcome: "W" | "L" | "T" | null;
  source: "workout" | "cycle" | "none";
  strain: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  durationMin: number | null;
  sportName: string | null;
};

function combineDateTime(dateStr: string, timeStr: string | null): Date {
  // gameDate is YYYY-MM-DD, gameTime is HH:MM:SS (or null). Treat as
  // local-naive — Whoop ISO timestamps include offset, so as long as
  // both sides anchor to the player's wall clock the overlap math
  // holds. JS Date constructor on "YYYY-MM-DDTHH:MM:SS" parses as
  // local time, which matches how the user thinks about game time.
  const t = timeStr ?? "12:00:00";
  return new Date(`${dateStr}T${t}`);
}

/**
 * Returns one row per BDL game on the player's roster, newest first,
 * with attached strain. Limit caps the rows scanned — the page only
 * displays a recent slice.
 */
export async function getPlayerWhoopGameMetrics(
  playerId: string,
  limit = 200,
): Promise<WhoopGameMetric[]> {
  // 1) Pull rostered games (A/B/invited) for this player, newest first.
  const rosterRows = await db
    .select({
      gameId: games.id,
      gameDate: games.gameDate,
      gameTime: games.gameTime,
      leagueId: games.leagueId,
      leagueName: games.leagueName,
      side: gameRoster.side,
      scoreA: games.scoreA,
      scoreB: games.scoreB,
      winTeam: games.winTeam,
    })
    .from(gameRoster)
    .innerJoin(games, eq(games.id, gameRoster.gameId))
    .where(
      and(
        eq(gameRoster.playerId, playerId),
        inArray(gameRoster.side, ["A", "B", "invited"]),
      ),
    )
    .orderBy(desc(games.gameDate), desc(games.gameTime))
    .limit(limit);

  if (rosterRows.length === 0) return [];

  // Compute the game window for each row. Drop games without a date.
  const gamesWithWindow = rosterRows
    .filter((r): r is typeof r & { gameDate: string } => !!r.gameDate)
    .map((r) => {
      const start = combineDateTime(r.gameDate, r.gameTime);
      const end = new Date(start.getTime() + ASSUMED_GAME_MIN * 60_000);
      return { ...r, gameStart: start, gameEnd: end };
    });

  if (gamesWithWindow.length === 0) return [];

  const earliest = new Date(
    Math.min(...gamesWithWindow.map((g) => g.gameStart.getTime())) -
      MATCH_WINDOW_MS,
  );
  const latest = new Date(
    Math.max(...gamesWithWindow.map((g) => g.gameEnd.getTime())) +
      MATCH_WINDOW_MS,
  );

  // 2) Pull all workouts in the bounding window, plus all cycles by date.
  const [workouts, cycles] = await Promise.all([
    db
      .select({
        id: whoopWorkouts.id,
        date: whoopWorkouts.date,
        endDate: whoopWorkouts.endDate,
        durationMin: whoopWorkouts.durationMin,
        strain: whoopWorkouts.strain,
        avgHr: whoopWorkouts.avgHr,
        maxHr: whoopWorkouts.maxHr,
        calories: whoopWorkouts.calories,
        sportName: whoopWorkouts.sportName,
      })
      .from(whoopWorkouts)
      .where(
        and(
          eq(whoopWorkouts.playerId, playerId),
          gte(whoopWorkouts.date, earliest),
          lte(whoopWorkouts.date, latest),
        ),
      ),
    db
      .select({
        date: whoopCycles.date,
        dayStrain: whoopCycles.dayStrain,
        avgHr: whoopCycles.avgHr,
        maxHr: whoopCycles.maxHr,
        calories: whoopCycles.calories,
      })
      .from(whoopCycles)
      .where(eq(whoopCycles.playerId, playerId)),
  ]);

  // Whoop can emit multiple cycles per calendar day during sleep
  // schedule shifts. When collapsing, keep the one with the highest
  // day_strain — that's the one that captured the active session.
  const cycleByDate = new Map<string, (typeof cycles)[number]>();
  for (const c of cycles) {
    const existing = cycleByDate.get(c.date);
    if (!existing || (c.dayStrain ?? -1) > (existing.dayStrain ?? -1)) {
      cycleByDate.set(c.date, c);
    }
  }

  // 3) For each game, find the best-matching workout.
  return gamesWithWindow.map((g): WhoopGameMetric => {
    const winStart = g.gameStart.getTime() - MATCH_WINDOW_MS;
    const winEnd = g.gameEnd.getTime() + MATCH_WINDOW_MS;

    const candidates = workouts.filter((w) => {
      const wStart = w.date.getTime();
      const wEnd = (w.endDate ?? w.date).getTime();
      // Overlap test: workout's [start, end] intersects the game window.
      return wStart <= winEnd && wEnd >= winStart;
    });

    const outcome: "W" | "L" | "T" | null =
      g.winTeam === "Tie"
        ? "T"
        : g.winTeam && (g.side === "A" || g.side === "B")
          ? g.side === g.winTeam
            ? "W"
            : "L"
          : null;

    if (candidates.length > 0) {
      candidates.sort((a, b) => (b.strain ?? -1) - (a.strain ?? -1));
      const best = candidates[0];
      return {
        gameId: g.gameId,
        date: g.gameStart.toISOString(),
        leagueId: g.leagueId,
        leagueName: g.leagueName,
        side: g.side,
        scoreA: g.scoreA,
        scoreB: g.scoreB,
        winTeam: g.winTeam,
        outcome,
        source: "workout",
        strain: best.strain,
        avgHr: best.avgHr,
        maxHr: best.maxHr,
        calories: best.calories,
        durationMin: best.durationMin,
        sportName: best.sportName,
      };
    }

    const cycle = cycleByDate.get(g.gameDate);
    if (cycle) {
      return {
        gameId: g.gameId,
        date: g.gameStart.toISOString(),
        leagueId: g.leagueId,
        leagueName: g.leagueName,
        side: g.side,
        scoreA: g.scoreA,
        scoreB: g.scoreB,
        winTeam: g.winTeam,
        outcome,
        source: "cycle",
        strain: cycle.dayStrain,
        avgHr: cycle.avgHr,
        maxHr: cycle.maxHr,
        calories: cycle.calories,
        durationMin: null,
        sportName: null,
      };
    }

    return {
      gameId: g.gameId,
      date: g.gameStart.toISOString(),
      leagueId: g.leagueId,
      leagueName: g.leagueName,
      side: g.side,
      scoreA: g.scoreA,
      scoreB: g.scoreB,
      winTeam: g.winTeam,
      outcome,
      source: "none",
      strain: null,
      avgHr: null,
      maxHr: null,
      calories: null,
      durationMin: null,
      sportName: null,
    };
  });
}
