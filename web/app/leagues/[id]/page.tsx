import { notFound, redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { TopBar } from "@/components/bdl/top-bar";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { getLeagueDetail } from "@/lib/queries/leagues";
import { LeagueDetailClient } from "./league-detail-client";

export const dynamic = "force-dynamic";

export default async function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readSession();
  const isAdmin = session?.role === "owner" || session?.role === "super_admin";
  if (!isAdmin) redirect("/");

  const { id } = await params;
  const detail = await getLeagueDetail(id);
  if (!detail) notFound();

  return (
    <>
      <TopBar active="/leagues" userInitials={session.username.slice(0, 2).toUpperCase()} />
      <PageFrame>
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
              <Pill tone="neutral">{detail.members.length} players</Pill>
              <Pill tone="neutral">
                {detail.completedGames} / {detail.totalGames} games
              </Pill>
            </div>
          </div>
        </div>

        <LeagueDetailClient detail={detail} />

        <SectionHead title="Members" count={<span>{detail.members.length}</span>} />
        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
          {detail.members.length === 0 ? (
            <div className="px-5 py-12 text-center text-[color:var(--text-3)] text-[14px]">
              No players assigned yet — add some below.
            </div>
          ) : (
            detail.members.map((m) => (
              <LeagueDetailClient.MemberRow
                key={m.id}
                leagueId={detail.league.id}
                player={m}
              />
            ))
          )}
        </div>
        <LeagueDetailClient.AddMember
          leagueId={detail.league.id}
          allPlayers={detail.allPlayers}
          excludeIds={detail.members.map((m) => m.id)}
        />

        <SectionHead title="Commissioners" count={<span>{detail.commissioners.length}</span>} />
        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
          {detail.commissioners.length === 0 ? (
            <div className="px-5 py-8 text-center text-[color:var(--text-3)] text-[14px]">
              No commissioners.
            </div>
          ) : (
            detail.commissioners.map((c) => (
              <LeagueDetailClient.CommissionerRow
                key={c.id}
                leagueId={detail.league.id}
                player={c}
              />
            ))
          )}
        </div>
        <LeagueDetailClient.AddCommissioner
          leagueId={detail.league.id}
          allPlayers={detail.allPlayers}
          excludeIds={detail.commissioners.map((c) => c.id)}
        />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
