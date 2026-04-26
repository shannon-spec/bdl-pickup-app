import { alias } from "drizzle-orm/pg-core";
import { asc, desc, eq, sql } from "drizzle-orm";
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

// Suppress unused-import warnings if any
export const __gamesQueryMarker = sql`/* games */`;
