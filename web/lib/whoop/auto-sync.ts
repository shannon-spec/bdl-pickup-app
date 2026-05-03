/**
 * Lazy auto-sync hook. Called from WhoopConsole on profile render.
 *
 * Looks for any rostered game on this player that locked more than
 * the grace window ago AND locked AFTER the player's last successful
 * Whoop sync. If such a game exists, fire the backfill so the next
 * paint includes its strain.
 *
 * Whoop's developer API doesn't deliver workout data instantly — the
 * device uploads when the player opens the app or charges, and the
 * cycle/strain calc finalizes shortly after. Waiting 15 minutes after
 * lock catches the vast majority of sessions on the first profile
 * visit; later visits will pick up anything still in flight.
 */
import { and, desc, eq, gt, inArray, isNotNull, lt } from "drizzle-orm";
import { after } from "next/server";
import { db, gameRoster, games, players } from "@/lib/db";
import { backfillWhoopWorkouts } from "@/lib/whoop/backfill";

const GRACE_MS = 15 * 60 * 1000;

export async function runDueWhoopSyncs(playerId: string): Promise<{
  triggered: boolean;
  reason?: string;
}> {
  const [player] = await db
    .select({
      whoopAccessToken: players.whoopAccessToken,
      whoopLastSyncAt: players.whoopLastSyncAt,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  if (!player?.whoopAccessToken) {
    return { triggered: false, reason: "not connected" };
  }

  const cutoff = new Date(Date.now() - GRACE_MS);
  const watermark = player.whoopLastSyncAt ?? new Date(0);

  // Find the most recent rostered game whose lock is older than the
  // grace window AND newer than the last sync watermark. One match is
  // enough to trigger a sync — the backfill pulls every workout on
  // file, so we don't need to enumerate all candidates.
  const [due] = await db
    .select({ gameId: games.id, lockedAt: games.lockedAt })
    .from(gameRoster)
    .innerJoin(games, eq(games.id, gameRoster.gameId))
    .where(
      and(
        eq(gameRoster.playerId, playerId),
        inArray(gameRoster.side, ["A", "B", "invited"]),
        eq(games.locked, true),
        isNotNull(games.lockedAt),
        lt(games.lockedAt, cutoff),
        gt(games.lockedAt, watermark),
      ),
    )
    .orderBy(desc(games.lockedAt))
    .limit(1);

  if (!due) return { triggered: false, reason: "nothing due" };

  // Run after the response so the page render isn't gated on the
  // Whoop API. The backfill bumps whoopLastSyncAt on success, so the
  // next profile visit won't re-trigger for this same game (its
  // lockedAt will then be older than the watermark).
  after(async () => {
    try {
      await backfillWhoopWorkouts(playerId);
    } catch (err) {
      console.error("[whoop] auto-sync backfill failed", err);
    }
  });
  return { triggered: true };
}
