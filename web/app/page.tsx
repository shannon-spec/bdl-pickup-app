import Link from "next/link";
import { ChevronRight, ChevronUp, Check, Pencil } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { canManageLeague } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { CommissionerStrip } from "@/components/bdl/commissioner-strip";
import { MembersStrip } from "@/components/bdl/members-strip";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { StatBlock, StatRow } from "@/components/bdl/stat-block";
import { TeamBadge } from "@/components/bdl/team-badge";
import { ProbabilityBar } from "@/components/bdl/probability-bar";
import { Pill } from "@/components/bdl/pill";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
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
const initialsOf = (firstName: string | undefined, lastName: string | undefined) =>
  `${(firstName ?? "?")[0] ?? ""}${(lastName ?? "")[0] ?? ""}`.toUpperCase();

export default async function Home() {
  const session = await readSession();

  // Resolve the "me" player. Prefer the linked roster player; fall back
  // to the first rostered player so unlinked admins can still preview.
  const me =
    (session?.playerId && (await getPlayerById(session.playerId))) ||
    (await getFirstRosterPlayer());
  const isPreview = !session?.playerId;

  const userInitials = initialsOf(
    session?.username?.toUpperCase().slice(0, 1),
    session?.username?.toUpperCase().slice(1, 2),
  );

  if (!me) {
    return (
      <>
        <TopBar active="/" userInitials={userInitials} />
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
        <TopBar active="/" userInitials={userInitials} />
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
      <TopBar active="/" userInitials={userInitials} />
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

        {/* Commissioners + Next Game side by side. If no upcoming game,
            commissioner strip stretches full-width. */}
        {nextGame ? (
          <div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1 items-stretch">
            <CommissionerStrip leagueId={currentLeague.id} />
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
                <div className="flex items-center gap-3 flex-wrap">
                  <TeamPick
                    name={nextGame.teamAName}
                    record={`${nextGame.teamARecord.w}-${nextGame.teamARecord.l} last 5`}
                    team="white"
                    me={nextGame.mySide === "A"}
                  />
                  <span className="text-[color:var(--text-4)] text-[12px] font-medium">vs</span>
                  <TeamPick
                    name={nextGame.teamBName}
                    record={`${nextGame.teamBRecord.w}-${nextGame.teamBRecord.l} last 5`}
                    team="dark"
                    me={nextGame.mySide === "B"}
                  />
                </div>
                <ProbabilityBar
                  aLabel={nextGame.teamAName}
                  bLabel={nextGame.teamBName}
                  a={nextGame.probA}
                  b={nextGame.probB}
                  compact
                  showTop={false}
                />
              </div>
            </section>
          </div>
        ) : (
          <CommissionerStrip leagueId={currentLeague.id} />
        )}

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
                <div
                  key={g.id}
                  className="flex flex-col gap-2.5 p-4 rounded-[12px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] min-w-[170px]"
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
                  <div className="text-[11.5px] text-[color:var(--text-3)]">
                    vs {g.opName}
                  </div>
                </div>
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
                {activity.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-baseline justify-between gap-3.5 py-2.5 px-1.5 border-t border-[color:var(--hairline)] first:border-t-0 text-[13px]"
                  >
                    <span className="text-[color:var(--text)]">
                      <strong className="font-bold">{a.winnerName}</strong> beat{" "}
                      <strong className="font-bold">{a.loserName}</strong>{" "}
                      {a.winnerScore !== null && a.loserScore !== null
                        ? `${a.winnerScore}–${a.loserScore}`
                        : ""}
                    </span>
                    <span className="font-[family-name:var(--mono)] text-[11.5px] text-[color:var(--text-3)] num shrink-0">
                      {fmtWD(a.date)}
                    </span>
                  </div>
                ))}
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
            />
            {discover.map((l) => (
              <DiscoverCard
                key={l.id}
                name={l.name}
                schedule={l.schedule ?? l.description ?? "Open league"}
                playerCount={l.playerCount}
                spots={l.spots}
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
}: {
  name: string;
  schedule: string;
  playerCount: number;
  spots?: number | null;
  you?: boolean;
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
