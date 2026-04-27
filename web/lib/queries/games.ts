import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  games,
  gameSubgames,
  leagues,
  leaguePlayers,
  players,
  gameRoster,
  type Game,
  type Player,
} from "@/lib/db";

export type GameListRow = {
  id: string;
  leagueId: string | null;
  leagueName: string | null;
  gameDate: string | null;
  gameTime: string | null;
  venue: string | null;
  format: Game["format"];
  teamAName: string;
  teamBName: string;
  scoreA: number | null;
  scoreB: number | null;
  winTeam: "A" | "B" | "Tie" | null;
  locked: boolean;
  gameWinner: string | null;
  gameWinnerName: string | null;
};

export type GamesFilter = {
  leagueId?: string | null;
  status?: "all" | "upcoming" | "completed";
};

export async function getGamesList(filter: GamesFilter = {}): Promise<GameListRow[]> {
  const heroPlayer = alias(players, "hero_player");
  const rows = await db
    .select({
      id: games.id,
      leagueId: games.leagueId,
      leagueName: games.leagueName,
      gameDate: games.gameDate,
      gameTime: games.gameTime,
      venue: games.venue,
      format: games.format,
      teamAName: games.teamAName,
      teamBName: games.teamBName,
      scoreA: games.scoreA,
      scoreB: games.scoreB,
      winTeam: games.winTeam,
      locked: games.locked,
      gameWinner: games.gameWinner,
      heroFirst: heroPlayer.firstName,
      heroLast: heroPlayer.lastName,
    })
    .from(games)
    .leftJoin(heroPlayer, eq(heroPlayer.id, games.gameWinner))
    .where(filter.leagueId ? eq(games.leagueId, filter.leagueId) : undefined)
    .orderBy(desc(games.gameDate));
  const all: GameListRow[] = rows.map((r) => ({
    id: r.id,
    leagueId: r.leagueId,
    leagueName: r.leagueName,
    gameDate: r.gameDate,
    gameTime: r.gameTime,
    venue: r.venue,
    format: r.format,
    teamAName: r.teamAName,
    teamBName: r.teamBName,
    scoreA: r.scoreA,
    scoreB: r.scoreB,
    winTeam: r.winTeam,
    locked: r.locked,
    gameWinner: r.gameWinner,
    gameWinnerName:
      r.heroFirst && r.heroLast ? `${r.heroFirst} ${r.heroLast}` : null,
  }));

  const completed = (g: GameListRow) =>
    (g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null;
  if (filter.status === "upcoming") return all.filter((g) => !completed(g));
  if (filter.status === "completed") return all.filter(completed);
  return all;
}

export type GameSubgameRow = {
  id: string;
  gameIndex: number;
  scoreA: number | null;
  scoreB: number | null;
  winTeam: "A" | "B" | "Tie" | null;
};

export type GameDetail = {
  game: Game & { leagueName: string | null };
  league: {
    id: string;
    name: string;
    teamAName: string;
    teamBName: string;
    format: string;
    seriesGameCount: number | null;
    seriesPointTarget: number | null;
  } | null;
  rosterA: Pick<Player, "id" | "firstName" | "lastName">[];
  rosterB: Pick<Player, "id" | "firstName" | "lastName">[];
  invited: Pick<Player, "id" | "firstName" | "lastName">[];
  eligible: Pick<Player, "id" | "firstName" | "lastName">[];
  allLeagues: { id: string; name: string }[];
  subgames: GameSubgameRow[];
};

export async function getGameDetail(id: string): Promise<GameDetail | null> {
  const [g] = await db.select().from(games).where(eq(games.id, id)).limit(1);
  if (!g) return null;

  const [league] = g.leagueId
    ? await db
        .select({
          id: leagues.id,
          name: leagues.name,
          teamAName: leagues.teamAName,
          teamBName: leagues.teamBName,
          format: leagues.format,
          seriesGameCount: leagues.seriesGameCount,
          seriesPointTarget: leagues.seriesPointTarget,
        })
        .from(leagues)
        .where(eq(leagues.id, g.leagueId))
        .limit(1)
    : [];

  const allRoster = await db
    .select({
      gameId: gameRoster.gameId,
      side: gameRoster.side,
      playerId: gameRoster.playerId,
      firstName: players.firstName,
      lastName: players.lastName,
    })
    .from(gameRoster)
    .innerJoin(players, eq(players.id, gameRoster.playerId))
    .where(eq(gameRoster.gameId, id))
    .orderBy(asc(players.lastName), asc(players.firstName));

  const rosterA = allRoster
    .filter((r) => r.side === "A")
    .map((r) => ({ id: r.playerId, firstName: r.firstName, lastName: r.lastName }));
  const rosterB = allRoster
    .filter((r) => r.side === "B")
    .map((r) => ({ id: r.playerId, firstName: r.firstName, lastName: r.lastName }));
  const invited = allRoster
    .filter((r) => r.side === "invited")
    .map((r) => ({ id: r.playerId, firstName: r.firstName, lastName: r.lastName }));

  // Eligible = league members not already on this game's roster
  let eligible: Pick<Player, "id" | "firstName" | "lastName">[] = [];
  if (g.leagueId) {
    const onRoster = new Set([
      ...rosterA.map((p) => p.id),
      ...rosterB.map((p) => p.id),
      ...invited.map((p) => p.id),
    ]);
    const memberRows = await db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
      })
      .from(players)
      .innerJoin(leaguePlayers, eq(leaguePlayers.playerId, players.id))
      .where(eq(leaguePlayers.leagueId, g.leagueId))
      .orderBy(asc(players.lastName), asc(players.firstName));
    eligible = memberRows.filter((p) => !onRoster.has(p.id));
  }

  const allLeagues = await db
    .select({ id: leagues.id, name: leagues.name })
    .from(leagues)
    .orderBy(asc(leagues.name));

  const subgames = await db
    .select({
      id: gameSubgames.id,
      gameIndex: gameSubgames.gameIndex,
      scoreA: gameSubgames.scoreA,
      scoreB: gameSubgames.scoreB,
      winTeam: gameSubgames.winTeam,
    })
    .from(gameSubgames)
    .where(eq(gameSubgames.gameId, id))
    .orderBy(asc(gameSubgames.gameIndex));

  return {
    game: g,
    league: league ?? null,
    rosterA,
    rosterB,
    invited,
    eligible,
    allLeagues,
    subgames,
  };
}

