import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { canManageLeague } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { TopBar } from "@/components/bdl/top-bar";
import { CommissionerStrip } from "@/components/bdl/commissioner-strip";
import { MembersStrip } from "@/components/bdl/members-strip";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { GradePill } from "@/components/bdl/grade-pill";
import { TeamBadge } from "@/components/bdl/team-badge";
import { ProbabilityBar } from "@/components/bdl/probability-bar";
import { getLeagueDetail } from "@/lib/queries/leagues";
import { formatLabel } from "@/lib/format";
import { getInvitesForLeague } from "@/lib/queries/invites";
import { getLeagueNextGame, getMatchupOdds } from "@/lib/queries/games";
import { LeagueDetailClient, Invites } from "./league-detail-client";

const fmtWD = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()]} · ${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getMonth()]
  } ${dt.getDate()}`;
};
const fmtTime = (t: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = Number(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
};

export const dynamic = "force-dynamic";

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getLeagueDetail(id);
  if (!detail) notFound();

  const session = await readSession();
  const caps = await getViewCaps(session);
  const canManage =
    !!session && caps.canManage && (await canManageLeague(session, id));
  const isAdmin = caps.view === "admin";
  const [pendingInvites, nextGame] = await Promise.all([
    canManage ? getInvitesForLeague(id) : Promise.resolve([]),
    getLeagueNextGame(id),
  ]);
  const odds = nextGame
    ? await getMatchupOdds(
        id,
        nextGame.rosterA.map((p) => p.id),
        nextGame.rosterB.map((p) => p.id),
      )
    : null;

  return (
    <>
      <TopBar active="/leagues" />
      <PageFrame>
        <ContextHeader />
        <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-start">
          <div
            className="w-14 h-14 rounded-full flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--brand), var(--brand-2))",
              boxShadow: "inset 0 0 0 2px var(--mark-inset)",
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
              League · {detail.league.season ?? "—"}
            </div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.03em] mt-0.5">
              {detail.league.name}
            </h1>
            <div className="text-[13px] text-[color:var(--text-3)] mt-1">
              {detail.league.schedule || "No schedule set"}
              {detail.league.location ? ` · ${detail.league.location}` : ""}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-3">
              <Pill tone="brand">{formatLabel(detail.league.format)}</Pill>
              {detail.league.format === "series" &&
                detail.league.seriesGameCount &&
                detail.league.seriesPointTarget && (
                  <Pill tone="neutral">
                    Best of {detail.league.seriesGameCount} · to{" "}
                    {detail.league.seriesPointTarget}
                  </Pill>
                )}
              <GradePill level={detail.league.level} hideUnrated />
              <Pill tone="neutral">{detail.members.length} players</Pill>
              <Pill tone="neutral">
                {detail.completedGames} / {detail.totalGames} games
              </Pill>
            </div>
          </div>
        </div>

        {canManage && <LeagueDetailClient detail={detail} isAdmin={isAdmin} />}

        {nextGame && (
          <section
            className="group relative rounded-[16px] border border-[color:var(--hairline-2)] overflow-hidden"
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
            <div className="relative z-[1] px-5 py-3.5 flex flex-col gap-2.5 pointer-events-none">
              <div className="flex items-center gap-2.5 flex-wrap text-[12px]">
                <Pill tone="brand">
                  Next · {fmtWD(nextGame.date)}
                  {nextGame.time ? ` · ${fmtTime(nextGame.time)}` : ""}
                </Pill>
                {nextGame.venue && (
                  <span className="text-[color:var(--text-3)]">{nextGame.venue}</span>
                )}
                <Link
                  href={`/games/${nextGame.id}`}
                  className="ml-auto pointer-events-auto inline-flex items-center gap-1 text-[11.5px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
                >
                  Game details <ChevronRight size={12} />
                </Link>
              </div>
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="inline-flex items-center gap-2.5">
                    <TeamBadge team="white" />
                    <span className="font-extrabold text-[18px] text-[color:var(--text)]">
                      {nextGame.teamAName}
                    </span>
                  </div>
                  {nextGame.rosterA.length > 0 && (
                    <ul className="flex flex-col gap-1 pl-[44px]">
                      {nextGame.rosterA.map((p) => (
                        <li
                          key={p.id}
                          className="text-[12.5px] font-medium text-[color:var(--text)] leading-tight truncate"
                        >
                          {p.firstName} {p.lastName}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <span className="text-[color:var(--text-4)] text-[12px] font-medium pt-3">vs</span>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="inline-flex items-center gap-2.5">
                    <TeamBadge team="dark" />
                    <span className="font-extrabold text-[18px] text-[color:var(--text)]">
                      {nextGame.teamBName}
                    </span>
                  </div>
                  {nextGame.rosterB.length > 0 && (
                    <ul className="flex flex-col gap-1 pl-[44px]">
                      {nextGame.rosterB.map((p) => (
                        <li
                          key={p.id}
                          className="text-[12.5px] font-medium text-[color:var(--text)] leading-tight truncate"
                        >
                          {p.firstName} {p.lastName}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {odds && (
                <ProbabilityBar
                  aLabel={nextGame.teamAName}
                  bLabel={nextGame.teamBName}
                  a={odds.probA}
                  b={odds.probB}
                  compact
                />
              )}
            </div>
          </section>
        )}

        <CommissionerStrip leagueId={detail.league.id} />
        <MembersStrip leagueId={detail.league.id} />

        {canManage && (
          <>
            <SectionHead title="Invites" count={<span>{pendingInvites.length}</span>} />
            <Invites
              leagueId={detail.league.id}
              invites={pendingInvites.map((i) => ({
                id: i.id,
                firstName: i.firstName,
                lastName: i.lastName,
                email: i.email,
                cell: i.cell,
                status: i.status,
                createdAt: i.createdAt.toISOString(),
              }))}
            />
          </>
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
