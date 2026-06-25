/**
 * Permission helpers used by server actions and pages.
 *
 * Roles:
 *   - owner / super_admin → admin-like, full access
 *   - commissioner of league L → can manage L (details, roster, games),
 *     but cannot delete L, manage super admins, or modify other leagues
 *   - everyone else (signed-in players) → read-only
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  leagueCommissioners,
  leaguePlayers,
  games,
  teamCommissioners,
  teamPlayers,
} from "@/lib/db";
import { readSession, type Session } from "./session";

export function isAdminLike(s: Session | null): boolean {
  return !!s && (s.role === "owner" || s.role === "super_admin");
}

export async function isCommissionerOf(
  s: Session | null,
  leagueId: string,
): Promise<boolean> {
  if (!s || !s.playerId) return false;
  const [row] = await db
    .select({ playerId: leagueCommissioners.playerId })
    .from(leagueCommissioners)
    .where(
      and(
        eq(leagueCommissioners.leagueId, leagueId),
        eq(leagueCommissioners.playerId, s.playerId),
      ),
    )
    .limit(1);
  return !!row;
}

export async function getMyCommissionerLeagueIds(
  s: Session | null,
): Promise<string[]> {
  if (!s || !s.playerId) return [];
  const rows = await db
    .select({ leagueId: leagueCommissioners.leagueId })
    .from(leagueCommissioners)
    .where(eq(leagueCommissioners.playerId, s.playerId));
  return rows.map((r) => r.leagueId);
}

export async function getMyMemberLeagueIds(
  s: Session | null,
): Promise<string[]> {
  if (!s || !s.playerId) return [];
  const rows = await db
    .select({ leagueId: leaguePlayers.leagueId })
    .from(leaguePlayers)
    .where(eq(leaguePlayers.playerId, s.playerId));
  return rows.map((r) => r.leagueId);
}

/** True for admin-like OR commissioner of the given league. */
export async function canManageLeague(
  s: Session | null,
  leagueId: string,
): Promise<boolean> {
  if (isAdminLike(s)) return true;
  return isCommissionerOf(s, leagueId);
}

/* ---------- Teams (travel teams) — mirrors the league helpers ---------- */

export async function isTeamCommissionerOf(
  s: Session | null,
  teamId: string,
): Promise<boolean> {
  if (!s || !s.playerId) return false;
  const [row] = await db
    .select({ playerId: teamCommissioners.playerId })
    .from(teamCommissioners)
    .where(
      and(
        eq(teamCommissioners.teamId, teamId),
        eq(teamCommissioners.playerId, s.playerId),
      ),
    )
    .limit(1);
  return !!row;
}

export async function getMyCommissionerTeamIds(
  s: Session | null,
): Promise<string[]> {
  if (!s || !s.playerId) return [];
  const rows = await db
    .select({ teamId: teamCommissioners.teamId })
    .from(teamCommissioners)
    .where(eq(teamCommissioners.playerId, s.playerId));
  return rows.map((r) => r.teamId);
}

/** True for admin-like OR commissioner of the given team. */
export async function canManageTeam(
  s: Session | null,
  teamId: string,
): Promise<boolean> {
  if (isAdminLike(s)) return true;
  return isTeamCommissionerOf(s, teamId);
}

/** True for admin-like OR commissioner of the game's league (intra-league
 *  game), OR commissioner of either team (team-vs-team game). */
export async function canManageGame(
  s: Session | null,
  gameId: string,
): Promise<boolean> {
  if (isAdminLike(s)) return true;
  if (!s || !s.playerId) return false;
  const [g] = await db
    .select({
      leagueId: games.leagueId,
      teamAId: games.teamAId,
      teamBId: games.teamBId,
    })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!g) return false;
  if (g.leagueId) return isCommissionerOf(s, g.leagueId);
  if (
    (g.teamAId && (await isTeamCommissionerOf(s, g.teamAId))) ||
    (g.teamBId && (await isTeamCommissionerOf(s, g.teamBId)))
  ) {
    return true;
  }
  return false;
}

