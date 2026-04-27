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
import { db, leagues as leaguesTbl } from "@/lib/db";
import { asc, inArray } from "drizzle-orm";
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
  const crowdGrades = await getCrowdGradesForPlayers(players.map((p) => p.id));
  const playersWithGrade = players.map((p) => {
    const crowd = crowdGrades.get(p.id) ?? null;
    const adminLevel: GradeKey | null =
      p.level && p.level !== "Not Rated" && isGradeKey(p.level)
        ? p.level
        : null;
    return { ...p, displayGrade: crowd ?? adminLevel };
  });
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

        <PlayersGrid players={playersWithGrade} />
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

