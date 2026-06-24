import Link from "next/link";
import { ArrowUpRight, ChevronRight, ChevronUp, Pencil } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { canManageLeague } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { GradePill } from "@/components/bdl/grade-pill";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { CommissionerStrip } from "@/components/bdl/commissioner-strip";
import { MembersStrip } from "@/components/bdl/members-strip";
import { NextGameCard } from "@/components/bdl/next-game-card";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { StatBlock } from "@/components/bdl/stat-block";
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

        {/* Next Game — shared module (see NextGameCard). The Commissioner
            strip now lives down by the Members section. */}
        {nextGame && (
          <NextGameCard
            href={`/games/${nextGame.id}`}
            date={nextGame.date}
            time={nextGame.time}
            venue={nextGame.venue}
            teamAName={nextGame.teamAName}
            teamBName={nextGame.teamBName}
            teamARecord={nextGame.teamARecord}
            teamBRecord={nextGame.teamBRecord}
            mySide={nextGame.mySide}
            showStatus
            canEdit={canEditNextGame}
            allGamesHref="/games"
            probA={nextGame.probA}
            probB={nextGame.probB}
            predictedScore={nextGame.predictedScore}
            rosterA={nextGame.rosterA}
            rosterB={nextGame.rosterB}
            meId={me?.id ?? null}
          />
        )}

        {/* Hero */}
        <section className="rounded-[16px] bg-[color:var(--surface-2)] p-4 max-sm:p-3">
          <div className="flex items-center justify-between gap-3 mb-3 px-1 max-sm:flex-col max-sm:items-start max-sm:gap-1.5">
            <div className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
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
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[color:var(--surface)] text-[10.5px] font-bold tracking-[0.05em] uppercase text-[color:var(--text-2)] hover:text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-soft)] transition-colors"
                >
                  <Pencil size={11} strokeWidth={2.25} /> Edit league
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
            <StatCard>
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
            </StatCard>
            <StatCard>
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
            </StatCard>
            <StatCard>
              <StatBlock
                label="Games Played"
                value={stats.gamesPlayedPct !== null ? String(stats.gamesPlayedPct) : "—"}
                unit={stats.gamesPlayedPct !== null ? "%" : undefined}
                sub={{
                  text: `${stats.myCompletedCount} of ${stats.leagueCompletedCount} league nights`,
                }}
              />
            </StatCard>
            <StatCard>
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
            </StatCard>
          </div>
        </section>

        {/* Last 5 */}
        {lastFive.length > 0 && (
          <section className="rounded-[16px] bg-[color:var(--surface-2)] p-4">
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
                  className="group relative flex flex-col gap-2.5 p-4 rounded-[12px] bg-[color:var(--surface)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-shadow min-w-[170px]"
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
          </section>
        )}

        {/* Split: leaderboard + activity */}
        <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1">
          <div className="rounded-[16px] bg-[color:var(--surface-2)] p-4">
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
              <div className="mt-3 rounded-[12px] bg-[color:var(--surface)] px-4 py-3 text-[13px] text-[color:var(--text-3)]">
                No qualifying players yet.
              </div>
            ) : (
              <div className="mt-3 rounded-[12px] bg-[color:var(--surface)] px-2 py-1.5 flex flex-col">
                {leaderboard.map((row, i) => (
                  <LbRow key={row.player.id} rank={i + 1} row={row} />
                ))}
              </div>
            )}
          </div>
          <div className="rounded-[16px] bg-[color:var(--surface-2)] p-4">
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
              <div className="mt-3 rounded-[12px] bg-[color:var(--surface)] px-4 py-3 text-[13px] text-[color:var(--text-3)]">
                No activity yet.
              </div>
            ) : (
              <div className="mt-3 rounded-[12px] bg-[color:var(--surface)] px-2 py-1.5 flex flex-col">
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

/** White inner stat card for the Your Season frame. */
function StatCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] bg-[color:var(--surface)] px-4 py-4">
      {children}
    </div>
  );
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
