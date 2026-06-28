import { readSession } from "@/lib/auth/session";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { getLeaguesWithStats } from "@/lib/queries/leagues";
import { getTeamCards } from "@/lib/queries/teams";
import {
  db,
  leaguePlayers,
  leagueCommissioners,
  teamPlayers,
  teamCommissioners,
} from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  DiscoverRow,
  DiscoverSearch,
  type DiscoverItem,
} from "./discover-search";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover · BDL" };

function leagueLocation(l: {
  venueName: string | null;
  location: string | null;
  season: string | null;
}) {
  return (l.venueName || l.location || l.season || "").trim();
}

export default async function DiscoverPage() {
  const session = await readSession();

  const [allLeagues, allTeams] = await Promise.all([
    getLeaguesWithStats(),
    getTeamCards({ all: true }),
  ]);

  // Actual per-player membership (not admin-all): leagues you play/commission,
  // teams you're on/coach.
  const myLeague = new Set<string>();
  const commLeague = new Set<string>();
  const myTeam = new Set<string>();
  const coachTeam = new Set<string>();
  if (session?.playerId) {
    const pid = session.playerId;
    const [lp, lc, tp, tc] = await Promise.all([
      db.select({ id: leaguePlayers.leagueId }).from(leaguePlayers).where(eq(leaguePlayers.playerId, pid)),
      db.select({ id: leagueCommissioners.leagueId }).from(leagueCommissioners).where(eq(leagueCommissioners.playerId, pid)),
      db.select({ id: teamPlayers.teamId }).from(teamPlayers).where(eq(teamPlayers.playerId, pid)),
      db.select({ id: teamCommissioners.teamId }).from(teamCommissioners).where(eq(teamCommissioners.playerId, pid)),
    ]);
    lp.forEach((r) => myLeague.add(r.id));
    lc.forEach((r) => commLeague.add(r.id));
    tp.forEach((r) => myTeam.add(r.id));
    tc.forEach((r) => coachTeam.add(r.id));
  }

  const leagueItem = (
    l: (typeof allLeagues)[number],
    role?: string,
  ): DiscoverItem => ({
    type: "league",
    id: l.id,
    name: l.name,
    location: leagueLocation(l),
    avatarKind: l.avatarKind,
    avatarColor: l.avatarColor,
    avatarEmoji: l.avatarEmoji,
    href: `/leagues/${l.id}`,
    role,
  });
  const teamItem = (
    t: (typeof allTeams)[number],
    role?: string,
  ): DiscoverItem => ({
    type: "team",
    id: t.id,
    name: t.name,
    location: [t.city, t.state].filter(Boolean).join(", "),
    avatarKind: t.avatarKind,
    avatarColor: t.avatarColor,
    avatarEmoji: t.avatarEmoji,
    href: `/teams/${t.id}`,
    role,
  });

  // "Yours" = where you're ON THE ROSTER (a player). Leagues/teams you only
  // commission or coach are managed in the Manage tab, not "your teams" here.
  const mineLeagueIds = new Set(myLeague);
  const mineTeamIds = new Set(myTeam);

  const yourLeagues = allLeagues
    .filter((l) => mineLeagueIds.has(l.id))
    .map((l) => leagueItem(l, commLeague.has(l.id) ? "Commissioner" : "Player"));
  const yourTeams = allTeams
    .filter((t) => mineTeamIds.has(t.id))
    .map((t) => teamItem(t, coachTeam.has(t.id) ? "Coach" : "Player"));

  const others: DiscoverItem[] = [
    ...allLeagues.filter((l) => !mineLeagueIds.has(l.id)).map((l) => leagueItem(l)),
    ...allTeams.filter((t) => !mineTeamIds.has(t.id)).map((t) => teamItem(t)),
  ];

  const hasYours = yourLeagues.length > 0 || yourTeams.length > 0;

  return (
    <>
      <TopBar active="/discover" />
      <PageFrame>
        <ContextHeader />
        <SectionHead title="Discover" />

        {hasYours && (
          <div className="flex flex-col gap-5">
            {yourLeagues.length > 0 && (
              <Section title="Your leagues">
                {yourLeagues.map((i) => (
                  <DiscoverRow key={i.id} item={i} />
                ))}
              </Section>
            )}
            {yourTeams.length > 0 && (
              <Section title="Your teams">
                {yourTeams.map((i) => (
                  <DiscoverRow key={i.id} item={i} />
                ))}
              </Section>
            )}
          </div>
        )}

        <div className="mt-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-3)] mb-2">
            {hasYours ? "Find more leagues & teams" : "Browse leagues & teams"}
          </p>
          <DiscoverSearch items={others} />
        </div>
      </PageFrame>
      <MobileBottomBar active="discover" />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-3)] mb-2">
        {title}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