/**
 * Lightweight roster fetch — just the names per side. Used by next-up
 * hero cards on /games and the home dashboard so they can show the
 * matchup if it's been locked in. Returns empty arrays if no roster
 * is set yet.
 */
export async function getGameRosterLite(gameId: string): Promise<{
  A: Pick<Player, "id" | "firstName" | "lastName">[];
  B: Pick<Player, "id" | "firstName" | "lastName">[];
}> {
  const rows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      side: gameRoster.side,
    })
    .from(gameRoster)
    .innerJoin(players, eq(players.id, gameRoster.playerId))
    .where(eq(gameRoster.gameId, gameId))
    .orderBy(asc(players.lastName), asc(players.firstName));

  const A = rows
    .filter((r) => r.side === "A")
    .map((r) => ({ id: r.id, firstName: r.firstName, lastName: r.lastName }));
  const B = rows
    .filter((r) => r.side === "B")
    .map((r) => ({ id: r.id, firstName: r.firstName, lastName: r.lastName }));
  return { A, B };
}

/**
 * Win/loss totals (and derived win %) for a set of players, scoped to
 * one league. Used by the upcoming-game roster rows to show each
 * player's career rate next to their name.
 */
export async function getPlayerWinPctsForLeague(
  leagueId: string,
  playerIds: string[],
): Promise<Map<string, { wins: number; losses: number; pct: number | null }>> {
  const out = new Map<string, { wins: number; losses: number; pct: number | null }>();
  if (playerIds.length === 0) return out;

  const rows = await db
    .select({
      playerId: gameRoster.playerId,
      side: gameRoster.side,
      scoreA: games.scoreA,
      scoreB: games.scoreB,
      winTeam: games.winTeam,
    })
    .from(gameRoster)
    .innerJoin(games, eq(games.id, gameRoster.gameId))
    .where(
      and(
        inArray(gameRoster.playerId, playerIds),
        inArray(gameRoster.side, ["A", "B"]),
        eq(games.leagueId, leagueId),
      ),
    );

  for (const r of rows) {
    const decided =
      r.winTeam ??
      (r.scoreA !== null && r.scoreB !== null
        ? r.scoreA > r.scoreB
          ? "A"
          : r.scoreB > r.scoreA
            ? "B"
            : "Tie"
        : null);
    if (!decided || decided === "Tie") continue;
    const cur = out.get(r.playerId) ?? { wins: 0, losses: 0, pct: null };
    if (r.side === decided) cur.wins++;
    else cur.losses++;
    out.set(r.playerId, cur);
  }
  for (const [id, s] of out) {
    const total = s.wins + s.losses;
    s.pct = total > 0 ? (s.wins / total) * 100 : null;
    out.set(id, s);
  }
  return out;
}

