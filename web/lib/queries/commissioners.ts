import { asc, eq } from "drizzle-orm";
import {
  db,
  players,
  leagueCommissioners,
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
 * Returns the commissioner roster for a league with contact info.
 * Names are public; contact-info visibility is enforced by the caller
 * via `getLeagueContactAccess` (admin/member/commissioner-only).
 */
export async function getLeagueCommissionerContacts(
  leagueId: string,
  _viewer: Session | null,
): Promise<CommissionerContact[] | null> {
  void _viewer;
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
