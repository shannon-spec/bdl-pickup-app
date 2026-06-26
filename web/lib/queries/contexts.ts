import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  leagues,
  leaguePlayers,
  leagueCommissioners,
  teams,
  teamPlayers,
  teamCommissioners,
  tournaments,
  tournamentMembers,
  communities,
  communityMembers,
} from "@/lib/db";
import type { Session } from "@/lib/auth/session";

export type ContextType = "LEAGUE" | "TOURNAMENT" | "TEAM" | "COMMUNITY";
export type ContextRole =
  | "PLAYER"
  | "CAPTAIN"
  | "COACH"
  | "COMMISSIONER"
  | "DIRECTOR"
  | "MEMBER"
  | "FAN";

/** A context the viewer belongs to, with their contextual role. */
export type MyContext = {
  type: ContextType;
  id: string;
  name: string;
  role: ContextRole;
  /** True when the role can administer the context. */
  manage: boolean;
  avatarKind: string;
  avatarColor: string;
  avatarEmoji: string | null;
  /** Where the context's detail/manage page lives. */
  href: string;
};

const MANAGER_ROLES = new Set<ContextRole>([
  "COMMISSIONER",
  "DIRECTOR",
  "COACH",
]);

/**
 * Every context the viewer is a member/manager of, unified across the
 * existing league/team tables and the new tournament/community tables.
 * Roles are derived from membership, never stored on the user.
 * Ordered: leagues, teams, tournaments, communities — alpha within each.
 */
