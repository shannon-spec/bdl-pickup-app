import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  games,
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

export type GameDetail = {
  game: Game & { leagueName: string | null };
  league: { id: string; name: string; teamAName: string; teamBName: string } | null;
  rosterA: Pick<Player, "id" | "firstName" | "lastName">[];
  rosterB: Pick<Player, "id" | "firstName" | "lastName">[];
  invited: Pick<Player, "id" | "firstName" | "lastName">[];
  eligible: Pick<Player, "id" | "firstName" | "lastName">[];
  allLeagues: { id: string; name: string }[];
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

  return {
    game: g,
    league: league ?? null,
    rosterA,
    rosterB,
    invited,
    eligible,
    allLeagues,
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
 * Team-vs-team A/B win probability for an upcoming game in `leagueId`.
 * Walks the last 5 completed games in the same league and converts each
 * side's win rate into a normalized 0–100 split, matching the
 * /games hero card. Returns null if there's nothing to base it on.
 */
export async function getLeagueLastFiveOdds(
  leagueId: string,
): Promise<{ probA: number; probB: number } | null> {
  const last = await db
    .select({
      scoreA: games.scoreA,
      scoreB: games.scoreB,
      winTeam: games.winTeam,
    })
    .from(games)
    .where(eq(games.leagueId, leagueId))
    .orderBy(desc(games.gameDate))
    .limit(20);
  // Filter to completed and take the most recent 5 chronologically.
  const completed = last
    .filter(
      (g) => (g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null,
    )
    .slice(0, 5);
  if (completed.length === 0) return null;
  let aW = 0, aTot = 0, bW = 0, bTot = 0;
  for (const g of completed) {
    const w =
      g.winTeam ??
      (g.scoreA !== null && g.scoreB !== null
        ? g.scoreA > g.scoreB
          ? "A"
          : g.scoreB > g.scoreA
            ? "B"
            : "Tie"
        : null);
    if (!w || w === "Tie") continue;
    if (w === "A") {
      aW++; aTot++; bTot++;
    } else {
      bW++; bTot++; aTot++;
    }
  }
  const aRate = aTot > 0 ? aW / aTot : 0.5;
  const bRate = bTot > 0 ? bW / bTot : 0.5;
  const denom = aRate + bRate || 1;
  const probA = Math.round((aRate / denom) * 100);
  return { probA, probB: 100 - probA };
}

// Suppress unused-import warnings if any
export const __gamesQueryMarker = sql`/* games */`;