/**
 * Next upcoming game in a league — no player context, no auth gating.
 * Used by the league detail page (signed-out + signed-in alike) to
 * surface the next session at a glance.
 */
export async function getLeagueNextGame(leagueId: string): Promise<{
  id: string;
  date: string | null;
  time: string | null;
  venue: string | null;
  teamAName: string;
  teamBName: string;
  rosterA: Pick<Player, "id" | "firstName" | "lastName">[];
  rosterB: Pick<Player, "id" | "firstName" | "lastName">[];
} | null> {
  const today = new Date().toISOString().slice(0, 10);
  const open = await db
    .select()
    .from(games)
    .where(eq(games.leagueId, leagueId))
    .orderBy(asc(games.gameDate));
  const next = open.find(
    (g) =>
      !((g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null) &&
      (g.gameDate ?? "") >= today,
  );
  if (!next) return null;
  const { A, B } = await getGameRosterLite(next.id);
  return {
    id: next.id,
    date: next.gameDate,
    time: next.gameTime,
    venue: next.venue,
    teamAName: next.teamAName ?? "White",
    teamBName: next.teamBName ?? "Dark",
    rosterA: A,
    rosterB: B,
  };
}

/**
 * Team-vs-team win probability blending two signals:
 *
 *   Team-color trend (T_x): win rate of each side (A / B) over the
 *   last `lookback` (default 8) completed league games. Captures any
 *   streak or color-bias in how the league has been playing recently.
 *
 *   Roster strength (P_x): average career win % within this league
 *   for the players currently rostered on each side (unrated players
 *   skipped). Captures who's actually on the floor for THIS game.
 *
 * Score for each side = teamWeight·T + (1 − teamWeight)·P, then the
 * two sides are normalized to sum to 100. teamWeight defaults to 0.3
 * (rosters carry most of the signal because team-color is just a
 * jersey label that flips game-to-game in pickup).
 *
 * Falls back to whichever signal has data when one is missing, and
 * returns null only when both are empty.
 */
export async function getMatchupOdds(
  leagueId: string,
  rosterAIds: string[],
  rosterBIds: string[],
  opts: { lookback?: number; teamWeight?: number; format?: Game["format"] } = {},
): Promise<{
  probA: number;
  probB: number;
  basis: "blend" | "team" | "roster";
  sample: {
    teamGames: number;
    ratedA: number;
    ratedB: number;
    avgPctA: number | null;
    avgPctB: number | null;
  };
  predictedScore: { a: number; b: number } | null;
} | null> {
  const lookback = opts.lookback ?? 8;
  const wTeam = opts.teamWeight ?? 0.3;
  const wRoster = 1 - wTeam;

  // 1. Team-color base rate over the last `lookback` completed games.
  // Pull the league's race-to-N target alongside, so the predicted-score
  // model can cap the winner instead of using an open-ended average.
  const [last, leagueRow] = await Promise.all([
    db
      .select({
        scoreA: games.scoreA,
        scoreB: games.scoreB,
        winTeam: games.winTeam,
      })
      .from(games)
      .where(eq(games.leagueId, leagueId))
      .orderBy(desc(games.gameDate))
      .limit(lookback * 4), // overshoot to skip ties / unfinished
    db
      .select({ playToScore: leagues.playToScore })
      .from(leagues)
      .where(eq(leagues.id, leagueId))
      .limit(1),
  ]);
  const playTo = leagueRow[0]?.playToScore ?? null;

  let aW = 0,
    aTot = 0,
    bW = 0,
    bTot = 0,
    teamGames = 0;
  // Average total points across decided games with both scores —
  // feeds the predicted-score model below.
  let totalPointsSum = 0;
  let totalPointsN = 0;
  for (const g of last) {
    if (teamGames >= lookback) break;
    const decided =
      g.winTeam ??
      (g.scoreA !== null && g.scoreB !== null
        ? g.scoreA > g.scoreB
          ? "A"
          : g.scoreB > g.scoreA
            ? "B"
            : "Tie"
        : null);
    if (!decided) continue;
    teamGames++;
    if (g.scoreA !== null && g.scoreB !== null) {
      totalPointsSum += g.scoreA + g.scoreB;
      totalPointsN++;
    }
    if (decided === "Tie") continue;
    if (decided === "A") {
      aW++;
      aTot++;
      bTot++;
    } else {
      bW++;
      bTot++;
      aTot++;
    }
  }
  const hasTeamData = aTot > 0 && bTot > 0;
  const T_A = hasTeamData ? aW / aTot : 0.5;
  const T_B = hasTeamData ? bW / bTot : 0.5;

  // 2. Roster strength — avg of each side's rated players' win %.
  const allIds = Array.from(new Set([...rosterAIds, ...rosterBIds]));
  const pcts =
    allIds.length > 0
      ? await getPlayerWinPctsForLeague(leagueId, allIds)
      : new Map<string, { wins: number; losses: number; pct: number | null }>();
  const ratedAvg = (ids: string[]): { avg: number; n: number } => {
    let sum = 0;
    let n = 0;
    for (const id of ids) {
      const s = pcts.get(id);
      if (s && s.pct !== null) {
        sum += s.pct / 100;
        n++;
      }
    }
    return n > 0 ? { avg: sum / n, n } : { avg: 0.5, n: 0 };
  };
  const ra = ratedAvg(rosterAIds);
  const rb = ratedAvg(rosterBIds);
  const hasRosterData = ra.n > 0 && rb.n > 0;

  // 3. Need at least one signal.
  if (!hasTeamData && !hasRosterData) return null;

  // 4. Blend (or fall back to the side with data).
  let aScore: number;
  let bScore: number;
  let basis: "blend" | "team" | "roster";
  if (hasTeamData && hasRosterData) {
    aScore = wTeam * T_A + wRoster * ra.avg;
    bScore = wTeam * T_B + wRoster * rb.avg;
    basis = "blend";
  } else if (hasTeamData) {
    aScore = T_A;
    bScore = T_B;
    basis = "team";
  } else {
    aScore = ra.avg;
    bScore = rb.avg;
    basis = "roster";
  }

  // 5. Normalize and round.
  const denom = aScore + bScore || 1;
  const probA = Math.round((aScore / denom) * 100);
  const probB = 100 - probA;

  // 6. Predicted final score. Gated on rosters so we don't imply
  // precision from team-color noise alone. Two models:
  //   playTo set → race-to-N: winner = N, loser = N · (1 − 0.30·margin).
  //   else → average-total: spread capped at ~20% of total.
  let predictedScore: { a: number; b: number } | null = null;
  if (hasRosterData) {
    const margin = Math.abs(probA - 50) / 50; // 0..1
    if (playTo && playTo > 0) {
      const winner = playTo;
      const loser = Math.max(0, Math.round(playTo * (1 - 0.3 * margin)));
      predictedScore =
        probA >= probB ? { a: winner, b: loser } : { a: loser, b: winner };
    } else {
      const fallback =
        opts.format === "3v3" || opts.format === "3v3-series" ? 60 : 80;
      const total = totalPointsN > 0 ? totalPointsSum / totalPointsN : fallback;
      const spread = total * (probA / 100 - 0.5) * 2 * 0.2;
      predictedScore = {
        a: Math.max(0, Math.round((total + spread) / 2)),
        b: Math.max(0, Math.round((total - spread) / 2)),
      };
    }
  }

  return {
    probA,
    probB,
    basis,
    sample: {
      teamGames,
      ratedA: ra.n,
      ratedB: rb.n,
      avgPctA: ra.n > 0 ? Math.round(ra.avg * 100) : null,
      avgPctB: rb.n > 0 ? Math.round(rb.avg * 100) : null,
    },
    predictedScore,
  };
}

// Suppress unused-import warnings if any
export const __gamesQueryMarker = sql`/* games */`;
