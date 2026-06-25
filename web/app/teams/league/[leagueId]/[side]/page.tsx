import { notFound } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { canManageLeague } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { formatLabel } from "@/lib/format";
import { getLeagueSideView } from "@/lib/queries/teams";
import { getLeagueSideLeaderboard } from "@/lib/queries/leaderboard";
import { TeamPageView } from "../../../_view/team-page-view";
import { computeHeroStats } from "../../../_view/hero-stats";
import { LeagueSideRosterControls } from "./league-side-client";

export const dynamic = "force-dynamic";

export default async function LeagueSideTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string; side: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { leagueId, side: rawSide } = await params;
  const sp = await searchParams;
  if (rawSide !== "A" && rawSide !== "B") notFound();
  const side = rawSide as "A" | "B";

  const view = await getLeagueSideView(leagueId, side);
  if (!view) notFound();

  const session = await readSession();
  const caps = await getViewCaps(session);
  const canManage = caps.canManage && (await canManageLeague(session, leagueId));

  const leaderboard = await getLeagueSideLeaderboard(leagueId, side, {
    year: sp.season ?? null,
  });
  const activeSeason = sp.season ?? "all";
  const chipHref = (next: { season?: string }) => {
    const s = next.season ?? activeSeason;
    const qs = new URLSearchParams();
    if (s !== "all") qs.set("season", s);
    const str = qs.toString();
    const base = `/teams/league/${leagueId}/${side}`;
    return str ? `${base}?${str}` : base;
  };

  const hero = computeHeroStats(view.games, view.sideKey);

  return (
    <TeamPageView
      contextTeam={{
        id: view.sideKey,
        name: view.sideName,
        avatarKind: view.avatarKind,
        avatarColor: view.avatarColor,
        avatarEmoji: view.avatarEmoji,
      }}
      backHref={`/leagues/${leagueId}`}
      kicker={`League team · ${view.league.name} · ${formatLabel(view.league.format)}`}
      name={view.sideName}
      avatarKind={view.avatarKind}
      avatarColor={view.avatarColor}
      avatarEmoji={view.avatarEmoji}
      editHref={canManage ? `/teams/league/${leagueId}/${side}/edit` : null}
      hero={hero}
      games={view.games}
      gamesTeamId={view.sideKey}
      rosterTitle="Regular Roster"
      roster={view.roster}
      rosterEmptyNote={
        canManage
          ? "No regular players yet — add the players who are always on this side below."
          : "No regular roster set yet."
      }
      leaderboard={leaderboard}
      activeTournament="all"
      activeSeason={activeSeason}
      chipHref={chipHref}
      rosterAdmin={
        canManage ? (
          <LeagueSideRosterControls
            leagueId={leagueId}
            side={side}
            members={view.roster}
            eligible={view.eligible}
          />
        ) : undefined
      }
    />
  );
}
