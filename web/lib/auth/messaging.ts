/**
 * Permission helpers for 1:1 direct messages.
 *
 * Rules:
 *   - admin (owner / super_admin) → can message anyone with a profile
 *   - commissioner → can message any other commissioner (anywhere) +
 *     any player rostered in a league they commission
 *   - player → can message any player who shares at least one league
 *
 * Symmetric: A can message B ⇔ B can message A. We never authorize a
 * one-way send. Self-messaging is disallowed.
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  leagueCommissioners,
  leaguePlayers,
} from "@/lib/db";
import { isAdminLike, getMyCommissionerLeagueIds } from "./perms";
import type { Session } from "./session";

/** Returns true if the viewer is allowed to start/continue a 1:1 thread with target. */
export async function canMessage(
  viewer: Session | null,
  targetPlayerId: string,
): Promise<boolean> {
  if (!viewer || !viewer.playerId) return false;
  if (viewer.playerId === targetPlayerId) return false;

  if (isAdminLike(viewer)) return true;

  const myCommissioned = await getMyCommissionerLeagueIds(viewer);
  const isViewerCommissioner = myCommissioned.length > 0;

  // Commissioner ↔ commissioner (anywhere on the platform).
  if (isViewerCommissioner) {
    const [targetIsCommish] = await db
      .select({ id: leagueCommissioners.playerId })
      .from(leagueCommissioners)
      .where(eq(leagueCommissioners.playerId, targetPlayerId))
      .limit(1);
    if (targetIsCommish) return true;
  }

  // Commissioner → player in one of the leagues they commission.
  if (isViewerCommissioner) {
    const [targetInMyLeague] = await db
      .select({ leagueId: leaguePlayers.leagueId })
      .from(leaguePlayers)
      .where(
        and(
          eq(leaguePlayers.playerId, targetPlayerId),
          inArray(leaguePlayers.leagueId, myCommissioned),
        ),
      )
      .limit(1);
    if (targetInMyLeague) return true;
  }

  // Player → player in a shared league. Use the viewer's league
  // memberships intersected with the target's.
  const myLeagues = await db
    .select({ leagueId: leaguePlayers.leagueId })
    .from(leaguePlayers)
    .where(eq(leaguePlayers.playerId, viewer.playerId));
  if (myLeagues.length === 0) return false;
  const myIds = myLeagues.map((r) => r.leagueId);
  const [shared] = await db
    .select({ leagueId: leaguePlayers.leagueId })
    .from(leaguePlayers)
    .where(
      and(
        eq(leaguePlayers.playerId, targetPlayerId),
        inArray(leaguePlayers.leagueId, myIds),
      ),
    )
    .limit(1);
  return !!shared;
}

/**
 * Canonicalize a participant pair so `(a, b)` is always the same regardless
 * of order. Used for conversation lookup/creation.
 */
export function canonicalPair(p1: string, p2: string): {
  a: string;
  b: string;
} {
  return p1 < p2 ? { a: p1, b: p2 } : { a: p2, b: p1 };
}
