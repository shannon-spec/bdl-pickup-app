import Link from "next/link";
import { ArrowUpRight, ChevronRight, ChevronUp, Check, Pencil } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { canManageLeague } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { GradePill } from "@/components/bdl/grade-pill";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { CommissionerStrip } from "@/components/bdl/commissioner-strip";
import { MembersStrip } from "@/components/bdl/members-strip";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { StatBlock, StatRow } from "@/components/bdl/stat-block";
import { TeamBadge } from "@/components/bdl/team-badge";
import { Pill } from "@/components/bdl/pill";
import { HeroTag, isHeroGame } from "@/components/bdl/hero-tag";
import { LeagueAvatar } from "@/components/bdl/league-avatar";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import type { Player } from "@/lib/db";
import {
  getPlayerById,
  getPlayerLeagues,
  getSeasonStats,
  getLastFive,
  getNextGame,
  getLeaderboard,
  getRecentActivity,
  getDiscoverLeagues,
  getLeaguePlayerCount,
  getFirstRosterPlayer,
} from "@/lib/queries/player-dashboard";
import { getActiveLeagueId } from "@/lib/cookies/active-league";

/** Always render fresh — this dashboard reads session + DB on each request. */
export const dynamic = "force-dynamic";

const fmtWD = (dateStr: string | null) => {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} · ${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]
  } ${d.getDate()}`;
};
const fmtWDUpper = (s: string | null) => fmtWD(s).toUpperCase();
const fmtTime = (timeStr: string | null) => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hr = Number(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
};

export default async function Home() {
  const session = await readSession();

  // Resolve the "me" player. Prefer the linked roster player; fall back
  // to the first rostered player so unlinked admins can still preview.
  const me =
    (session?.playerId && (await getPlayerById(session.playerId))) ||
    (await getFirstRosterPlayer());
  const isPreview = !session?.playerId;

  if (!me) {
    return (
      <>
        <TopBar active="/" />
        <PageFrame>
          <EmptyCard
            title="No roster yet"
            body="Add players in the admin to see the dashboard."
          />
        </PageFrame>
        <MobileBottomBar active="home" />
      </>
    );
  }

  const myLeagues = await getPlayerLeagues(me.id);
  const activeId = await getActiveLeagueId();
  const currentLeague =
    (activeId && myLeagues.find((l) => l.id === activeId)) || myLeagues[0] || null;

  if (!currentLeague) {
    return (
      <>
        <TopBar active="/" />
        <PageFrame>
          <EmptyCard
            title="No league yet"
            body={`${me.firstName} isn't in any leagues. Browse leagues to join one.`}
            cta={{ href: "/discover", label: "Discover" }}
          />
        </PageFrame>
        <MobileBottomBar active="home" />
      </>
    );
  }

  // Fetch all dashboard data in parallel
  const [
    stats,
    lastFive,
    nextGame,
    leaderboard,
    activity,
    discover,
    leaguePlayerCount,
    caps,
    canManageThisLeague,
  ] = await Promise.all([
    getSeasonStats(me.id, currentLeague.id),
    getLastFive(me.id, currentLeague.id),
    getNextGame(me.id, currentLeague.id),
    getLeaderboard(currentLeague.id, me.id, 5),
    getRecentActivity(currentLeague.id, 3),
    getDiscoverLeagues(me.id, 5),
    getLeaguePlayerCount(currentLeague.id),
    getViewCaps(session),
    session ? canManageLeague(session, currentLeague.id) : Promise.resolve(false),
  ]);
  const canEditNextGame = caps.canManage && canManageThisLeague;

  return (
    <>
      <TopBar active="/" />
      <PageFrame>
        {isPreview && (
          <div className="text-[12px] rounded-[10px] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3.5 py-2.5 text-[color:var(--text-3)]">
            Preview — your login isn&apos;t linked to a roster player, so this is{" "}
            <strong className="text-[color:var(--text-2)]">
              {me.firstName} {me.lastName}
            </strong>
            &apos;s dashboard.
          </div>
        )}

        <ContextHeader />

        {/* Missing-fields nudge — only renders when the player still
            has gaps. The header above already shows the chips for
            data that IS on file; this card just calls out what's
            missing with a CTA. */}
        <ProfileNudge player={me} />

        {/* Next Game — full refresh: a beige outer card holding stacked
            white sub-cards (matchup · win probability · projected/spread ·
            rosters). White = brand blue, Dark = neutral. The Commissioner
            strip now lives down by the Members section. */}
        {nextGame && (() => {
          const ps = nextGame.predictedScore;
          const spread = ps ? Math.abs(ps.a - ps.b) : null;
          const favorite =
            ps && ps.a !== ps.b
              ? ps.a > ps.b
                ? nextGame.teamAName
                : nextGame.teamBName
              : null;
          return (
          <section className="group relative rounded-[16px] bg-[color:var(--surface-2)] overflow-hidden">
            <Link
              href={`/games/${nextGame.id}`}
              aria-label={`Game details for ${nextGame.teamAName} vs ${nextGame.teamBName}`}
              className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] rounded-[16px]"
            />
            <div className="relative z-[1] p-5 max-sm:p-4 flex flex-col gap-4 pointer-events-none">
              {/* Header — label · when/where, with status (and edit) on the right */}
              <div className="flex items-center gap-3 flex-wrap">
                <Pill tone="brand">Next Game</Pill>
                <span className="text-[13px] font-medium text-[color:var(--text-2)]">
                  {fmtWD(nextGame.date)}
                  {nextGame.time ? ` · ${fmtTime(nextGame.time)}` : ""}
                  {nextGame.venue ? ` · ${nextGame.venue}` : ""}
                </span>
                <div className="ml-auto flex items-center gap-2.5">
                  <Link
                    href="/games"
                    className="pointer-events-auto inline-flex items-center gap-1 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
                  >
                    All games <ChevronRight size={12} />
                  </Link>
                  {canEditNextGame && (
                    <Link
                      href={`/games/${nextGame.id}`}
                      className="pointer-events-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[color:var(--surface)] hover:bg-[color:var(--brand-soft)] border border-[color:var(--hairline-2)] text-[10.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-2)] hover:text-[color:var(--brand-ink)]"
                    >
                      <Pencil size={10.5} /> Edit
                    </Link>
                  )}
                  {nextGame.mySide ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--up)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--up)]" />
                      You&apos;re in
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[color:var(--brand)] text-white text-[10.5px] font-bold uppercase tracking-[0.08em] shadow-[var(--cta-shadow)]">
                      <Check size={11} strokeWidth={3} /> I&apos;m In
                    </span>
                  )}
                </div>
              </div>

              {/* Matchup — White (left) vs Dark (right) */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <TeamBadge team="white" size={52} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[22px] max-sm:text-[18px] text-[color:var(--text)] truncate">
                        {nextGame.teamAName}
                      </span>
                      {nextGame.mySide === "A" && <YouTag />}
                    </div>
                    <div className="text-[12.5px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                      {nextGame.teamARecord.w}–{nextGame.teamARecord.l} last 5
                    </div>
                  </div>
                </div>
                <span className="text-[color:var(--text-4)] text-[13px] font-semibold tracking-[0.08em]">
                  VS
                </span>
                <div className="flex items-center gap-3 min-w-0 flex-row-reverse">
                  <TeamBadge team="dark" size={52} className="shrink-0" />
                  <div className="min-w-0 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {nextGame.mySide === "B" && <YouTag />}
                      <span className="font-bold text-[22px] max-sm:text-[18px] text-[color:var(--text)] truncate">
                        {nextGame.teamBName}
                      </span>
                    </div>
                    <div className="text-[12.5px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                      {nextGame.teamBRecord.w}–{nextGame.teamBRecord.l} last 5
                    </div>
                  </div>
                </div>
              </div>

              {/* Win probability */}
              <div className="rounded-[12px] bg-[color:var(--surface)] px-4 py-3.5">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-semibold num text-[color:var(--brand-ink)]">
                    {nextGame.teamAName} {Math.round(nextGame.probA)}%
                  </span>
                  <span className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[color:var(--text-3)]">
                    Win Probability
                  </span>
                  <span className="font-semibold num text-[color:var(--text-2)]">
                    {nextGame.teamBName} {Math.round(nextGame.probB)}%
                  </span>
                </div>
                <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-[color:var(--hairline)]">
                  <div style={{ width: `${nextGame.probA}%` }} className="bg-[color:var(--brand)]" />
                  <div style={{ width: `${nextGame.probB}%` }} className="bg-[color:var(--text-4)]" />
                </div>
              </div>

              {/* Projected + Spread */}
              {(ps || spread != null) && (
                <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                  {ps && (
                    <div className="rounded-[12px] bg-[color:var(--surface)] px-4 py-3.5">
                      <div className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[color:var(--text-3)] mb-1.5">
                        Projected
                      </div>
                      <div className="font-bold num text-[28px] max-sm:text-[24px] leading-none">
                        <span className="text-[color:var(--brand-ink)]">{ps.a}</span>
                        <span className="mx-2 text-[color:var(--text-4)]">—</span>
                        <span className="text-[color:var(--text)]">{ps.b}</span>
                      </div>
                    </div>
                  )}
                  {spread != null && (
                    <div className="rounded-[12px] bg-[color:var(--surface)] px-4 py-3.5">
                      <div className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[color:var(--text-3)] mb-1.5">
                        Spread
                      </div>
                      <div className="font-bold text-[28px] max-sm:text-[24px] leading-none text-[color:var(--text)]">
                        {favorite ? (
                          <>
                            {favorite} <span className="num text-[color:var(--brand-ink)]">−{spread}</span>
                          </>
                        ) : (
                          "Pick"
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rosters */}
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                <RosterCard
                  team="white"
                  name={nextGame.teamAName}
                  players={nextGame.rosterA}
                  meId={me?.id ?? null}
                />
                <RosterCard
                  team="dark"
                  name={nextGame.teamBName}
                  players={nextGame.rosterB}
                  meId={me?.id ?? null}
                />
              </div>
            </div>
          </section>
          );
        })()}

        {/* Hero */}
        <section className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-7 pt-6 pb-5 max-sm:px-5 max-sm:pt-5 max-sm:pb-4">
          <div className="flex items-center justify-between gap-3 mb-6 max-sm:flex-col max-sm:items-start max-sm:gap-1.5">
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
              Your Season ·{" "}
              <span className="text-[color:var(--text-2)]">{currentLeague.name}</span>
            </div>
            <div className="inline-flex items-center gap-3 max-sm:w-full max-sm:justify-between">
              {stats.totalWeeks > 0 && (
                <div className="text-[12px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                  Week {stats.weekOf} of {stats.totalWeeks}
                </div>
              )}
              {canEditNextGame && (
                <Link
                  href={`/leagues/${currentLeague.id}/edit`}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[10.5px] font-bold tracking-[0.05em] uppercase text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors"
                >
                  <Pencil size={11} strokeWidth={2.25} /> Edit league
                </Link>
              )}
            </div>
          </div>

          <StatRow>
            <StatBlock
              label="Win %"
              value={stats.winPct !== null ? stats.winPct.toFixed(1) : "—"}
              unit={stats.winPct !== null ? "%" : undefined}
              sub={
                stats.last5Delta !== null
                  ? {
                      text: `${stats.last5Delta >= 0 ? "+" : ""}${stats.last5Delta} last 5G`,
                      tone: stats.last5Delta >= 0 ? "up" : "down",
                      icon: <ChevronUp size={10} style={{ transform: stats.last5Delta < 0 ? "rotate(180deg)" : undefined }} />,
                    }
                  : { text: "Not enough games yet", tone: "muted" }
              }
            />
            <StatBlock
              label="Record"
              value={
                <span>
                  {stats.wins}
                  <span className="text-[color:var(--text-4)] font-bold mx-[-2px]">–</span>
                  {stats.losses}
                </span>
              }
              sub={{ text: `${stats.played} game${stats.played === 1 ? "" : "s"} played` }}
            />
            <StatBlock
              label="Games Played"
              value={stats.gamesPlayedPct !== null ? String(stats.gamesPlayedPct) : "—"}
              unit={stats.gamesPlayedPct !== null ? "%" : undefined}
              sub={{
                text: `${stats.myCompletedCount} of ${stats.leagueCompletedCount} league nights`,
              }}
            />
            <StatBlock
              label="Streak"
              value={stats.streakType ? `${stats.streakType}${stats.streakCount}` : "—"}
              valueClassName={
                stats.streakType === "W"
                  ? "text-[color:var(--up)]"
                  : stats.streakType === "L"
                  ? "text-[color:var(--down)]"
                  : undefined
              }
              sub={
                stats.streakType
                  ? {
                      text: `${stats.streakCount} straight ${stats.streakType === "W" ? "win" : "loss"}${stats.streakCount === 1 ? "" : stats.streakType === "W" ? "s" : "es"}`,
                      tone: stats.streakType === "W" ? "up" : "down",
                    }
                  : { text: "No games yet", tone: "muted" }
              }
            />
          </StatRow>
        </section>

        {/* Last 5 */}
        {lastFive.length > 0 && (
          <div>
            <SectionHead
              title="Your Last 5"
              right={
                <Link
                  href="/games"
                  className="inline-flex items-center gap-1 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
                >
                  All games <ChevronRight size={13} />
                </Link>
              }
            />
            <div
              className="mt-3 grid gap-3 overflow-x-auto"
              style={{
                gridAutoFlow: "column",
                gridAutoColumns: "minmax(170px, 1fr)",
              }}
            >
              {lastFive.map((g) => (
                <Link
                  key={g.id}
                  href={`/games/${g.id}`}
                  aria-label={`Open game on ${fmtWDUpper(g.date)} vs ${g.opName}`}
                  className="group relative flex flex-col gap-2.5 p-4 rounded-[12px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-2)] hover:border-[color:var(--text-4)] transition-colors min-w-[170px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
                      {fmtWDUpper(g.date)}
                    </span>
                    <Pill tone={g.isWin ? "win" : "loss"}>{g.isWin ? "Won" : "Lost"}</Pill>
                  </div>
                  <div className="font-[family-name:var(--mono)] font-extrabold text-[22px] num inline-flex items-baseline gap-2">
                    {g.myScore !== null && g.opScore !== null ? (
                      <>
                        <span className={g.isWin ? "text-[color:var(--text)]" : "text-[color:var(--text-3)]"}>
                          {g.myScore}
                        </span>
                        <span className="text-[color:var(--text-4)] font-medium">—</span>
                        <span className={!g.isWin ? "text-[color:var(--text)]" : "text-[color:var(--text-3)]"}>
                          {g.opScore}
                        </span>
                      </>
                    ) : (
                      <span className="text-[color:var(--text-3)]">—</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11.5px] text-[color:var(--text-3)]">
                    <span>vs {g.opName}</span>
                    <ArrowUpRight
                      size={14}
                      className="text-[color:var(--text-4)] group-hover:text-[color:var(--brand-ink)] transition-colors"
                      aria-hidden
                    />
                  </div>
                  {isHeroGame({
                    gameWinner: g.heroId,
                    scoreA: g.myScore,
                    scoreB: g.opScore,
                  }) &&
                    g.heroName && <HeroTag name={g.heroName} size="sm" />}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Split: leaderboard + activity */}
        <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-5 pt-4 pb-3">
            <SectionHead
              title="League Leaders"
              right={
                <Link
                  href="/leaderboard"
                  className="inline-flex items-center gap-1 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
                >
                  Full leaderboard <ChevRightSm />
                </Link>
              }
            />
            {leaderboard.length === 0 ? (
              <div className="text-[13px] text-[color:var(--text-3)] py-3">
                No qualifying players yet.
              </div>
            ) : (
              <div className="mt-2 flex flex-col">
                {leaderboard.map((row, i) => (
                  <LbRow key={row.player.id} rank={i + 1} row={row} />
                ))}
              </div>
            )}
          </div>
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-5 pt-4 pb-3">
            <SectionHead
              title="Recent Activity"
              right={
                <Link
                  href="/games"
                  className="inline-flex items-center gap-1 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
                >
                  All games <ChevRightSm />
                </Link>
              }
            />
            {activity.length === 0 ? (
              <div className="text-[13px] text-[color:var(--text-3)] py-3">
                No activity yet.
              </div>
            ) : (
              <div className="mt-2 flex flex-col">
                {activity.map((a) => {
                  const showHero =
                    isHeroGame({
                      gameWinner: a.heroId,
                      scoreA: a.scoreA,
                      scoreB: a.scoreB,
                    }) && !!a.heroName;
                  return (
                    <Link
                      key={a.id}
                      href={`/games/${a.id}`}
                      className="flex items-center justify-between gap-3.5 py-2.5 px-1.5 border-t border-[color:var(--hairline)] first:border-t-0 text-[13px] hover:bg-[color:var(--surface-2)] transition-colors rounded-[6px]"
                    >
                      <span className="flex items-center gap-2 flex-wrap text-[color:var(--text)]">
                        <span>
                          <strong className="font-bold">{a.winnerName}</strong> beat{" "}
                          <strong className="font-bold">{a.loserName}</strong>{" "}
                          {a.winnerScore !== null && a.loserScore !== null
                            ? `${a.winnerScore}–${a.loserScore}`
                            : ""}
                        </span>
                        {showHero && <HeroTag name={a.heroName!} size="sm" />}
                      </span>
                      <span className="font-[family-name:var(--mono)] text-[11.5px] text-[color:var(--text-3)] num shrink-0">
                        {fmtWD(a.date)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <CommissionerStrip leagueId={currentLeague.id} />

        <MembersStrip leagueId={currentLeague.id} />

        {/* Discover — bottom-of-page wayfinding to other leagues. */}
        <div>
          <SectionHead
            title="Discover"
            right={
              <Link
                href="/leagues"
                className="inline-flex items-center gap-1 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
              >
                All leagues <ChevRightSm />
              </Link>
            }
          />
          <div className="mt-3 grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
            <DiscoverCard
              you
              name={currentLeague.name}
              schedule={currentLeague.schedule ?? "Your home league"}
              playerCount={leaguePlayerCount}
              level={currentLeague.level}
              avatarKind={currentLeague.avatarKind}
              avatarColor={currentLeague.avatarColor}
              avatarEmoji={currentLeague.avatarEmoji}
            />
            {discover.map((l) => (
              <DiscoverCard
                key={l.id}
                name={l.name}
                schedule={l.schedule ?? l.description ?? "Open league"}
                playerCount={l.playerCount}
                spots={l.spots}
                level={l.level}
                avatarKind={l.avatarKind}
                avatarColor={l.avatarColor}
                avatarEmoji={l.avatarEmoji}
              />
            ))}
          </div>
        </div>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}

/* ============== local components ============== */

function ChevRightSm() {
  return <ChevronRight size={13} />;
}

/**
 * Slim "round out your profile" nudge for the player home page.
 * Only renders when the player still has gaps — the header above
 * already shows the chips for fields that ARE on file, so we don't
 * need to repeat them here.
 */
function ProfileNudge({ player }: { player: Player }) {
  const hometown = player.city
    ? `${player.city}${player.state ? `, ${player.state}` : ""}`
    : null;
  const checks: Array<{ key: string; label: string; ok: boolean }> = [
    { key: "position", label: "Position", ok: !!player.position },
    { key: "hometown", label: "Hometown", ok: !!hometown },
    { key: "height", label: "Height", ok: player.heightFt !== null },
    { key: "weight", label: "Weight", ok: player.weight !== null },
  ];
  const missing = checks.filter((c) => !c.ok);
  if (missing.length === 0) return null;

  return (
    <Link
      href={`/players/${player.id}/edit`}
      className="rounded-[16px] border border-[color:var(--brand-soft)] bg-[color:var(--brand-soft)]/40 px-5 py-3 flex items-center justify-between gap-3 hover:bg-[color:var(--brand-soft)]/60 transition-colors"
    >
      <div className="text-[12.5px] text-[color:var(--text-2)]">
        <span className="font-bold">Round out your profile</span>
        <span className="text-[color:var(--text-3)]">
          {" "}
          · still missing:{" "}
        </span>
        {missing.map((m, i) => (
          <span
            key={m.key}
            className="font-semibold text-[color:var(--text-2)]"
          >
            {m.label}
            {i < missing.length - 1 ? ", " : ""}
          </span>
        ))}
      </div>
      <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-[color:var(--brand-ink,var(--brand))] flex-shrink-0">
        Edit →
      </span>
    </Link>
  );
}

function EmptyCard({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center">
      <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] mb-3">
        {title}
      </div>
      <div className="text-[14px] text-[color:var(--text-2)] mb-5">{body}</div>
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[12px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.04em] uppercase shadow-[var(--cta-shadow)]"
        >
          {cta.label} <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

function YouTag() {
  return (
    <span className="shrink-0 text-[10px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
      You
    </span>
  );
}

function RosterCard({
  team,
  name,
  players,
  meId,
}: {
  team: "white" | "dark";
  name: string;
  players: { id: string; firstName: string; lastName: string }[];
  meId: string | null;
}) {
  return (
    <div className="rounded-[12px] bg-[color:var(--surface)] px-4 py-3.5">
      <div
        className={`text-[10.5px] uppercase tracking-[0.12em] font-bold mb-2.5 ${
          team === "white" ? "text-[color:var(--brand-ink)]" : "text-[color:var(--text-2)]"
        }`}
      >
        {name} · Roster
      </div>
      {players.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {players.map((p) => {
            const isMe = p.id === meId;
            return (
              <li
                key={p.id}
                className={`text-[14px] leading-tight truncate ${
                  isMe
                    ? "font-semibold text-[color:var(--brand-ink)]"
                    : "font-medium text-[color:var(--text)]"
                }`}
              >
                {p.firstName} {p.lastName}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-[color:var(--text-3)]">No players yet</p>
      )}
    </div>
  );
}


function LbRow({
  rank,
  row,
}: {
  rank: number;
  row: {
    player: { id: string; firstName: string; lastName: string };
    wins: number;
    losses: number;
    pct: number;
    isMe: boolean;
  };
}) {
  const pctTone =
    row.pct >= 60
      ? "text-[color:var(--up)]"
      : row.pct < 40
      ? "text-[color:var(--down)]"
      : "text-[color:var(--text-2)]";
  const initials = `${row.player.firstName[0] ?? ""}${row.player.lastName[0] ?? ""}`.toUpperCase();
  return (
    <Link
      href={`/players/${row.player.id}`}
      className={`grid items-center gap-3 py-2.5 px-1.5 grid-cols-[28px_1fr_80px_80px] max-sm:grid-cols-[28px_1fr_80px] border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] transition-colors ${
        row.isMe ? "bg-[color:var(--surface-2)] border-l-2 border-l-[color:var(--brand)] pl-2.5" : ""
      }`}
    >
      <span
        className={`font-[family-name:var(--mono)] text-[13px] num ${
          rank === 1 ? "text-[color:var(--brand-ink)]" : "text-[color:var(--text-3)]"
        }`}
      >
        {rank}
      </span>
      <span className="inline-flex items-center gap-2.5 min-w-0">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white font-bold text-[11px]"
          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-2))" }}
        >
          {initials}
        </span>
        <span className="font-semibold text-[color:var(--text)] truncate hover:text-[color:var(--brand)]">
          {row.isMe && (
            <span className="text-[color:var(--brand)] font-extrabold mr-1.5">•</span>
          )}
          {row.player.firstName} {row.player.lastName}
        </span>
      </span>
      <span className="font-[family-name:var(--mono)] text-[12px] text-[color:var(--text-3)] text-right num max-sm:hidden">
        {row.wins}-{row.losses}
      </span>
      <span className={`font-extrabold text-[13.5px] text-right num ${pctTone}`}>
        {row.pct.toFixed(1)}%
      </span>
    </Link>
  );
}

function DiscoverCard({
  name,
  schedule,
  playerCount,
  spots,
  you,
  level,
  avatarKind,
  avatarColor,
  avatarEmoji,
}: {
  name: string;
  schedule: string;
  playerCount: number;
  spots?: number | null;
  you?: boolean;
  level?: string;
  avatarKind?: string | null;
  avatarColor?: string | null;
  avatarEmoji?: string | null;
}) {
  return (
    <div
      className={`relative rounded-[14px] border p-4 flex flex-col gap-3 ${
        you
          ? "border-[color:var(--brand)]"
          : "border-[color:var(--hairline-2)] bg-[color:var(--surface)]"
      }`}
      style={
        you
          ? {
              background:
                "radial-gradient(ellipse at top right, var(--brand-soft), transparent 60%), var(--surface)",
            }
          : undefined
      }
    >
      <LeagueAvatar
        kind={avatarKind}
        color={avatarColor}
        emoji={avatarEmoji}
        abbr={(name[0] ?? "?").toUpperCase()}
        size={32}
      />
      <div>
        <div className="font-bold text-[15px] leading-tight text-[color:var(--text)]">
          {name}
        </div>
        <div className="text-[12px] text-[color:var(--text-3)] mt-1">{schedule}</div>
      </div>
      <div className="flex items-center justify-between gap-2.5 mt-auto">
        <div className="inline-flex gap-1.5 flex-wrap">
          {you && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[color:var(--up-soft)] text-[color:var(--up)]">
              <span className="font-extrabold">•</span>You&apos;re in
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[color:var(--surface-2)] text-[color:var(--text-2)] border border-[color:var(--hairline)]">
            {playerCount} players
          </span>
          {spots !== null && spots !== undefined && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[color:var(--surface-2)] text-[color:var(--text-2)] border border-[color:var(--hairline)]">
              {spots} spot{spots === 1 ? "" : "s"}
            </span>
          )}
          {level && level !== "Not Rated" && (
            <GradePill level={level} context="league" />
          )}
        </div>
        <button
          type="button"
          className={`px-3.5 py-1.5 rounded-full text-[11.5px] font-bold uppercase tracking-[0.06em] cursor-pointer ${
            you
              ? "bg-[color:var(--surface-2)] text-[color:var(--text)] border border-[color:var(--hairline-2)]"
              : "bg-[color:var(--brand)] text-white"
          }`}
        >
          {you ? "Manage" : "Join"}
        </button>
      </div>
    </div>
  );
}
