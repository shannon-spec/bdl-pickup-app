/**
 * Per-league contact-info visibility, lensed by the active view.
 *
 * Rules (viewer ↔ league):
 *   - admin view (real admin)                        → "all"          (see private + non-private)
 *   - commissioner view, viewer commissions league   → "non-private"  (see non-private values, "Hidden" for private)
 *   - player view, viewer is a member of league      → "non-private"
 *   - anything else                                  → "none"         (don't render contact at all)
 *
 * The `*_private` columns on `players` are an opt-in privacy flag —
 * even members of a league see "Hidden" for fields the player marked
 * private, and only an admin in admin view sees the actual value.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db, leaguePlayers, leagueCommissioners } from "@/lib/db";
import { isAdminLike, isCommissionerOf } from "./perms";
import type { Session } from "./session";
import type { View } from "@/lib/cookies/active-view";

export type ContactAccess = "all" | "non-private" | "none";

export async function getLeagueContactAccess(
  session: Session | null,
  leagueId: string,
  view: View,
): Promise<ContactAccess> {
  if (!session) return "none";
  if (view === "admin" && isAdminLike(session)) return "all";
  if (!session.playerId) return "none";

  if (view === "commissioner") {
    return (await isCommissionerOf(session, leagueId)) ? "non-private" : "none";
  }

  if (view === "player") {
    const [row] = await db
      .select({ x: leaguePlayers.playerId })
      .from(leaguePlayers)
      .where(
        and(
          eq(leaguePlayers.leagueId, leagueId),
          eq(leaguePlayers.playerId, session.playerId),
        ),
      )
      .limit(1);
    return row ? "non-private" : "none";
  }

  return "none";
}

/**
 * Visibility for a single player's contact info, lensed by view.
 * Used by the player profile page (which is not scoped to one league).
 *
 *   - Admin in admin view  → "all"
 *   - Commissioner in commissioner view who commissions any league the
 *     target player is in → "non-private"
 *   - Player view, viewer shares any league with the target player
 *     → "non-private"
 *   - Otherwise → "none"
 */
export async function getPlayerContactAccess(
  session: Session | null,
  targetPlayerId: string,
  view: View,
): Promise<ContactAccess> {
  if (!session) return "none";
  if (view === "admin" && isAdminLike(session)) return "all";
  if (!session.playerId) return "none";

  // Leagues the target player is in (as member or commissioner)
  const [targetMember, targetCommish] = await Promise.all([
    db
      .select({ leagueId: leaguePlayers.leagueId })
      .from(leaguePlayers)
      .where(eq(leaguePlayers.playerId, targetPlayerId)),
    db
      .select({ leagueId: leagueCommissioners.leagueId })
      .from(leagueCommissioners)
      .where(eq(leagueCommissioners.playerId, targetPlayerId)),
  ]);
  const targetLeagueIds = new Set([
    ...targetMember.map((r) => r.leagueId),
    ...targetCommish.map((r) => r.leagueId),
  ]);
  if (targetLeagueIds.size === 0) return "none";

  if (view === "commissioner") {
    const [overlap] = await db
      .select({ leagueId: leagueCommissioners.leagueId })
      .from(leagueCommissioners)
      .where(
        and(
          eq(leagueCommissioners.playerId, session.playerId),
          inArray(leagueCommissioners.leagueId, Array.from(targetLeagueIds)),
        ),
      )
      .limit(1);
    return overlap ? "non-private" : "none";
  }

  if (view === "player") {
    const [overlap] = await db
      .select({ leagueId: leaguePlayers.leagueId })
      .from(leaguePlayers)
      .where(
        and(
          eq(leaguePlayers.playerId, session.playerId),
          inArray(leaguePlayers.leagueId, Array.from(targetLeagueIds)),
        ),
      )
      .limit(1);
    return overlap ? "non-private" : "none";
  }

  return "none";
}
