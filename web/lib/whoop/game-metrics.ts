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

/** Bounding window for the workout fetch, on top of the game date
 *  range. Generous so we don't miss workouts that span midnight in
 *  any reasonable timezone interpretation. */
const FETCH_BUFFER_MS = 24 * 60 * 60 * 1000;

/** Default IANA timezone for game/workout date alignment. BDL is
 *  Nashville-based, so Central is a safe default; future leagues
 *  can override via leagues.timezone if/when we add that column. */
const DEFAULT_TZ = "America/Chicago";

function localDateString(d: Date, tz: string): string {
  // en-CA emits ISO YYYY-MM-DD which matches games.gameDate exactly.
  return d.toLocaleDateString("en-CA", { timeZone: tz });
}

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
  /** Minutes spent in each Whoop HR zone (0–5). null when the source
   *  is a cycle (cycles don't expose per-zone breakdowns) or the
   *  workout score state didn't include zone data. */
  zoneMin: [number, number, number, number, number, number] | null;
  /** Time at high intensity (Z4 + Z5) in minutes. Convenience for
   *  the UI; computed from zoneMin. */
  highZoneMin: number | null;
};

function combineDateTime(dateStr: string, timeStr: string | null): Date {
  // gameDate is YYYY-MM-DD, gameTime is HH:MM:SS (or null). Used only
  // for sort ordering and the bounding query; per-game *matching*
  // happens on calendar-date equality below, which dodges the
  // server-runs-in-UTC vs game-time-is-local mismatch.
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

  // Compute a sortable timestamp for each row. Drop games without a
  // date. The actual workout-to-game match below uses calendar dates
  // in DEFAULT_TZ rather than these timestamps.
  const gamesWithWindow = rosterRows
    .filter((r): r is typeof r & { gameDate: string } => !!r.gameDate)
    .map((r) => {
      const start = combineDateTime(r.gameDate, r.gameTime);
      return { ...r, gameStart: start };
    });

  if (gamesWithWindow.length === 0) return [];

  const earliest = new Date(
    Math.min(...gamesWithWindow.map((g) => g.gameStart.getTime())) -
      FETCH_BUFFER_MS,
  );
  const latest = new Date(
    Math.max(...gamesWithWindow.map((g) => g.gameStart.getTime())) +
      FETCH_BUFFER_MS,
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
        zone0Sec: whoopWorkouts.zone0Sec,
        zone1Sec: whoopWorkouts.zone1Sec,
        zone2Sec: whoopWorkouts.zone2Sec,
        zone3Sec: whoopWorkouts.zone3Sec,
        zone4Sec: whoopWorkouts.zone4Sec,
        zone5Sec: whoopWorkouts.zone5Sec,
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
    // Match by calendar date in the league's local timezone. Server
    // typically runs in UTC, gameTime is wall-clock without an
    // offset, and Whoop returns UTC timestamps — direct Date math
    // skews matches by 5+ hours. Date-string equality dodges that.
    const candidates = workouts.filter((w) => {
      const startStr = localDateString(w.date, DEFAULT_TZ);
      const endStr = localDateString(w.endDate ?? w.date, DEFAULT_TZ);
      return startStr === g.gameDate || endStr === g.gameDate;
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
      const zones = zoneMinutesFrom(best);
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
        zoneMin: zones,
        highZoneMin: zones ? zones[4] + zones[5] : null,
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
        zoneMin: null,
        highZoneMin: null,
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
      zoneMin: null,
      highZoneMin: null,
    };
  });
}

/**
 * "All Other" basketball workouts — every Whoop session tagged as
 * basketball whose date does NOT coincide with one of the player's
 * BDL games. Useful for tracking pickup/open-gym sessions outside
 * scheduled league play. Same WhoopGameMetric shape so the table
 * column layout is reused without conditionals; outcome and league
 * are null since there's no scheduled game to attach to.
 */
export async function getPlayerOtherBasketballWorkouts(
  playerId: string,
  limit = 200,
): Promise<WhoopGameMetric[]> {
  // Pull every basketball workout since the backfill cutoff, plus the
  // dates of all BDL games on the player's roster — anything matching
  // a roster date is already shown in the "By League" tab and is
  // excluded here.
  const [workouts, rosterRows] = await Promise.all([
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
        zone0Sec: whoopWorkouts.zone0Sec,
        zone1Sec: whoopWorkouts.zone1Sec,
        zone2Sec: whoopWorkouts.zone2Sec,
        zone3Sec: whoopWorkouts.zone3Sec,
        zone4Sec: whoopWorkouts.zone4Sec,
        zone5Sec: whoopWorkouts.zone5Sec,
      })
      .from(whoopWorkouts)
      .where(
        and(
          eq(whoopWorkouts.playerId, playerId),
          eq(whoopWorkouts.sportName, "basketball"),
        ),
      )
      .orderBy(desc(whoopWorkouts.date))
      .limit(limit),
    db
      .select({ gameDate: games.gameDate })
      .from(gameRoster)
      .innerJoin(games, eq(games.id, gameRoster.gameId))
      .where(
        and(
          eq(gameRoster.playerId, playerId),
          inArray(gameRoster.side, ["A", "B", "invited"]),
        ),
      ),
  ]);

  const leagueDates = new Set(
    rosterRows.map((r) => r.gameDate).filter((d): d is string => !!d),
  );

  return workouts
    .filter((w) => {
      const dateStr = localDateString(w.date, DEFAULT_TZ);
      return !leagueDates.has(dateStr);
    })
    .map((w): WhoopGameMetric => {
      const zones = zoneMinutesFrom(w);
      return {
        gameId: `wkt:${w.id}`,
        date: w.date.toISOString(),
        leagueId: null,
        leagueName: null,
        side: "A",
        scoreA: null,
        scoreB: null,
        winTeam: null,
        outcome: null,
        source: "workout",
        strain: w.strain,
        avgHr: w.avgHr,
        maxHr: w.maxHr,
        calories: w.calories,
        durationMin: w.durationMin,
        sportName: w.sportName,
        zoneMin: zones,
        highZoneMin: zones ? zones[4] + zones[5] : null,
      };
    });
}

function zoneMinutesFrom(w: {
  zone0Sec: number | null;
  zone1Sec: number | null;
  zone2Sec: number | null;
  zone3Sec: number | null;
  zone4Sec: number | null;
  zone5Sec: number | null;
}): WhoopGameMetric["zoneMin"] {
  const cells = [
    w.zone0Sec,
    w.zone1Sec,
    w.zone2Sec,
    w.zone3Sec,
    w.zone4Sec,
    w.zone5Sec,
  ];
  // If every zone is null, the workout didn't have a scored zone
  // breakdown — return null so the UI can render a dash.
  if (cells.every((c) => c === null)) return null;
  return cells.map((c) => Math.round((c ?? 0) / 60)) as WhoopGameMetric["zoneMin"];
}
