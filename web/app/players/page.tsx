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

/**
 * Scope is "all" (BDL Universe) or a league UUID. The Players page
 * shows one tab per league the viewer is in plus BDL Universe — so
 * a multi-league viewer sees their leagues by name instead of a
 * generic "My League" label that hides which league they're on.
 */
type Scope = string;

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const session = await readSession();
  const caps = await getViewCaps(session);

  const [memberIds, commishIds] = session
    ? await Promise.all([
        getMyMemberLeagueIds(session),
        getMyCommissionerLeagueIds(session),
      ])
    : [[] as string[], [] as string[]];
  const viewerLeagueIds = Array.from(new Set([...memberIds, ...commishIds]));

  const sp = await searchParams;
  const requestedScope = sp.scope;
  const activeLeagueId = await getActiveLeagueId();
  // Resolve actual scope:
  //   1. explicit ?scope=all → BDL Universe
  //   2. explicit ?scope={uuid} when viewer is in that league → that league
  //   3. default: active-league cookie if it's a viewer league, else first
  //      viewer league, else BDL Universe (guests, admins not in any league)
  let scope: Scope;
  if (requestedScope === "all" || !session) {
    scope = "all";
  } else if (requestedScope && viewerLeagueIds.includes(requestedScope)) {
    scope = requestedScope;
  } else if (activeLeagueId && viewerLeagueIds.includes(activeLeagueId)) {
    scope = activeLeagueId;
  } else if (viewerLeagueIds.length > 0) {
    scope = viewerLeagueIds[0];
  } else {
    scope = "all";
  }

  // Add Player vs Invite Player split:
  //   - Admin view → direct Add Player (all leagues optional)
  //   - Commissioner view → Invite Player (their managed leagues only)
  //   - Player view → no add/invite UI
  const isAdminView = caps.view === "admin" && isAdminLike(session);

  // Directory query: filter to JUST the selected league when scope
  // is a UUID; show every viewer league when scope === "all" was
  // chosen via the tab (which is really a "show me everyone" view).
  const players = await getPlayersDirectory({
    scope: scope === "all" ? "all" : "league",
    viewerLeagueIds: scope === "all" ? viewerLeagueIds : [scope],
    viewerIsAdmin: isAdminView,
  });

  // League-scoped grade attribution. The grade pill on each card
  // is for the selected league only — there is no global grade.
  // In BDL Universe scope, the pill is hidden so we never imply a
  // grade lives outside its league.
  const gradeLeagueId = scope === "all" ? null : scope;

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

  // Tabs: one per league the viewer is in (by name), plus BDL
  // Universe at the end. Drives the whole filter rather than the
  // generic "My League" lump.
  const viewerLeagueTabs =
    viewerLeagueIds.length > 0
      ? await db
          .select({ id: leaguesTbl.id, name: leaguesTbl.name })
          .from(leaguesTbl)
          .where(inArray(leaguesTbl.id, viewerLeagueIds))
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

        <ScopeTabs current={scope} leagues={viewerLeagueTabs} />

        <PlayersGrid
          players={playersWithGrade}
          gradeLeagueName={gradeLeagueName}
        />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}

function ScopeTabs({
  current,
  leagues,
}: {
  current: Scope;
  leagues: { id: string; name: string }[];
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {leagues.map((l) => (
        <ScopeTab key={l.id} value={l.id} current={current}>
          {l.name}
        </ScopeTab>
      ))}
      <ScopeTab value="all" current={current}>
        BDL Universe
      </ScopeTab>
    </div>
  );
}

function ScopeTab({
  value,
  current,
  children,
}: {
  value: Scope;
  current: Scope;
  children: React.ReactNode;
}) {
  const isActive = current === value;
  return (
    <Link
      href={`/players?scope=${value}`}
      className={`inline-flex items-center h-9 px-4 rounded-full text-[12px] font-semibold tracking-[0.04em] uppercase transition-colors border ${
        isActive
          ? "bg-[color:var(--brand)] text-white border-transparent"
          : "bg-[color:var(--surface)] border-[color:var(--hairline-2)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
      }`}
    >
      {children}
    </Link>
  );
}

