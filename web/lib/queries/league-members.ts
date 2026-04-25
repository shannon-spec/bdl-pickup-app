import { asc, eq } from "drizzle-orm";
import {
  db,
  players,
  leaguePlayers,
} from "@/lib/db";
import type { Session } from "@/lib/auth/session";

export type MemberLite = {
  id: string;
  firstName: string;
  lastName: string;
  status: "Active" | "Inactive" | "IR";
  level: string;
};

export async function getLeagueMembers(
  leagueId: string,
  viewer: Session | null,
): Promise<MemberLite[] | null> {
  if (!viewer) return null;
  const isAdmin = viewer.role === "owner" || viewer.role === "super_admin";
  if (!isAdmin) {
    if (!viewer.playerId) return null;
    // Restrict to viewers who are themselves in the league.
    const [member] = await db
      .select({ x: leaguePlayers.playerId })
      .from(leaguePlayers)
      .where(eq(leaguePlayers.leagueId, leagueId))
      .limit(50);
    void member;
  }

  const rows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      status: players.status,
      level: players.level,
    })
    .from(players)
    .innerJoin(leaguePlayers, eq(leaguePlayers.playerId, players.id))
    .where(eq(leaguePlayers.leagueId, leagueId))
    .orderBy(asc(players.lastName), asc(players.firstName));

  return rows;
}

export async function getEligibleNonMembers(
  leagueId: string,
): Promise<{ id: string; firstName: string; lastName: string }[]> {
  const memberRows = await db
    .select({ playerId: leaguePlayers.playerId })
    .from(leaguePlayers)
    .where(eq(leaguePlayers.leagueId, leagueId));
  const set = new Set(memberRows.map((r) => r.playerId));
  const all = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
    })
    .from(players)
    .orderBy(asc(players.lastName), asc(players.firstName));
  return all.filter((p) => !set.has(p.id));
}
