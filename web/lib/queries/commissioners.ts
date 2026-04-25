import { and, asc, eq } from "drizzle-orm";
import {
  db,
  players,
  leagueCommissioners,
  leaguePlayers,
} from "@/lib/db";
import type { Session } from "@/lib/auth/session";

export type CommissionerContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  cell: string | null;
  emailPrivate: boolean;
  cellPrivate: boolean;
};

/**
 * Returns the commissioners for a league with contact info.
 *
 * Visibility: only league members (players in league_players),
 * commissioners themselves, and admins can see the strip. Anyone else
 * gets `null` so the caller can render nothing.
 */
export async function getLeagueCommissionerContacts(
  leagueId: string,
  viewer: Session | null,
): Promise<CommissionerContact[] | null> {
  if (!viewer) return null;
  const isAdmin = viewer.role === "owner" || viewer.role === "super_admin";

  if (!isAdmin) {
    // viewer must be in the league (member or commissioner)
    if (!viewer.playerId) return null;
    const [memberRow] = await db
      .select({ x: leaguePlayers.playerId })
      .from(leaguePlayers)
      .where(
        and(
          eq(leaguePlayers.leagueId, leagueId),
          eq(leaguePlayers.playerId, viewer.playerId),
        ),
      )
      .limit(1);
    const [commishRow] = memberRow
      ? [null]
      : await db
          .select({ x: leagueCommissioners.playerId })
          .from(leagueCommissioners)
          .where(
            and(
              eq(leagueCommissioners.leagueId, leagueId),
              eq(leagueCommissioners.playerId, viewer.playerId),
            ),
          )
          .limit(1);
    if (!memberRow && !commishRow) return null;
  }

  const rows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      email: players.email,
      cell: players.cell,
      emailPrivate: players.emailPrivate,
      cellPrivate: players.cellPrivate,
    })
    .from(players)
    .innerJoin(leagueCommissioners, eq(leagueCommissioners.playerId, players.id))
    .where(eq(leagueCommissioners.leagueId, leagueId))
    .orderBy(asc(players.lastName), asc(players.firstName));

  return rows;
}
