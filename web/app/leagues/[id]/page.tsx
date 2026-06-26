import { notFound } from "next/navigation";
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
import { LeagueAvatar } from "@/components/bdl/league-avatar";
import { LeagueVenueCard } from "@/components/bdl/league-venue-card";
import { NextGameCard } from "@/components/bdl/next-game-card";
import { getLeagueDetail } from "@/lib/queries/leagues";
import { formatLabel } from "@/lib/format";
import { getInvitesForLeague } from "@/lib/queries/invites";
import {
  getLeagueNextGame,
  getMatchupOdds,
  getPlayerWinPctsForLeague,
} from "@/lib/queries/games";
import { isInviteEmailConfigured } from "@/lib/email/invite-email";
import { LeagueDetailClient, Invites } from "./league-detail-client";

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
        { format: detail.league.format },
      )
    : null;
  const nextWinPcts = nextGame
    ? Object.fromEntries(
        [
          ...(await getPlayerWinPctsForLeague(
            id,
            [...nextGame.rosterA, ...nextGame.rosterB].map((p) => p.id),
          )),
        ].map(([pid, v]) => [pid, { pct: v.pct }]),
      )
    : undefined;

  return (
    <>
      <TopBar active="/leagues" />
      <PageFrame>
        <ContextHeader />
        <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-start">
          <LeagueAvatar
            kind={detail.league.avatarKind}
            color={detail.league.avatarColor}
            emoji={detail.league.avatarEmoji}
            abbr={(detail.league.name[0] ?? "?").toUpperCase()}
            size={56}
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
              <GradePill level={detail.league.level} context="league" hideUnrated />
              <Pill tone="neutral">{detail.members.length} players</Pill>
              <Pill tone="neutral">
                {detail.completedGames} / {detail.totalGames} games
              </Pill>
            </div>
          </div>
        </div>

        {canManage && <LeagueDetailClient detail={detail} isAdmin={isAdmin} />}

        {nextGame && (
          <NextGameCard
            href={`/games/${nextGame.id}`}
            label="Next Game"
            date={nextGame.date}
            time={nextGame.time}
            venue={nextGame.venue}
            teamAName={nextGame.teamAName}
            teamBName={nextGame.teamBName}
            probA={odds?.probA ?? null}
            probB={odds?.probB ?? null}
            predictedScore={odds?.predictedScore ?? null}
            rosterA={nextGame.rosterA}
            rosterB={nextGame.rosterB}
            winPcts={nextWinPcts}
            meId={session?.playerId ?? null}
          />
        )}

        <LeagueVenueCard
          venueName={detail.league.venueName}
          venueCourt={detail.league.venueCourt}
          venueAddress={detail.league.venueAddress}
          venueLat={detail.league.venueLat}
          venueLng={detail.league.venueLng}
        />

        <CommissionerStrip leagueId={detail.league.id} />
        <MembersStrip leagueId={detail.league.id} />

        {canManage && (
          <>
            <SectionHead title="Invites" count={<span>{pendingInvites.length}</span>} />
            <Invites
              leagueId={detail.league.id}
              emailConfigured={isInviteEmailConfigured()}
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
