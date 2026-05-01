import Link from "next/link";
import { readSession } from "@/lib/auth/session";
import {
  getMyMemberLeagueIds,
  getMyCommissionerLeagueIds,
  isAdminLike,
} from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { getActiveLeagueId } from "@/lib/cookies/active-league";
import { getPlayersDirectory } from "@/lib/queries/players-directory";
import {
  getCrowdGradesForPlayers,
  type GradeKey,
} from "@/lib/queries/player-grades";

const ALL_GRADES: GradeKey[] = [
  "Not Rated",
  "Novice",
  "Intermediate",
  "Advanced",
  "Game Changer",
  "Pro",
];
const isGradeKey = (s: string): s is GradeKey =>
  (ALL_GRADES as string[]).includes(s);
import { db, leagues as leaguesTbl, leaguePlayers } from "@/lib/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { InviteControls } from "./invite-controls";
import { AddPlayerControls } from "./add-player-controls";
import { PlayersGrid } from "./players-grid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Players · BDL" };

type Scope = "league" | "all";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: Scope }>;
}) {
  const session = await readSession();
  const caps = await getViewCaps(session);

  const sp = await searchParams;
  // Guests have no leagues so the league-scoped tab would always be
  // empty — fall through to the universe scope.
  const scope: Scope =
    sp.scope === "all" || !session ? "all" : "league";

  const [memberIds, commishIds] = session
    ? await Promise.all([
        getMyMemberLeagueIds(session),
        getMyCommissionerLeagueIds(session),
      ])
    : [[] as string[], [] as string[]];
  const viewerLeagueIds = Array.from(new Set([...memberIds, ...commishIds]));

  // Add Player vs Invite Player split:
  //   - Admin view → direct Add Player (all leagues optional)
  //   - Commissioner view → Invite Player (their managed leagues only)
  //   - Player view → no add/invite UI
  const isAdminView = caps.view === "admin" && isAdminLike(session);

  const players = await getPlayersDirectory({
    scope,
    viewerLeagueIds,
    viewerIsAdmin: isAdminView,
  });

  // League-scoped grade attribution. The grade pill on each card
  // is for the active league context only — there is no global
  // grade. In BDL Universe scope (or when no league is active),
  // the pill is hidden so we never imply a grade lives outside its
  // league.
  const activeLeagueId = scope === "league" ? await getActiveLeagueId() : null;
  // Fall back to the viewer's first league if no cookie is set yet —
  // mirrors what the rest of the app does for first-time visitors.
  const gradeLeagueId =
    activeLeagueId && viewerLeagueIds.includes(activeLeagueId)
      ? activeLeagueId
      : scope === "league" && viewerLeagueIds[0]
        ? viewerLeagueIds[0]
        : null;

  const crowdGrades = gradeLeagueId
    ? await getCrowdGradesForPlayers(
        players.map((p) => p.id),
        gradeLeagueId,
      )
    : new Map<string, GradeKey>();

  // Per-league admin overrides (leaguePlayers.leagueLevel) for the
  // active league. Falls back to the global players.level when no
  // override is set.
  const overrideRows = gradeLeagueId
    ? await db
        .select({
          playerId: leaguePlayers.playerId,
          leagueLevel: leaguePlayers.leagueLevel,
        })
        .from(leaguePlayers)
        .where(
          and(
            eq(leaguePlayers.leagueId, gradeLeagueId),
            inArray(
              leaguePlayers.playerId,
              players.map((p) => p.id),
            ),
          ),
        )
    : [];
  const overrideByPlayer = new Map<string, GradeKey | null>(
    overrideRows.map((r) => [
      r.playerId,
      r.leagueLevel && r.leagueLevel !== "Not Rated" && isGradeKey(r.leagueLevel)
        ? (r.leagueLevel as GradeKey)
        : null,
    ]),
  );

  const playersWithGrade = players.map((p) => {
    if (!gradeLeagueId) {
      // Universe scope: no league context, no pill. Grades are
      // always for a specific league — never imply otherwise.
      return { ...p, displayGrade: null as GradeKey | null };
    }
    // League scope: peer-vote crowd grade > per-league admin
    // override > ungraded. We deliberately do NOT fall through to
    // players.level (the global admin level) because that would
    // surface "a grade from another league" in this league's
    // context — exactly what per-league grades are meant to fix.
    const crowd = crowdGrades.get(p.id) ?? null;
    if (crowd) return { ...p, displayGrade: crowd };
    const override = overrideByPlayer.get(p.id) ?? null;
    return { ...p, displayGrade: override };
  });

  // League name for the "in {league}" tag rendered below each pill.
  const gradeLeagueName = gradeLeagueId
    ? (
        await db
          .select({ name: leaguesTbl.name })
          .from(leaguesTbl)
          .where(eq(leaguesTbl.id, gradeLeagueId))
          .limit(1)
      )[0]?.name ?? null
    : null;
  const canInvite = caps.canManage && !isAdminView;
  const manageLeagueIds = isAdminView ? null : commishIds;
  const showAddPlayer = isAdminView;
  const adminAllLeagues = isAdminView
    ? await db
        .select({ id: leaguesTbl.id, name: leaguesTbl.name })
        .from(leaguesTbl)
        .orderBy(asc(leaguesTbl.name))
    : [];
  const inviteLeagues =
    canInvite && (manageLeagueIds === null || manageLeagueIds.length > 0)
      ? await db
          .select({ id: leaguesTbl.id, name: leaguesTbl.name })
          .from(leaguesTbl)
          .where(
            manageLeagueIds === null ? undefined : inArray(leaguesTbl.id, manageLeagueIds),
          )
          .orderBy(asc(leaguesTbl.name))
      : [];

  return (
    <>
      <TopBar active="/players" />
      <PageFrame>
        <ContextHeader />

        <SectionHead
          title="Players"
          count={
            <span>
              {players.length} player{players.length === 1 ? "" : "s"}
            </span>
          }
          right={
            showAddPlayer ? (
              <AddPlayerControls leagues={adminAllLeagues} />
            ) : canInvite && inviteLeagues.length > 0 ? (
              <InviteControls leagues={inviteLeagues} />
            ) : null
          }
        />

        <ScopeTabs current={scope} />

        <PlayersGrid
          players={playersWithGrade}
          gradeLeagueName={gradeLeagueName}
        />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}

function ScopeTabs({ current }: { current: Scope }) {
  const Tab = ({ value, children }: { value: Scope; children: React.ReactNode }) => (
    <Link
      href={value === "league" ? "/players" : "/players?scope=all"}
      className={`inline-flex items-center h-9 px-4 rounded-full text-[12px] font-semibold tracking-[0.04em] uppercase transition-colors border ${
        current === value
          ? "bg-[color:var(--brand)] text-white border-transparent"
          : "bg-[color:var(--surface)] border-[color:var(--hairline-2)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
      }`}
    >
      {children}
    </Link>
  );
  return (
    <div className="flex items-center gap-2">
      <Tab value="league">My League</Tab>
      <Tab value="all">BDL Universe</Tab>
    </div>
  );
}

