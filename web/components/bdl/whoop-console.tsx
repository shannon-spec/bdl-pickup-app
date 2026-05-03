// WhoopConsole — server component rendered on the player profile page
// (self-view only). Reads basketball workouts from the local
// whoop_workouts table (populated by the backfill in
// lib/whoop/backfill.ts on connect + Sync Now). All historical sessions
// since the season cutoff are listed, newest first.

import { desc, eq } from "drizzle-orm";
import { db, players, whoopWorkouts } from "@/lib/db";
import { WhoopConnectButton } from "@/components/bdl/whoop-connect-button";
import { WhoopSyncControls } from "@/components/bdl/whoop-sync-controls";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StrainBar({ strain }: { strain: number }) {
  // Whoop strain 0–21. Color zones match Whoop's palette roughly.
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

  // All historical basketball sessions for this player, newest first.
  const workouts = connected
    ? await db
        .select({
          id: whoopWorkouts.id,
          date: whoopWorkouts.date,
          durationMin: whoopWorkouts.durationMin,
          strain: whoopWorkouts.strain,
          avgHr: whoopWorkouts.avgHr,
          maxHr: whoopWorkouts.maxHr,
          calories: whoopWorkouts.calories,
        })
        .from(whoopWorkouts)
        .where(eq(whoopWorkouts.playerId, playerId))
        .orderBy(desc(whoopWorkouts.date))
    : [];

  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="w-[3px] h-[12px] rounded-sm bg-[#000] dark:bg-white"
          />
          <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-2)]">
            Whoop · Basketball
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
            Connect your Whoop to see strain, heart rate, and calories from
            your basketball sessions on BDL. We&apos;ll backfill every game
            you&apos;ve logged this season automatically.
          </p>
        </div>
      )}

      {connected && workouts.length === 0 && (
        <p className="text-[13px] text-[color:var(--text-3)] py-2">
          No basketball workouts on file yet. Log a session in the Whoop app
          and tap <strong>Sync now</strong> above.
        </p>
      )}

      {connected && workouts.length > 0 && (
        <>
          {/* Summary row — averages across every imported session */}
          <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
            {(() => {
              const scored = workouts.filter((w) => w.strain !== null);
              const avgStrain =
                scored.length > 0
                  ? scored.reduce((s, w) => s + (w.strain ?? 0), 0) /
                    scored.length
                  : null;
              const hrScored = workouts.filter((w) => w.avgHr !== null);
              const avgHr =
                hrScored.length > 0
                  ? Math.round(
                      hrScored.reduce((s, w) => s + (w.avgHr ?? 0), 0) /
                        hrScored.length,
                    )
                  : null;
              const maxHr = workouts.reduce(
                (m, w) => Math.max(m, w.maxHr ?? 0),
                0,
              );
              const totalCal = workouts.reduce(
                (s, w) => s + (w.calories ?? 0),
                0,
              );

              return (
                <>
                  <SummaryBlock
                    label={`Sessions · ${workouts.length}`}
                    value={`${workouts.length}`}
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

          {/* Strain bar for the most recent session */}
          {workouts[0]?.strain !== null && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
                Last Session Strain
              </span>
              <StrainBar strain={workouts[0].strain!} />
            </div>
          )}

          {/* Per-session list — full history */}
          <div className="flex flex-col divide-y divide-[color:var(--hairline)]">
            <div className="grid grid-cols-[1fr_64px_60px_60px_60px] gap-3 pb-2 text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
              <span>Session</span>
              <span className="text-right">Strain</span>
              <span className="text-right">Avg HR</span>
              <span className="text-right">Max HR</span>
              <span className="text-right">Cal</span>
            </div>
            {workouts.map((w) => (
              <div
                key={w.id}
                className="grid grid-cols-[1fr_64px_60px_60px_60px] gap-3 items-center py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold">
                    {fmtDate(w.date.toISOString())}
                  </span>
                  <span className="text-[11px] text-[color:var(--text-3)]">
                    {w.durationMin ?? 0} min
                  </span>
                </div>
                <div className="flex justify-end">
                  {w.strain !== null ? (
                    <span className="font-[family-name:var(--mono)] font-bold text-[13px] num">
                      {w.strain.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-[color:var(--text-4)]">—</span>
                  )}
                </div>
                <span className="font-[family-name:var(--mono)] num text-[13px] text-right">
                  {w.avgHr ?? "—"}
                </span>
                <span className="font-[family-name:var(--mono)] num text-[13px] font-bold text-right">
                  {w.maxHr ?? "—"}
                </span>
                <span className="font-[family-name:var(--mono)] num text-[12px] text-[color:var(--text-3)] text-right">
                  {w.calories ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
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
