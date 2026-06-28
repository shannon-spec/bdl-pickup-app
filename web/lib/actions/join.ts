"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  joinRequests,
  leaguePlayers,
  leagueCommissioners,
  teamPlayers,
  teamCommissioners,
  tournamentMembers,
  communityMembers,
} from "@/lib/db";
import { readSession, type Session } from "@/lib/auth/session";
import { isAdminLike, canManageLeague, canManageTeam } from "@/lib/auth/perms";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type CtxType = "LEAGUE" | "TOURNAMENT" | "TEAM" | "COMMUNITY";

async function canManageContext(
  session: Session | null,
  type: CtxType,
  id: string,
): Promise<boolean> {
  if (isAdminLike(session)) return true;
  if (!session?.playerId) return false;
  if (type === "LEAGUE") return canManageLeague(session, id);
  if (type === "TEAM") return canManageTeam(session, id);
  const table = type === "TOURNAMENT" ? tournamentMembers : communityMembers;
  const ctxCol =
    type === "TOURNAMENT"
      ? tournamentMembers.tournamentId
      : communityMembers.communityId;
  const playerCol =
    type === "TOURNAMENT"
      ? tournamentMembers.playerId
      : communityMembers.playerId;
  const roleCol =
    type === "TOURNAMENT" ? tournamentMembers.role : communityMembers.role;
  const [r] = await db
    .select({ role: roleCol })
    .from(table)
    .where(and(eq(ctxCol, id), eq(playerCol, session.playerId)))
    .limit(1);
  return r?.role === "DIRECTOR" || r?.role === "COMMISSIONER";
}

async function alreadyMember(
  type: CtxType,
  id: string,
  playerId: string,
): Promise<boolean> {
  if (type === "LEAGUE") {
    const [r] = await db.select({ p: leaguePlayers.playerId }).from(leaguePlayers).where(and(eq(leaguePlayers.leagueId, id), eq(leaguePlayers.playerId, playerId))).limit(1);
    return !!r;
  }
  if (type === "TEAM") {
    const [r] = await db.select({ p: teamPlayers.playerId }).from(teamPlayers).where(and(eq(teamPlayers.teamId, id), eq(teamPlayers.playerId, playerId))).limit(1);
    return !!r;
  }
  if (type === "TOURNAMENT") {
    const [r] = await db.select({ p: tournamentMembers.playerId }).from(tournamentMembers).where(and(eq(tournamentMembers.tournamentId, id), eq(tournamentMembers.playerId, playerId))).limit(1);
    return !!r;
  }
  const [r] = await db.select({ p: communityMembers.playerId }).from(communityMembers).where(and(eq(communityMembers.communityId, id), eq(communityMembers.playerId, playerId))).limit(1);
  return !!r;
}

async function addToRoster(type: CtxType, id: string, playerId: string) {
  if (type === "LEAGUE")
    await db.insert(leaguePlayers).values({ leagueId: id, playerId }).onConflictDoNothing();
  else if (type === "TEAM")
    await db.insert(teamPlayers).values({ teamId: id, playerId }).onConflictDoNothing();
  else if (type === "TOURNAMENT")
    await db.insert(tournamentMembers).values({ tournamentId: id, playerId, role: "PLAYER", status: "active" }).onConflictDoNothing();
  else
    await db.insert(communityMembers).values({ communityId: id, playerId, role: "MEMBER", status: "active" }).onConflictDoNothing();
}

/** Player requests to join a league/team/etc. (Phase 2, Step 4). */
export async function requestToJoin(
  contextType: CtxType,
  contextId: string,
  message: string,
): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId)
    return { ok: false, error: "Sign in to request to join." };
  const pid = session.playerId;

  if (await alreadyMember(contextType, contextId, pid))
    return { ok: false, error: "You're already a member." };

  // Re-open a denied/old request, or block duplicate active ones.
  const existing = await db
    .select({ id: joinRequests.id, status: joinRequests.status })
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.playerId, pid),
        eq(joinRequests.contextType, contextType),
        eq(joinRequests.contextId, contextId),
      ),
    );
  if (existing.some((r) => r.status === "pending" || r.status === "hold"))
    return { ok: false, error: "Your request is already in review." };

  await db.insert(joinRequests).values({
    playerId: pid,
    contextType,
    contextId,
    message: message?.trim() || null,
    status: "pending",
  });
  revalidatePath("/discover");
  return { ok: true, data: null };
}

export async function cancelJoinRequest(
  requestId: string,
): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: "Not signed in." };
  await db
    .delete(joinRequests)
    .where(
      and(eq(joinRequests.id, requestId), eq(joinRequests.playerId, session.playerId)),
    );
  revalidatePath("/discover");
  return { ok: true, data: null };
}

/** Commissioner accepts / holds / denies a request (Phase 2, Step 5). */
export async function decideJoinRequest(
  requestId: string,
  decision: "accept" | "hold" | "deny",
): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: "Not signed in." };

  const [req] = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, requestId))
    .limit(1);
  if (!req) return { ok: false, error: "Request not found." };

  const type = req.contextType as CtxType;
  if (!(await canManageContext(session, type, req.contextId)))
    return { ok: false, error: "Not allowed." };

  if (decision === "accept") {
    await addToRoster(type, req.contextId, req.playerId);
  }
  await db
    .update(joinRequests)
    .set({
      status:
        decision === "accept"
          ? "accepted"
          : decision === "hold"
            ? "hold"
            : "denied",
      decidedBy: session.playerId,
      decidedAt: new Date(),
    })
    .where(eq(joinRequests.id, requestId));

  revalidatePath("/manage/requests");
  revalidatePath("/discover");
  return { ok: true, data: null };
}

/** Bulk helper used by the queue page to know which ids a manager owns. */
export async function managedContextIds(session: Session | null): Promise<{
  league: string[];
  team: string[];
  tournament: string[];
  community: string[];
  admin: boolean;
}> {
  if (isAdminLike(session))
    return { league: [], team: [], tournament: [], community: [], admin: true };
  if (!session?.playerId)
    return { league: [], team: [], tournament: [], community: [], admin: false };
  const pid = session.playerId;
  const [lc, tc, tm, cm] = await Promise.all([
    db.select({ id: leagueCommissioners.leagueId }).from(leagueCommissioners).where(eq(leagueCommissioners.playerId, pid)),
    db.select({ id: teamCommissioners.teamId }).from(teamCommissioners).where(eq(teamCommissioners.playerId, pid)),
    db.select({ id: tournamentMembers.tournamentId }).from(tournamentMembers).where(and(eq(tournamentMembers.playerId, pid), inArray(tournamentMembers.role, ["DIRECTOR", "COMMISSIONER"]))),
    db.select({ id: communityMembers.communityId }).from(communityMembers).where(and(eq(communityMembers.playerId, pid), inArray(communityMembers.role, ["DIRECTOR", "COMMISSIONER"]))),
  ]);
  return {
    league: lc.map((r) => r.id),
    team: tc.map((r) => r.id),
    tournament: tm.map((r) => r.id),
    community: cm.map((r) => r.id),
    admin: false,
  };
}
