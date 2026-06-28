"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  leagueCommissioners,
  tournamentMembers,
  communityMembers,
  organizeInvitations,
} from "@/lib/db";
import { readSession, type Session } from "@/lib/auth/session";
import { isAdminLike, canManageLeague } from "@/lib/auth/perms";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type CtxType = "LEAGUE" | "TOURNAMENT" | "COMMUNITY";

const ROLE_FOR: Record<CtxType, "COMMISSIONER" | "DIRECTOR"> = {
  LEAGUE: "COMMISSIONER",
  TOURNAMENT: "DIRECTOR",
  COMMUNITY: "DIRECTOR",
};

function manageHref(type: CtxType, id: string) {
  if (type === "LEAGUE") return `/manage/league/${id}`;
  if (type === "TOURNAMENT") return `/manage/tournament/${id}`;
  return `/manage/community/${id}`;
}

async function canManageContext(
  session: Session | null,
  type: CtxType,
  id: string,
): Promise<boolean> {
  if (isAdminLike(session)) return true;
  if (!session?.playerId) return false;
  if (type === "LEAGUE") return canManageLeague(session, id);
  if (type === "TOURNAMENT") {
    const [r] = await db
      .select({ role: tournamentMembers.role })
      .from(tournamentMembers)
      .where(
        and(
          eq(tournamentMembers.tournamentId, id),
          eq(tournamentMembers.playerId, session.playerId),
        ),
      )
      .limit(1);
    return r?.role === "DIRECTOR" || r?.role === "COMMISSIONER";
  }
  const [r] = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(
      and(
        eq(communityMembers.communityId, id),
        eq(communityMembers.playerId, session.playerId),
      ),
    )
    .limit(1);
  return r?.role === "DIRECTOR" || r?.role === "COMMISSIONER" || r?.role === "MEMBER";
}

async function grantMembership(type: CtxType, id: string, playerId: string) {
  if (type === "LEAGUE") {
    await db
      .insert(leagueCommissioners)
      .values({ leagueId: id, playerId })
      .onConflictDoNothing();
  } else if (type === "TOURNAMENT") {
    await db
      .insert(tournamentMembers)
      .values({ tournamentId: id, playerId, role: "DIRECTOR", status: "active" })
      .onConflictDoNothing();
  } else {
    await db
      .insert(communityMembers)
      .values({ communityId: id, playerId, role: "DIRECTOR", status: "active" })
      .onConflictDoNothing();
  }
}

/** Create a shareable co-organizer invite link for a context. */
export async function createOrganizerInvite(
  contextType: CtxType,
  contextId: string,
): Promise<ActionResult<{ token: string }>> {
  const session = await readSession();
  if (!(await canManageContext(session, contextType, contextId)))
    return { ok: false, error: "Not allowed." };

  const token = randomBytes(16).toString("hex");
  await db.insert(organizeInvitations).values({
    contextType,
    contextId,
    roleGranted: ROLE_FOR[contextType],
    channel: "link",
    token,
    status: "pending",
    invitedBy: session?.playerId ?? null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  });
  revalidatePath(manageHref(contextType, contextId));
  return { ok: true, data: { token } };
}

/** Accept an invite — grants the organizer role to the signed-in user. */
export async function acceptInvite(
  token: string,
): Promise<ActionResult<{ redirect: string }>> {
  const session = await readSession();
  if (!session?.playerId)
    return { ok: false, error: "Sign in to accept this invite." };

  const [inv] = await db
    .select()
    .from(organizeInvitations)
    .where(eq(organizeInvitations.token, token))
    .limit(1);
  if (!inv) return { ok: false, error: "Invite not found." };
  if (inv.status !== "pending")
    return { ok: false, error: "This invite was already used or revoked." };
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now())
    return { ok: false, error: "This invite has expired." };

  const type = inv.contextType as CtxType;
  await grantMembership(type, inv.contextId, session.playerId);
  await db
    .update(organizeInvitations)
    .set({ status: "accepted", acceptedBy: session.playerId })
    .where(eq(organizeInvitations.id, inv.id));

  revalidatePath(manageHref(type, inv.contextId));
  return { ok: true, data: { redirect: manageHref(type, inv.contextId) } };
}

/** Revoke a pending invite. */
export async function revokeInvite(token: string): Promise<ActionResult<null>> {
  const [inv] = await db
    .select()
    .from(organizeInvitations)
    .where(eq(organizeInvitations.token, token))
    .limit(1);
  if (!inv) return { ok: false, error: "Not found." };
  const session = await readSession();
  if (
    !(await canManageContext(
      session,
      inv.contextType as CtxType,
      inv.contextId,
    ))
  )
    return { ok: false, error: "Not allowed." };
  await db
    .update(organizeInvitations)
    .set({ status: "revoked" })
    .where(eq(organizeInvitations.id, inv.id));
  revalidatePath(manageHref(inv.contextType as CtxType, inv.contextId));
  return { ok: true, data: null };
}

/** Read an invite for the join page (context label + role + validity). */
export async function getInvite(token: string): Promise<{
  valid: boolean;
  reason?: string;
  contextType?: CtxType;
  role?: string;
} | null> {
  const [inv] = await db
    .select()
    .from(organizeInvitations)
    .where(eq(organizeInvitations.token, token))
    .limit(1);
  if (!inv) return { valid: false, reason: "Invite not found." };
  if (inv.status !== "pending")
    return { valid: false, reason: "This invite was already used or revoked." };
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now())
    return { valid: false, reason: "This invite has expired." };
  return {
    valid: true,
    contextType: inv.contextType as CtxType,
    role: inv.roleGranted,
  };
}
