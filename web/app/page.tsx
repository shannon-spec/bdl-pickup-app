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
import { PlayerAvatar } from "@/components/bdl/player-avatar";
import { StatBlock, StatRow } from "@/components/bdl/stat-block";
import { TeamBadge } from "@/components/bdl/team-badge";
import { ProbabilityBar } from "@/components/bdl/probability-bar";
import { Pill } from "@/components/bdl/pill";
import { HeroTag, isHeroGame } from "@/components/bdl/hero-tag";
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

        {/* Profile snapshot — full-width hero at the top of the
            dashboard. Quick at-a-glance "this is who BDL knows you
            are" with a nudge to fill in missing fields. */}
        <ProfileHero player={me} leagueName={currentLeague.name} />

        {/* Next Game — full-width when present. Skipped entirely
            when no upcoming game, in which case the Commissioners
            strip below carries the page. */}
        {nextGame && (
          <section
            className="group relative rounded-[16px] border border-[color:var(--hairline-2)] overflow-hidden hover:border-[color:var(--hairline-2)]"
            style={{
              background:
                "radial-gradient(ellipse at top left, var(--next-game-tint), transparent 60%), var(--surface)",
            }}
          >
            <Link
              href={`/games/${nextGame.id}`}
              aria-label={`Game details for ${nextGame.teamAName} vs ${nextGame.teamBName}`}
              className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] rounded-[16px]"
            />
            <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
              {nextGame.mySide ? (
                <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[color:var(--up-soft)] text-[color:var(--up)] text-[10.5px] font-bold uppercase tracking-[0.08em]">
                  <Check size={11} strokeWidth={3} /> In
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[color:var(--brand)] text-white text-[10.5px] font-bold uppercase tracking-[0.08em] shadow-[var(--cta-shadow)]">
                  <Check size={11} strokeWidth={3} /> I&apos;m In
                </span>
              )}
              {canEditNextGame && (
                <Link
                  href={`/games/${nextGame.id}`}
                  className="relative z-10 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[color:var(--surface-2)] hover:bg-[color:var(--brand-soft)] border border-[color:var(--hairline-2)] text-[10.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-2)] hover:text-[color:var(--brand-ink)]"
                >
                  <Pencil size={10.5} /> Edit
                </Link>
              )}
            </div>
            <div className="relative z-[1] px-5 py-3.5 flex flex-col gap-2.5 pointer-events-none">
              <div className="flex items-center gap-2.5 flex-wrap text-[12px] pr-[120px]">
                <Pill tone="brand">
                  Next · {fmtWD(nextGame.date)}
                  {nextGame.time ? ` · ${fmtTime(nextGame.time)}` : ""}
                </Pill>
                {nextGame.venue && (
                  <span className="text-[color:var(--text-3)]">{nextGame.venue}</span>
                )}
                <Link
                  href="/games"
                  className="ml-auto pointer-events-auto inline-flex items-center gap-1 text-[11.5px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
                >
                  All games <ChevronRight size={12} />
                </Link>
              </div>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <TeamPick
                    name={nextGame.teamAName}
                    record={`${nextGame.teamARecord.w}-${nextGame.teamARecord.l} last 5`}
                    team="white"
                    me={nextGame.mySide === "A"}
                  />
                  {nextGame.rosterA.length > 0 && (
                    <RosterList players={nextGame.rosterA} />
                  )}
                </div>
                <span className="text-[color:var(--text-4)] text-[12px] font-medium pt-3">vs</span>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <TeamPick
                    name={nextGame.teamBName}
                    record={`${nextGame.teamBRecord.w}-${nextGame.teamBRecord.l} last 5`}
                    team="dark"
                    me={nextGame.mySide === "B"}
                  />
                  {nextGame.rosterB.length > 0 && (
                    <RosterList players={nextGame.rosterB} />
                  )}
                </div>
              </div>
              <ProbabilityBar
                aLabel={nextGame.teamAName}
                bLabel={nextGame.teamBName}
                a={nextGame.probA}
                b={nextGame.probB}
                compact
              />
              {nextGame.predictedScore && (() => {
                const aScore = nextGame.predictedScore.a;
                const bScore = nextGame.predictedScore.b;
                const spread = Math.abs(aScore - bScore);
                const favorite =
                  aScore > bScore
                    ? nextGame.teamAName
                    : bScore > aScore
                      ? nextGame.teamBName
                      : null;
                return (
                  <div className="flex flex-col gap-1 mt-1.5">
                    <div className="flex items-center justify-center gap-2 text-[11px] font-[family-name:var(--mono)] num font-semibold text-[color:var(--text-2)]">
                      <span className="text-[10px] tracking-[0.14em] uppercase text-[color:var(--text-3)] font-semibold">
                        Projected
                      </span>
                      <span>
                        {nextGame.teamAName} {aScore}
                        <span className="mx-1.5 text-[color:var(--text-3)]">—</span>
                        {bScore} {nextGame.teamBName}
                      </span>
                    </div>
                    <div className="flex justify-center">
                      <Pill tone="neutral">
                        Spread · {favorite ? `${favorite} −${spread}` : "Pick"}
                      </Pill>
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>
        )}

        {/* Commissioners — full width below Next Game. */}
        <CommissionerStrip leagueId={currentLeague.id} />

        {/* Hero */}
        <section className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-7 pt-6 pb-5 max-sm:px-5 max-sm:pt-5 max-sm:pb-4">
          <div className="flex items-center justify-between gap-3 mb-6 max-sm:flex-col max-sm:items-start max-sm:gap-1.5">
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
              Your Season ·{" "}
              <span className="text-[color:var(--text-2)]">{currentLeague.name}</span>
            </div>
            {stats.totalWeeks > 0 && (
              <div className="text-[12px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                Week {stats.weekOf} of {stats.totalWeeks}
              </div>
            )}
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

        {/* Discover */}
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
            />
            {discover.map((l) => (
              <DiscoverCard
                key={l.id}
                name={l.name}
                schedule={l.schedule ?? l.description ?? "Open league"}
                playerCount={l.playerCount}
                spots={l.spots}
                level={l.level}
              />
            ))}
          </div>
        </div>

        <MembersStrip leagueId={currentLeague.id} />
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
 * Profile snapshot at the top of the player dashboard. Shows the
 * basics (name, league, position/hometown/height/weight) and — when
 * fields are missing — a friendly nudge with a CTA to /players/{id}
 * where the edit panel lives. Reduces the "ghost roster" problem
 * where players join via invite and never round out their info.
 */
function ProfileHero({
  player,
  leagueName,
}: {
  player: Player;
  leagueName: string;
}) {
  const initials = `${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`.toUpperCase();
  const hometown = player.city
    ? `${player.city}${player.state ? `, ${player.state}` : ""}`
    : null;
  const height =
    player.heightFt !== null
      ? `${player.heightFt}'${player.heightIn !== null && player.heightIn !== 0 ? player.heightIn : 0}"`
      : null;

  // Fields we treat as "the basics". Order matters — we surface the
  // missing list in this order in the nudge banner.
  const checks: Array<{ key: string; label: string; ok: boolean }> = [
    { key: "position", label: "Position", ok: !!player.position },
    { key: "hometown", label: "Hometown", ok: !!hometown },
    { key: "height", label: "Height", ok: player.heightFt !== null },
    { key: "weight", label: "Weight", ok: player.weight !== null },
    { key: "birthday", label: "Birthday", ok: !!player.birthday },
  ];
  const missing = checks.filter((c) => !c.ok);
  const completion = Math.round(
    ((checks.length - missing.length) / checks.length) * 100,
  );

  return (
    <section className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
      <div className="flex items-start gap-5 px-7 pt-6 pb-5 max-sm:flex-col max-sm:items-start max-sm:px-5 max-sm:pt-5">
        <PlayerAvatar
          url={player.avatarUrl}
          initials={initials}
          size={72}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] flex items-center gap-2 flex-wrap">
            <span>Your Profile</span>
            <span className="text-[color:var(--text-4)]">·</span>
            <span className="text-[color:var(--text-2)]">{leagueName}</span>
          </div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] mt-0.5 max-sm:text-[22px]">
            {player.firstName} {player.lastName}
          </h1>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {player.position && <Pill tone="neutral">{player.position}</Pill>}
            {hometown && (
              <span className="text-[12.5px] text-[color:var(--text-3)]">
                {hometown}
              </span>
            )}
            {height && (
              <>
                <span className="text-[color:var(--text-4)] text-[11px]">·</span>
                <span className="text-[12.5px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                  {height}
                </span>
              </>
            )}
            {player.weight !== null && (
              <>
                <span className="text-[color:var(--text-4)] text-[11px]">·</span>
                <span className="text-[12.5px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                  {player.weight} lbs
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 max-sm:items-start max-sm:w-full">
          <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[color:var(--text-3)]">
            {completion}% complete
          </div>
          <Link
            href={`/players/${player.id}`}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)]"
          >
            <Pencil size={13} /> {missing.length > 0 ? "Complete profile" : "Edit profile"}
          </Link>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="px-7 pt-3 pb-4 max-sm:px-5 border-t border-[color:var(--hairline)] bg-[color:var(--brand-soft)]/40">
          <div className="text-[12.5px] text-[color:var(--text-2)]">
            <span className="font-bold">Round out your profile</span>
            <span className="text-[color:var(--text-3)]">
              {" "}
              · still missing:{" "}
            </span>
            {missing.map((m, i) => (
              <span key={m.key} className="font-semibold text-[color:var(--text-2)]">
                {m.label}
                {i < missing.length - 1 ? ", " : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
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

function RosterList({
  players,
}: {
  players: { id: string; firstName: string; lastName: string }[];
}) {
  return (
    <ul className="flex flex-col gap-1 pl-[52px]">
      {players.map((p) => (
        <li
          key={p.id}
          className="text-[12.5px] font-medium text-[color:var(--text)] leading-tight truncate"
        >
          {p.firstName} {p.lastName}
        </li>
      ))}
    </ul>
  );
}

function TeamPick({
  name,
  record,
  team,
  me,
}: {
  name: string;
  record: string;
  team: "white" | "dark";
  me?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2.5">
      <TeamBadge team={team} />
      <div className="flex flex-col gap-0.5">
        <div className="font-bold text-[17px] text-[color:var(--text)] inline-flex items-center gap-1.5">
          {name}
          {me && (
            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
              You
            </span>
          )}
        </div>
        <div className="text-[11.5px] font-[family-name:var(--mono)] text-[color:var(--text-3)] num">
          {record}
        </div>
      </div>
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
}: {
  name: string;
  schedule: string;
  playerCount: number;
  spots?: number | null;
  you?: boolean;
  level?: string;
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
      <span
        className="w-8 h-8 rounded-full"
        style={{
          background: "linear-gradient(135deg, var(--brand), var(--brand-2))",
          boxShadow: "inset 0 0 0 2px var(--mark-inset)",
        }}
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
