import { notFound } from "next/navigation";
import { formatLabel } from "@/lib/format";
import { getLeagueSideView } from "@/lib/queries/teams";
import { getLeagueSideLeaderboard } from "@/lib/queries/leaderboard";
import { TeamPageView } from "../../../_view/team-page-view";
import { computeHeroStats } from "../../../_view/hero-stats";

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
        avatarKind: view.league.avatarKind,
        avatarColor: view.league.avatarColor,
        avatarEmoji: view.league.avatarEmoji,
      }}
      backHref={`/leagues/${leagueId}`}
      kicker={`League team · ${view.league.name} · ${formatLabel(view.league.format)}`}
      name={view.sideName}
      avatarKind={view.league.avatarKind}
      avatarColor={view.league.avatarColor}
      avatarEmoji={view.league.avatarEmoji}
      hero={hero}
      games={view.games}
      gamesTeamId={view.sideKey}
      roster={view.roster}
      rosterEmptyNote="No players have suited up for this side yet."
      leaderboard={leaderboard}
      activeTournament="all"
      activeSeason={activeSeason}
      chipHref={chipHref}
    />
  );
}
