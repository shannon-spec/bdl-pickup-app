import { asc, count, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  leagues,
  leaguePlayers,
  leagueCommissioners,
  games,
  players,
  type League,
  type Player,
} from "@/lib/db";

export type LeagueListRow = League & {
  playerCount: number;
  totalGames: number;
  completedGames: number;
};

export async function getLeaguesWithStats(): Promise<LeagueListRow[]> {
  const all = await db.select().from(leagues).orderBy(asc(leagues.name));
  if (all.length === 0) return [];
  const ids = all.map((l) => l.id);

  const playerCounts = await db
    .select({ leagueId: leaguePlayers.leagueId, n: count() })
    .from(leaguePlayers)
    .where(inArray(leaguePlayers.leagueId, ids))
    .groupBy(leaguePlayers.leagueId);

  const totalCounts = await db
    .select({ leagueId: games.leagueId, n: count() })
    .from(games)
    .where(inArray(games.leagueId, ids))
    .groupBy(games.leagueId);

  const completedCounts = await db
    .select({ leagueId: games.leagueId, n: count() })
    .from(games)
    .where(
      sql`${games.leagueId} IN ${ids} AND ((${games.scoreA} IS NOT NULL AND ${games.scoreB} IS NOT NULL) OR ${games.winTeam} IS NOT NULL)`,
    )
    .groupBy(games.leagueId);

  const pcMap = new Map(playerCounts.map((r) => [r.leagueId, Number(r.n)]));
  const tMap = new Map(totalCounts.map((r) => [r.leagueId, Number(r.n)]));
  const cMap = new Map(completedCounts.map((r) => [r.leagueId, Number(r.n)]));

  return all.map((l) => ({
    ...l,
    playerCount: pcMap.get(l.id) ?? 0,
    totalGames: tMap.get(l.id) ?? 0,
    completedGames: cMap.get(l.id) ?? 0,
  }));
}

export type LeagueDetail = {
  league: League;
  members: Pick<Player, "id" | "firstName" | "lastName" | "level" | "status">[];
  commissioners: Pick<Player, "id" | "firstName" | "lastName">[];
  totalGames: number;
  completedGames: number;
  allPlayers: Pick<Player, "id" | "firstName" | "lastName">[];
};

export async function getLeagueDetail(id: string): Promise<LeagueDetail | null> {
  const [league] = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  if (!league) return null;

  const members = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      level: players.level,
      status: players.status,
    })
    .from(players)
    .innerJoin(leaguePlayers, eq(leaguePlayers.playerId, players.id))
    .where(eq(leaguePlayers.leagueId, id))
    .orderBy(asc(players.lastName), asc(players.firstName));

  const commissioners = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
    })
    .from(players)
    .innerJoin(leagueCommissioners, eq(leagueCommissioners.playerId, players.id))
    .where(eq(leagueCommissioners.leagueId, id))
    .orderBy(asc(players.lastName), asc(players.firstName));

  const totalRow = await db
    .select({ n: count() })
    .from(games)
    .where(eq(games.leagueId, id));
  const completedRow = await db
    .select({ n: count() })
    .from(games)
    .where(
      sql`${games.leagueId} = ${id} AND ((${games.scoreA} IS NOT NULL AND ${games.scoreB} IS NOT NULL) OR ${games.winTeam} IS NOT NULL)`,
    );

  const allPlayers = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
    })
    .from(players)
    .orderBy(asc(players.lastName), asc(players.firstName));

  return {
    league,
    members,
    commissioners,
    totalGames: Number(totalRow[0]?.n ?? 0),
    completedGames: Number(completedRow[0]?.n ?? 0),
    allPlayers,
  };
}
