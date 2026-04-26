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
import { getLeagueDetail } from "@/lib/queries/leagues";
import { getInvitesForLeague } from "@/lib/queries/invites";
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
  const pendingInvites = canManage ? await getInvitesForLeague(id) : [];

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
              <Pill tone="brand">{detail.league.format.replace("v", " V ").toUpperCase()}</Pill>
              <GradePill level={detail.league.level} hideUnrated />
              <Pill tone="neutral">{detail.members.length} players</Pill>
              <Pill tone="neutral">
                {detail.completedGames} / {detail.totalGames} games
              </Pill>
            </div>
          </div>
        </div>

        {canManage && <LeagueDetailClient detail={detail} isAdmin={isAdmin} />}

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
