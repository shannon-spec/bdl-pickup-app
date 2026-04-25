import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
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
import { Pill } from "@/components/bdl/pill";
import {
  getPlayersDirectory,
  type DirectoryPlayer,
} from "@/lib/queries/players-directory";
import { db, leagues as leaguesTbl } from "@/lib/db";
import { asc, inArray } from "drizzle-orm";
import { InviteControls } from "./invite-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Players · BDL" };

type Scope = "league" | "all";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: Scope }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login");
  const caps = await getViewCaps(session);

  const sp = await searchParams;
  const scope: Scope = sp.scope === "all" ? "all" : "league";

  const [memberIds, commishIds] = await Promise.all([
    getMyMemberLeagueIds(session),
    getMyCommissionerLeagueIds(session),
  ]);
  const viewerLeagueIds = Array.from(new Set([...memberIds, ...commishIds]));

  const players = await getPlayersDirectory({
    scope,
    viewerLeagueIds,
  });

  // Invite UI: visible only to commish/admin views with at least one
  // league they manage. Player view never sees it.
  const canInvite = caps.canManage;
  const manageLeagueIds =
    caps.view === "admin" && isAdminLike(session)
      ? null // admin: all leagues
      : commishIds;
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

  const userInitials = session.username.slice(0, 2).toUpperCase();

  return (
    <>
      <TopBar active="/players" userInitials={userInitials} />
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
            canInvite && inviteLeagues.length > 0 ? (
              <InviteControls leagues={inviteLeagues} />
            ) : null
          }
        />

        <ScopeTabs current={scope} />

        {players.length === 0 ? (
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
            No players to show.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-2 max-sm:grid-cols-1">
            {players.map((p) => (
              <PlayerCard key={p.id} p={p} />
            ))}
          </div>
        )}
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

function PlayerCard({ p }: { p: DirectoryPlayer }) {
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
  return (
    <Link
      href={`/players/${p.id}`}
      className="group flex items-center gap-3 rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-2)] transition-colors px-4 py-3"
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-extrabold text-[13px] flex-shrink-0"
        style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-2))" }}
      >
        {initials}
      </span>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-bold text-[14px] truncate group-hover:text-[color:var(--brand)]">
          {p.firstName} {p.lastName}
        </span>
        <span className="text-[11.5px] text-[color:var(--text-3)] truncate">
          {p.position ? `${p.position} · ` : ""}
          {p.leagueNames.length > 0 ? p.leagueNames.join(", ") : "No league"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {p.status !== "Active" && (
          <Pill tone={p.status === "IR" ? "loss" : "neutral"}>{p.status}</Pill>
        )}
        <ChevronRight size={14} className="text-[color:var(--text-4)]" />
      </div>
    </Link>
  );
}
