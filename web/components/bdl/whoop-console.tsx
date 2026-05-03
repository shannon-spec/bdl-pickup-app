// WhoopConsole — server shell rendered on the player profile page
// (self-view only). Pulls connection state and metrics, then hands
// the entire card off to WhoopConsoleBody (client) so the MTD/YTD
// toggle can sit in the header alongside Connect/Disconnect.

import { eq } from "drizzle-orm";
import { db, players } from "@/lib/db";
import { WhoopConsoleBody } from "@/components/bdl/whoop-console-body";
import { getPlayerWhoopGameMetrics } from "@/lib/whoop/game-metrics";

export async function WhoopConsole({ playerId }: { playerId: string }) {
  const [player] = await db
    .select({
      whoopAccessToken: players.whoopAccessToken,
      whoopLastSyncAt: players.whoopLastSyncAt,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  const connected = !!player?.whoopAccessToken;
  const lastSyncAt = player?.whoopLastSyncAt
    ? player.whoopLastSyncAt.toISOString()
    : null;

  const metrics = connected ? await getPlayerWhoopGameMetrics(playerId) : [];

  return (
    <WhoopConsoleBody
      playerId={playerId}
      connected={connected}
      lastSyncAt={lastSyncAt}
      metrics={metrics}
    />
  );
}
