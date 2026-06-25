import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { LeagueAvatar } from "@/components/bdl/league-avatar";
import { getLeaguesWithStats } from "@/lib/queries/leagues";
import { getTeamCards, type TeamCard } from "@/lib/queries/teams";
import { formatLabel } from "@/lib/format";
import { db, leaguePlayers, teamPlayers } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover · BDL" };

export default async function DiscoverPage() {
  // Discover is the public landing page — visitors without a session
  // see the same league directory; "Your leagues" simply collapses.
  const session = await readSession();

  const allLeagues = await getLeaguesWithStats();
  const allTeams = await getTeamCards({ all: true });

  // Which leagues / teams is the signed-in player in?
  const memberSet = new Set<string>();
  const teamMemberSet = new Set<string>();
  if (session?.playerId) {
    const memberships = await db
      .select({ leagueId: leaguePlayers.leagueId })
      .from(leaguePlayers)
      .where(eq(leaguePlayers.playerId, session.playerId));
    for (const m of memberships) memberSet.add(m.leagueId);

    const teamMemberships = await db
      .select({ teamId: teamPlayers.teamId })
      .from(teamPlayers)
      .where(eq(teamPlayers.playerId, session.playerId));
    for (const m of teamMemberships) teamMemberSet.add(m.teamId);
  }

  const yours = allLeagues.filter((l) => memberSet.has(l.id));
  const others = allLeagues.filter((l) => !memberSet.has(l.id));
  const yourTeams = allTeams.filter((t) => teamMemberSet.has(t.id));
  const otherTeams = allTeams.filter((t) => !teamMemberSet.has(t.id));

  return (
    <>
      <TopBar
        active="/discover"
      />
      <PageFrame>
        <ContextHeader />
        <SectionHead
          title="Discover"
          count={
            <span>
              {allLeagues.length} league{allLeagues.length === 1 ? "" : "s"}
              {" · "}
              {allTeams.length} team{allTeams.length === 1 ? "" : "s"}
            </span>
          }
        />

        <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[color:var(--text-2)] mt-1">
          Leagues
        </div>

        {yours.length > 0 && (
          <>
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] mt-1">
              Your leagues
            </div>
            <Grid>
              {yours.map((l) => (
                <LeagueCard key={l.id} l={l} mine />
              ))}
            </Grid>
          </>
        )}

        {others.length > 0 && (
          <>
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] mt-2">
              {yours.length > 0 ? "Other leagues" : "All leagues"}
            </div>
            <Grid>
              {others.map((l) => (
                <LeagueCard key={l.id} l={l} />
              ))}
            </Grid>
          </>
        )}

        {allLeagues.length === 0 && (
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
            No leagues to discover yet.
          </div>
        )}

        <div className="text-[12px] font-bold tracking-[0.04em] uppercase text-[color:var(--text-2)] mt-4">
          Teams
        </div>

        {yourTeams.length > 0 && (
          <>
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] mt-1">
              Your teams
            </div>
            <Grid>
              {yourTeams.map((t) => (
                <TeamCardView key={t.id} t={t} mine />
              ))}
            </Grid>
          </>
        )}

        {otherTeams.length > 0 && (
          <>
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] mt-2">
              {yourTeams.length > 0 ? "Other teams" : "All teams"}
            </div>
            <div className="flex flex-col gap-1.5">
              {otherTeams.map((t) => (
                <TeamListRow key={t.id} t={t} />
              ))}
            </div>
          </>
        )}

        {allTeams.length === 0 && (
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
            No teams to discover yet.
          </div>
        )}
      </PageFrame>
      <MobileBottomBar active="discover" />
    </>
  );
}

