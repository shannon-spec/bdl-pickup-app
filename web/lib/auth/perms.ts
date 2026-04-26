/**
 * Permission helpers used by server actions and pages.
 *
 * Roles:
 *   - owner / super_admin → admin-like, full access
 *   - commissioner of league L → can manage L (details, roster, games),
 *     but cannot delete L, manage super admins, or modify other leagues
 *   - everyone else (signed-in players) → read-only
 */
import { and, eq } from "drizzle-orm";
import { db, leagueCommissioners, leaguePlayers, games } from "@/lib/db";
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

/** True for admin-like OR commissioner of the game's league. */
export async function canManageGame(
  s: Session | null,
  gameId: string,
): Promise<boolean> {
  if (isAdminLike(s)) return true;
  if (!s || !s.playerId) return false;
  const [g] = await db
    .select({ leagueId: games.leagueId })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!g?.leagueId) return false;
  return isCommissionerOf(s, g.leagueId);
}

/** True for admin-like OR any member (player/commissioner) of the game's league. */
export async function canViewGame(
  s: Session | null,
  gameId: string,
): Promise<boolean> {
  if (isAdminLike(s)) return true;
  if (!s || !s.playerId) return false;
  const [g] = await db
    .select({ leagueId: games.leagueId })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  if (!g?.leagueId) return false;
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

/** Owner / super_admin only — for league deletion + super admin mgmt. */
export async function requireAdminOnly(): Promise<Session> {
  const s = await readSession();
  if (!s) throw new Error("Not authenticated.");
  if (!isAdminLike(s)) throw new Error("Forbidden — admin only.");
  return s;
}