/**
 * True for admin-like, the player themselves, or any commissioner of
 * a league the target player is rostered in. Used to gate the Edit
 * Profile surface on /players/[id] and the underlying updatePlayer
 * action.
 */
export async function canEditPlayer(
  s: Session | null,
  playerId: string,
): Promise<boolean> {
  if (isAdminLike(s)) return true;
  if (!s || !s.playerId) return false;
  if (s.playerId === playerId) return true;
  // Any overlap between the target player's leagues and leagues the
  // viewer commissions.
  const targetLeagues = await db
    .select({ leagueId: leaguePlayers.leagueId })
    .from(leaguePlayers)
    .where(eq(leaguePlayers.playerId, playerId));
  if (targetLeagues.length === 0) return false;
  const targetIds = targetLeagues.map((r) => r.leagueId);
  const [overlap] = await db
    .select({ leagueId: leagueCommissioners.leagueId })
    .from(leagueCommissioners)
    .where(
      and(
        eq(leagueCommissioners.playerId, s.playerId),
        inArray(leagueCommissioners.leagueId, targetIds),
      ),
    )
    .limit(1);
  return !!overlap;
}

/** True for admin-like OR any member (player/commissioner) of the game's league. */
export async function canViewGame(
  s: Session | null,
  gameId: string,
): Promise<boolean> {
  if (isAdminLike(s)) return true;
  if (!s || !s.playerId) return false;
  const [g] = await db
    .select({
      leagueId: games.leagueId,
      teamAId: games.teamAId,
      teamBId: games.teamBId,
    })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!g) return false;

  // Team-vs-team game: visible to commissioners or rostered players of
  // either team.
  if (!g.leagueId) {
    if (await canManageGame(s, gameId)) return true;
    const teamIds = [g.teamAId, g.teamBId].filter(Boolean) as string[];
    if (teamIds.length === 0) return false;
    const [onTeam] = await db
      .select({ playerId: teamPlayers.playerId })
      .from(teamPlayers)
      .where(
        and(
          inArray(teamPlayers.teamId, teamIds),
          eq(teamPlayers.playerId, s.playerId),
        ),
      )
      .limit(1);
    return !!onTeam;
  }

  if (await isCommissionerOf(s, g.leagueId)) return true;
  const [member] = await db
    .select({ playerId: leaguePlayers.playerId })
    .from(leaguePlayers)
    .where(
      and(
        eq(leaguePlayers.leagueId, g.leagueId),
        eq(leaguePlayers.playerId, s.playerId),
      ),
    )
    .limit(1);
  return !!member;
}

/* ---------- Throwing variants for server actions ---------- */

export async function requireLeagueManager(leagueId: string): Promise<Session> {
  const s = await readSession();
  if (!s) throw new Error("Not authenticated.");
  if (await canManageLeague(s, leagueId)) return s;
  throw new Error("Forbidden — you don't manage this league.");
}

export async function requireGameManager(gameId: string): Promise<Session> {
  const s = await readSession();
  if (!s) throw new Error("Not authenticated.");
  if (await canManageGame(s, gameId)) return s;
  throw new Error("Forbidden — you don't manage this game.");
}

export async function requireTeamManager(teamId: string): Promise<Session> {
  const s = await readSession();
  if (!s) throw new Error("Not authenticated.");
  if (await canManageTeam(s, teamId)) return s;
  throw new Error("Forbidden — you don't manage this team.");
}

/** Owner / super_admin only — for league deletion + super admin mgmt. */
export async function requireAdminOnly(): Promise<Session> {
  const s = await readSession();
  if (!s) throw new Error("Not authenticated.");
  if (!isAdminLike(s)) throw new Error("Forbidden — admin only.");
  return s;
}