function TeamCardView({ t, mine }: { t: TeamCard; mine?: boolean }) {
  const place = [t.city, t.state].filter(Boolean).join(", ");
  return (
    <Link
      href={`/teams/${t.id}`}
      className={`group rounded-[14px] border p-4 flex flex-col gap-3 transition-colors ${
        mine
          ? "border-[color:var(--brand)]"
          : "border-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:border-[color:var(--text-4)]"
      }`}
      style={
        mine
          ? {
              background:
                "radial-gradient(ellipse at top right, var(--brand-soft), transparent 60%), var(--surface)",
            }
          : undefined
      }
    >
      <LeagueAvatar
        kind={t.avatarKind}
        color={t.avatarColor}
        emoji={t.avatarEmoji}
        abbr={(t.name[0] ?? "?").toUpperCase()}
        size={36}
      />
      <div>
        <div className="font-bold text-[16px]">{t.name}</div>
        <div className="text-[12px] text-[color:var(--text-3)] mt-0.5">
          {place || "Travel team"}
        </div>
      </div>
      <div className="flex items-center justify-between mt-auto pt-1 gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {mine && (
            <Pill tone="win" dot>
              You&apos;re on
            </Pill>
          )}
          <Pill tone="neutral">{t.rosterCount} players</Pill>
          <Pill tone="brand">{formatLabel(t.defaultFormat)}</Pill>
        </div>
        <ChevronRight
          size={16}
          className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)]"
        />
      </div>
    </Link>
  );
}

function TeamListRow({ t }: { t: TeamCard }) {
  const place = [t.city, t.state].filter(Boolean).join(", ");
  return (
    <Link
      href={`/teams/${t.id}`}
      className="group flex items-center gap-3 rounded-[12px] bg-[color:var(--surface)] px-4 py-2.5 shadow-[inset_0_0_0_1px_var(--hairline-2)] hover:shadow-[inset_0_0_0_1.5px_var(--text-4)] transition-shadow"
    >
      <LeagueAvatar
        kind={t.avatarKind}
        color={t.avatarColor}
        emoji={t.avatarEmoji}
        abbr={(t.name[0] ?? "?").toUpperCase()}
        size={32}
      />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-bold text-[14px] truncate">{t.name}</span>
        <span className="text-[11.5px] text-[color:var(--text-3)] truncate">
          {place || "Travel team"}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 max-sm:hidden">
        <Pill tone="neutral">{t.rosterCount} players</Pill>
        <Pill tone="brand">{formatLabel(t.defaultFormat)}</Pill>
      </div>
      <ChevronRight
        size={16}
        className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)] flex-shrink-0"
      />
    </Link>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
      {children}
    </div>
  );
}

function LeagueCard({
  l,
  mine,
}: {
  l: Awaited<ReturnType<typeof getLeaguesWithStats>>[number];
  mine?: boolean;
}) {
  const cap = l.maxPlayers ?? null;
  const spots =
    cap !== null && cap !== undefined ? Math.max(0, cap - l.playerCount) : null;

  return (
    <Link
      href={`/leagues/${l.id}`}
      className={`group rounded-[14px] border p-4 flex flex-col gap-3 transition-colors ${
        mine
          ? "border-[color:var(--brand)]"
          : "border-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:border-[color:var(--text-4)]"
      }`}
      style={
        mine
          ? {
              background:
                "radial-gradient(ellipse at top right, var(--brand-soft), transparent 60%), var(--surface)",
            }
          : undefined
      }
    >
      <LeagueAvatar
        kind={l.avatarKind}
        color={l.avatarColor}
        emoji={l.avatarEmoji}
        abbr={(l.name[0] ?? "?").toUpperCase()}
        size={36}
      />
      <div>
        <div className="font-bold text-[16px]">{l.name}</div>
        <div className="text-[12px] text-[color:var(--text-3)] mt-0.5">
          {l.season ? `${l.season} · ` : ""}
          {l.schedule || l.location || "Open league"}
        </div>
        {l.description && (
          <div className="text-[12.5px] leading-[1.5] text-[color:var(--text-2)] mt-2 line-clamp-3">
            {l.description}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-auto pt-1 gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {mine && <Pill tone="win" dot>You&apos;re in</Pill>}
          <Pill tone="neutral">{l.playerCount} players</Pill>
          {spots !== null && <Pill tone="neutral">{spots} spot{spots === 1 ? "" : "s"}</Pill>}
        </div>
        <ChevronRight
          size={16}
          className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)]"
        />
      </div>
    </Link>
  );
}