export async function getMyContexts(s: Session | null): Promise<MyContext[]> {
  if (!s) return [];
  const pid = s.playerId;
  const isSuperAdmin = s.role === "owner" || s.role === "super_admin";
  const out: MyContext[] = [];

  // ---- LEAGUES ----
  if (pid) {
    const [memberRows, commRows] = await Promise.all([
      db
        .select({ leagueId: leaguePlayers.leagueId })
        .from(leaguePlayers)
        .where(eq(leaguePlayers.playerId, pid)),
      db
        .select({ leagueId: leagueCommissioners.leagueId })
        .from(leagueCommissioners)
        .where(eq(leagueCommissioners.playerId, pid)),
    ]);
    const commSet = new Set(commRows.map((r) => r.leagueId));
    const ids = Array.from(
      new Set([...memberRows.map((r) => r.leagueId), ...commSet]),
    );
    if (ids.length > 0) {
      const rows = await db
        .select({
          id: leagues.id,
          name: leagues.name,
          avatarKind: leagues.avatarKind,
          avatarColor: leagues.avatarColor,
          avatarEmoji: leagues.avatarEmoji,
        })
        .from(leagues)
        .where(and(inArray(leagues.id, ids), isNull(leagues.hiddenAt)))
        .orderBy(asc(leagues.name));
      for (const r of rows) {
        const isComm = commSet.has(r.id);
        out.push({
          type: "LEAGUE",
          id: r.id,
          name: r.name,
          role: isComm ? "COMMISSIONER" : "PLAYER",
          manage: isComm,
          avatarKind: r.avatarKind,
          avatarColor: r.avatarColor,
          avatarEmoji: r.avatarEmoji,
          href: `/leagues/${r.id}`,
        });
      }
    }
  } else if (isSuperAdmin) {
    const rows = await db
      .select({
        id: leagues.id,
        name: leagues.name,
        avatarKind: leagues.avatarKind,
        avatarColor: leagues.avatarColor,
        avatarEmoji: leagues.avatarEmoji,
      })
      .from(leagues)
      .where(isNull(leagues.hiddenAt))
      .orderBy(asc(leagues.name));
    for (const r of rows) {
      out.push({
        type: "LEAGUE",
        id: r.id,
        name: r.name,
        role: "COMMISSIONER",
        manage: true,
        avatarKind: r.avatarKind,
        avatarColor: r.avatarColor,
        avatarEmoji: r.avatarEmoji,
        href: `/leagues/${r.id}`,
      });
    }
  }

  if (!pid) return out;

  // ---- TEAMS ----
  const [teamMemRows, teamCommRows] = await Promise.all([
    db.select({ teamId: teamPlayers.teamId }).from(teamPlayers).where(eq(teamPlayers.playerId, pid)),
    db
      .select({ teamId: teamCommissioners.teamId })
      .from(teamCommissioners)
      .where(eq(teamCommissioners.playerId, pid)),
  ]);
  const teamCommSet = new Set(teamCommRows.map((r) => r.teamId));
  const teamIds = Array.from(
    new Set([...teamMemRows.map((r) => r.teamId), ...teamCommSet]),
  );
  if (teamIds.length > 0) {
    const rows = await db
      .select({
        id: teams.id,
        name: teams.name,
        avatarKind: teams.avatarKind,
        avatarColor: teams.avatarColor,
        avatarEmoji: teams.avatarEmoji,
      })
      .from(teams)
      .where(and(inArray(teams.id, teamIds), isNull(teams.hiddenAt)))
      .orderBy(asc(teams.name));
    for (const r of rows) {
      const isCoach = teamCommSet.has(r.id);
      out.push({
        type: "TEAM",
        id: r.id,
        name: r.name,
        role: isCoach ? "COACH" : "PLAYER",
        manage: isCoach,
        avatarKind: r.avatarKind,
        avatarColor: r.avatarColor,
        avatarEmoji: r.avatarEmoji,
        href: `/teams/${r.id}`,
      });
    }
  }

  // ---- TOURNAMENTS ----
  const tourRows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      avatarKind: tournaments.avatarKind,
      avatarColor: tournaments.avatarColor,
      avatarEmoji: tournaments.avatarEmoji,
      role: tournamentMembers.role,
    })
    .from(tournamentMembers)
    .innerJoin(tournaments, eq(tournaments.id, tournamentMembers.tournamentId))
    .where(
      and(
        eq(tournamentMembers.playerId, pid),
        eq(tournamentMembers.status, "active"),
        isNull(tournaments.hiddenAt),
      ),
    )
    .orderBy(asc(tournaments.name));
  for (const r of tourRows) {
    const role = r.role as ContextRole;
    out.push({
      type: "TOURNAMENT",
      id: r.id,
      name: r.name,
      role,
      manage: MANAGER_ROLES.has(role),
      avatarKind: r.avatarKind,
      avatarColor: r.avatarColor,
      avatarEmoji: r.avatarEmoji,
      href: `/manage/tournament/${r.id}`,
    });
  }

  // ---- COMMUNITIES ----
  const commRows = await db
    .select({
      id: communities.id,
      name: communities.name,
      avatarKind: communities.avatarKind,
      avatarColor: communities.avatarColor,
      avatarEmoji: communities.avatarEmoji,
      role: communityMembers.role,
    })
    .from(communityMembers)
    .innerJoin(communities, eq(communities.id, communityMembers.communityId))
    .where(
      and(
        eq(communityMembers.playerId, pid),
        eq(communityMembers.status, "active"),
        isNull(communities.hiddenAt),
      ),
    )
    .orderBy(asc(communities.name));
  for (const r of commRows) {
    const role = r.role as ContextRole;
    out.push({
      type: "COMMUNITY",
      id: r.id,
      name: r.name,
      role,
      manage: MANAGER_ROLES.has(role) || role === "MEMBER",
      avatarKind: r.avatarKind,
      avatarColor: r.avatarColor,
      avatarEmoji: r.avatarEmoji,
      href: `/manage`,
    });
  }

  return out;
}

/** Resolve the viewer's active context, honoring the persisted ref, else
 *  the first context. Returns null when the viewer has no contexts. */
export function resolveActiveContext(
  contexts: MyContext[],
  ref: { type: ContextType; id: string } | null,
): MyContext | null {
  if (contexts.length === 0) return null;
  if (ref) {
    const found = contexts.find((c) => c.type === ref.type && c.id === ref.id);
    if (found) return found;
  }
  return contexts[0];
}
