import { notFound } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { canManageTeam } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { formatLabel } from "@/lib/format";
import {
  getTeamDetail,
  getEligibleTeamMembers,
  getTeamGames,
} from "@/lib/queries/teams";
import { getTeamLeaderboard } from "@/lib/queries/leaderboard";
import { TeamRosterControls, DeleteTeamButton } from "./team-detail-client";
import { TeamPageView } from "../_view/team-page-view";
import { computeHeroStats } from "../_view/hero-stats";

export const dynamic = "force-dynamic";

export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tournament?: string; season?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const detail = await getTeamDetail(id);
  if (!detail) notFound();

  const session = await readSession();
  const caps = await getViewCaps(session);
  const canManage = caps.canManage && (await canManageTeam(session, id));
  const eligible = canManage ? await getEligibleTeamMembers(id) : [];
  const teamGames = await getTeamGames(id);
  const leaderboard = await getTeamLeaderboard(id, {
    tournamentName: sp.tournament ?? null,
    year: sp.season ?? null,
  });
  const activeTournament = sp.tournament ?? "all";
  const activeSeason = sp.season ?? "all";
  const chipHref = (next: { tournament?: string; season?: string }) => {
    const t = next.tournament ?? activeTournament;
    const s = next.season ?? activeSeason;
    const qs = new URLSearchParams();
    if (t !== "all") qs.set("tournament", t);
    if (s !== "all") qs.set("season", s);
    const str = qs.toString();
    return str ? `/teams/${id}?${str}` : `/teams/${id}`;
  };

  const { team, roster } = detail;
  const place = [team.city, team.state].filter(Boolean).join(", ");
  const hero = computeHeroStats(teamGames, id);

  return (
    <TeamPageView
      contextTeam={{
        id: team.id,
        name: team.name,
        avatarKind: team.avatarKind,
        avatarColor: team.avatarColor,
        avatarEmoji: team.avatarEmoji,
      }}
      backHref="/"
      kicker={`Team · ${formatLabel(team.defaultFormat)}`}
      name={team.name}
      avatarKind={team.avatarKind}
      avatarColor={team.avatarColor}
      avatarEmoji={team.avatarEmoji}
      place={place}
      description={team.description}
      editHref={canManage ? `/teams/${id}/edit` : null}
      hero={hero}
      games={teamGames}
      gamesTeamId={id}
      scheduleHref={canManage ? `/teams/${id}/games/new` : null}
      roster={roster}
      rosterEmptyNote={`No players yet.${canManage ? " Add players below." : ""}`}
      leaderboard={leaderboard}
      activeTournament={activeTournament}
      activeSeason={activeSeason}
      chipHref={chipHref}
      rosterAdmin={
        canManage ? (
          <TeamRosterControls teamId={id} members={roster} eligible={eligible} />
        ) : undefined
      }
      danger={
        canManage ? (
          <section className="rounded-[16px] bg-[color:var(--surface-2)] px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
                Danger Zone
              </span>
              <span className="text-[12.5px] text-[color:var(--text-3)]">
                Permanently delete this team, its roster links, and unlink its games.
              </span>
            </div>
            <DeleteTeamButton teamId={id} teamName={team.name} />
          </section>
        ) : undefined
      }
    />
  );
}
