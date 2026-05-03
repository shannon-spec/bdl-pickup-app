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
  /** Estimated basketball steps for the day.
   *
   *  Method: total steps on the game day (from whoopCycles) minus the
   *  player's average daily steps on days with NO basketball session.
   *  That baseline captures routine walking/activity so we isolate the
   *  increment attributable to basketball.
   *
   *  Null when: (a) no cycle step data exists for the day, (b) there
   *  are fewer than 3 non-basketball days with step data (baseline
   *  too thin to trust), or (c) the estimate is negative (clipped to
   *  null so we never show a nonsensical value).
   */
  estSteps: number | null;
  /** Total steps on the game day as reported by Whoop — raw value
   *  before baseline subtraction. Null when no cycle data exists. */
  totalStepsOnDay: number | null;
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
        steps: whoopCycles.steps,
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

  // Build a set of all basketball-activity dates so we can exclude
  // them when computing the "rest-of-life" step baseline.
  const basketballDates = new Set(
    workouts.map((w) => localDateString(w.date, DEFAULT_TZ)),
  );

  // Also mark every BDL game date as a basketball day even when no
  // Whoop workout was found (the player still played that day).
  for (const g of gamesWithWindow) {
    if (g.gameDate) basketballDates.add(g.gameDate);
  }

  // Baseline: average daily steps on days WITHOUT any basketball.
  // Require at least 3 qualifying days so the estimate is meaningful.
  const nonBballSteps = [...cycleByDate.values()]
    .filter((c) => !basketballDates.has(c.date) && c.steps !== null && c.steps !== undefined)
    .map((c) => c.steps as number);

  const baselineAvgSteps =
    nonBballSteps.length >= 3
      ? Math.round(nonBballSteps.reduce((s, n) => s + n, 0) / nonBballSteps.length)
      : null;

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

    // Steps estimation — shared across all three branches.
    const dayCycle = cycleByDate.get(g.gameDate);
    const totalStepsOnDay = dayCycle?.steps ?? null;
    const estSteps =
      totalStepsOnDay !== null && baselineAvgSteps !== null
        ? Math.max(0, totalStepsOnDay - baselineAvgSteps) || null
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
        estSteps,
        totalStepsOnDay,
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
        estSteps,
        totalStepsOnDay,
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
      estSteps: null,
      totalStepsOnDay: null,
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
  const [workouts, rosterRows, allCycles] = await Promise.all([
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
    db
      .select({ date: whoopCycles.date, steps: whoopCycles.steps })
      .from(whoopCycles)
      .where(eq(whoopCycles.playerId, playerId)),
  ]);

  // Build cycle steps map and compute baseline for other-basketball sessions.
  const cycleStepsByDate = new Map<string, number>();
  for (const c of allCycles) {
    if (c.steps !== null && c.steps !== undefined) {
      const existing = cycleStepsByDate.get(c.date);
      if (!existing || c.steps > existing) cycleStepsByDate.set(c.date, c.steps);
    }
  }

  const leagueDatesSet = new Set(
    rosterRows.map((r) => r.gameDate).filter((d): d is string => !!d),
  );
  const workoutDates = new Set(
    workouts.map((w) => localDateString(w.date, DEFAULT_TZ)),
  );
  const allBasketballDates = new Set([...leagueDatesSet, ...workoutDates]);

  const nonBballStepsOther = [...cycleStepsByDate.entries()]
    .filter(([date]) => !allBasketballDates.has(date))
    .map(([, s]) => s);

  const baselineOther =
    nonBballStepsOther.length >= 3
      ? Math.round(nonBballStepsOther.reduce((s, n) => s + n, 0) / nonBballStepsOther.length)
      : null;

  return workouts
    .filter((w) => {
      const dateStr = localDateString(w.date, DEFAULT_TZ);
      return !leagueDatesSet.has(dateStr);
    })
    .map((w): WhoopGameMetric => {
      const zones = zoneMinutesFrom(w);
      const dateStr = localDateString(w.date, DEFAULT_TZ);
      const totalStepsOnDay = cycleStepsByDate.get(dateStr) ?? null;
      const estSteps =
        totalStepsOnDay !== null && baselineOther !== null
          ? Math.max(0, totalStepsOnDay - baselineOther) || null
          : null;
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
        estSteps,
        totalStepsOnDay,
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
