/**
 * Permission helpers for 1:1 direct messages.
 *
 * Rule (v2): any signed-in BDL player can DM any other player. The
 * picker prioritizes the viewer's league members and then surfaces
 * "BDL Universe" for everyone else. Self-messaging is disallowed.
 *
 * Earlier roll-out scoped to shared leagues only — the user explicitly
 * lifted that restriction after testing because the league pool was
 * too narrow once cross-league play started.
 */
import { eq } from "drizzle-orm";
import { db, players } from "@/lib/db";
import type { Session } from "./session";

/** Returns true if the viewer is allowed to start/continue a 1:1 thread with target. */
export async function canMessage(
  viewer: Session | null,
  targetPlayerId: string,
): Promise<boolean> {
  if (!viewer || !viewer.playerId) return false;
  if (viewer.playerId === targetPlayerId) return false;
  // Confirm the target actually exists — defends the action layer
  // against forged uuids in form posts.
  const [exists] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.id, targetPlayerId))
    .limit(1);
  return !!exists;
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
