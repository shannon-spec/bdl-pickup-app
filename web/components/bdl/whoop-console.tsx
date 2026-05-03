// WhoopConsole — server component rendered on the player profile page
// (self-view only). Pairs Whoop strain to the player's BDL games by
// time-overlap (workout) or by date (day cycle, fallback). The view
// is centered on BDL games so untagged/auto-detected sessions still
// surface, and so a player who never bothers to log "basketball" in
// the Whoop app still sees data on game day.

import { eq } from "drizzle-orm";
import { db, players } from "@/lib/db";
import { WhoopConnectButton } from "@/components/bdl/whoop-connect-button";
import { WhoopSyncControls } from "@/components/bdl/whoop-sync-controls";
import { getPlayerWhoopGameMetrics } from "@/lib/whoop/game-metrics";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StrainBar({ strain }: { strain: number }) {
  const pct = Math.min((strain / 21) * 100, 100);
  const color =
    strain >= 18
      ? "var(--down)"
      : strain >= 14
        ? "#f97316"
        : strain >= 10
          ? "#eab308"
          : "var(--up)";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-[color:var(--surface-2)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="font-[family-name:var(--mono)] font-extrabold text-[13px] num w-8 text-right"
        style={{ color }}
      >
        {strain.toFixed(1)}
      </span>
    </div>
  );
}

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

  const metrics = connected
    ? await getPlayerWhoopGameMetrics(playerId, 30)
    : [];

  const withStrain = metrics.filter((m) => m.strain !== null);
  const lastWithStrain = withStrain[0] ?? null;

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

      {!connected && (
        <div className="flex flex-col gap-2 py-4 items-center text-center">
          <p className="text-[13px] text-[color:var(--text-3)] max-w-xs leading-relaxed">
            Connect your Whoop and BDL will pair strain, heart rate, and
            calories to every scheduled game on your roster — even if
            you never tagged the session as basketball in the Whoop app.
          </p>
        </div>
      )}

      {connected && metrics.length === 0 && (
        <p className="text-[13px] text-[color:var(--text-3)] py-2">
          No BDL games on your roster yet. Once you&apos;re scheduled,
          we&apos;ll pull strain from the matching Whoop session.
        </p>
      )}

      {connected && metrics.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
            {(() => {
              const scored = metrics.filter((m) => m.strain !== null);
              const avgStrain =
                scored.length > 0
                  ? scored.reduce((s, m) => s + (m.strain ?? 0), 0) /
                    scored.length
                  : null;
              const hrScored = metrics.filter((m) => m.avgHr !== null);
              const avgHr =
                hrScored.length > 0
                  ? Math.round(
                      hrScored.reduce((s, m) => s + (m.avgHr ?? 0), 0) /
                        hrScored.length,
                    )
                  : null;
              const maxHr = metrics.reduce(
                (m, w) => Math.max(m, w.maxHr ?? 0),
                0,
              );
              const totalCal = metrics.reduce(
                (s, m) => s + (m.calories ?? 0),
                0,
              );

              return (
                <>
                  <SummaryBlock
                    label={`Games · ${metrics.length}`}
                    value={`${metrics.length}`}
                  />
                  <SummaryBlock
                    label="Avg Strain"
                    value={avgStrain ? avgStrain.toFixed(1) : "—"}
                  />
                  <SummaryBlock
                    label="Avg HR"
                    value={avgHr ? `${avgHr}` : "—"}
                    unit="bpm"
                  />
                  <SummaryBlock
                    label="Total Cal"
                    value={totalCal > 0 ? `${totalCal.toLocaleString()}` : "—"}
                  />
                </>
              );
            })()}
          </div>

          {lastWithStrain?.strain !== undefined &&
            lastWithStrain?.strain !== null && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
                  Last Game Strain
                </span>
                <StrainBar strain={lastWithStrain.strain} />
              </div>
            )}

          <div className="flex flex-col divide-y divide-[color:var(--hairline)]">
            <div className="grid grid-cols-[1fr_56px_64px_60px_60px_60px] gap-3 pb-2 text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
              <span>Game</span>
              <span className="text-right">Source</span>
              <span className="text-right">Strain</span>
              <span className="text-right">Avg HR</span>
              <span className="text-right">Max HR</span>
              <span className="text-right">Cal</span>
            </div>
            {metrics.map((m) => (
              <div
                key={m.gameId}
                className="grid grid-cols-[1fr_56px_64px_60px_60px_60px] gap-3 items-center py-3"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[13px] font-semibold truncate">
                    {fmtDate(m.date)}
                  </span>
                  <span className="text-[11px] text-[color:var(--text-3)] truncate">
                    {m.leagueName ?? "—"}
                    {m.durationMin ? ` · ${m.durationMin}m` : ""}
                  </span>
                </div>
                <div className="flex justify-end">
                  <SourceBadge source={m.source} />
                </div>
                <div className="flex justify-end">
                  {m.strain !== null ? (
                    <span className="font-[family-name:var(--mono)] font-bold text-[13px] num">
                      {m.strain.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-[color:var(--text-4)]">—</span>
                  )}
                </div>
                <span className="font-[family-name:var(--mono)] num text-[13px] text-right">
                  {m.avgHr ?? "—"}
                </span>
                <span className="font-[family-name:var(--mono)] num text-[13px] font-bold text-right">
                  {m.maxHr ?? "—"}
                </span>
                <span className="font-[family-name:var(--mono)] num text-[12px] text-[color:var(--text-3)] text-right">
                  {m.calories ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: "workout" | "cycle" | "none" }) {
  if (source === "none") {
    return (
      <span className="text-[9.5px] font-semibold tracking-[0.1em] uppercase text-[color:var(--text-4)]">
        —
      </span>
    );
  }
  const label = source === "workout" ? "Game" : "Day";
  const cls =
    source === "workout"
      ? "bg-[color:var(--up-soft)] text-[color:var(--up)]"
      : "bg-[color:var(--surface-2)] text-[color:var(--text-3)]";
  return (
    <span
      className={`inline-flex items-center justify-center px-1.5 h-4 rounded-sm text-[9px] font-bold tracking-[0.08em] uppercase ${cls}`}
    >
      {label}
    </span>
  );
}

function SummaryBlock({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
        {label}
      </span>
      <span className="font-[family-name:var(--mono)] font-extrabold text-[22px] num text-[color:var(--text)]">
        {value}
        {unit && (
          <span className="text-[12px] font-semibold text-[color:var(--text-3)] ml-1">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}
