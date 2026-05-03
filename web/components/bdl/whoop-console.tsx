// WhoopConsole — server shell rendered on the player profile page
// (self-view only). Pulls metrics + connection state, then hands off
// to WhoopConsoleBody (client) for the MTD/YTD toggle and summary.

import { eq } from "drizzle-orm";
import { db, players } from "@/lib/db";
import { WhoopConnectButton } from "@/components/bdl/whoop-connect-button";
import { WhoopSyncControls } from "@/components/bdl/whoop-sync-controls";
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
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="w-[3px] h-[12px] rounded-sm bg-[#000] dark:bg-white"
          />
          <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-2)]">
            Whoop · BDL Games
          </span>
          {connected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:var(--up-soft)] text-[color:var(--up)] text-[10px] font-semibold tracking-[0.08em] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--up)]" />
              Connected
            </span>
          )}
        </div>
        <WhoopConnectButton connected={connected} />
      </div>

      {connected && (
        <WhoopSyncControls playerId={playerId} lastSyncAt={lastSyncAt} />
      )}

      {!connected ? (
        <div className="flex flex-col gap-2 py-4 items-center text-center">
          <p className="text-[13px] text-[color:var(--text-3)] max-w-xs leading-relaxed">
            Connect your Whoop and BDL will pair strain, heart rate, and
            calories to every scheduled game on your roster — even if
            you never tagged the session as basketball in the Whoop app.
          </p>
        </div>
      ) : (
        <WhoopConsoleBody metrics={metrics} />
      )}
    </div>
  );
}
