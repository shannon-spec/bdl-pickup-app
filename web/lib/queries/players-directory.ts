import { asc, eq, inArray } from "drizzle-orm";
import { db, players, leagues, leaguePlayers } from "@/lib/db";

export type DirectoryPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  level: string;
  status: string;
  leagueIds: string[];
  leagueNames: string[];
};

export async function getPlayersDirectory(opts: {
  scope: "league" | "all";
  viewerLeagueIds: string[];
}): Promise<DirectoryPlayer[]> {
  const playerIds: string[] | null =
    opts.scope === "league" && opts.viewerLeagueIds.length > 0
      ? Array.from(
          new Set(
            (
              await db
                .select({ playerId: leaguePlayers.playerId })
                .from(leaguePlayers)
                .where(inArray(leaguePlayers.leagueId, opts.viewerLeagueIds))
            ).map((r) => r.playerId),
          ),
        )
      : null;

  // Fall back to "all" when the viewer has no scoped leagues (e.g. an
  // admin not linked to a player). Keeps the page useful instead of empty.
  const effectiveScope: "league" | "all" =
    opts.scope === "league" && playerIds && playerIds.length > 0
      ? "league"
      : "all";

  const baseRows =
    effectiveScope === "league" && playerIds
      ? await db
          .select({
            id: players.id,
            firstName: players.firstName,
            lastName: players.lastName,
            position: players.position,
            level: players.level,
            status: players.status,
          })
          .from(players)
          .where(inArray(players.id, playerIds))
          .orderBy(asc(players.lastName), asc(players.firstName))
      : await db
          .select({
            id: players.id,
            firstName: players.firstName,
            lastName: players.lastName,
            position: players.position,
            level: players.level,
            status: players.status,
          })
          .from(players)
          .orderBy(asc(players.lastName), asc(players.firstName));

  if (baseRows.length === 0) return [];

  const allMemberships = await db
    .select({
      playerId: leaguePlayers.playerId,
      leagueId: leaguePlayers.leagueId,
      leagueName: leagues.name,
    })
    .from(leaguePlayers)
    .innerJoin(leagues, eq(leagues.id, leaguePlayers.leagueId))
    .where(
      inArray(
        leaguePlayers.playerId,
        baseRows.map((r) => r.id),
      ),
    );

  const byPlayer = new Map<string, { leagueIds: string[]; leagueNames: string[] }>();
  for (const m of allMemberships) {
    const cur = byPlayer.get(m.playerId) ?? { leagueIds: [], leagueNames: [] };
    cur.leagueIds.push(m.leagueId);
    cur.leagueNames.push(m.leagueName);
    byPlayer.set(m.playerId, cur);
  }

  return baseRows.map((r) => ({
    ...r,
    leagueIds: byPlayer.get(r.id)?.leagueIds ?? [],
    leagueNames: byPlayer.get(r.id)?.leagueNames ?? [],
  }));
}
