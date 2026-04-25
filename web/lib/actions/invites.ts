"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  invites,
  leagues,
  leaguePlayers,
  players,
} from "@/lib/db";
import { requireLeagueManager } from "@/lib/auth/perms";
import { requireManageView } from "@/lib/auth/view";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const createSchema = z.object({
  leagueId: z.string().uuid(),
  firstName: z.string().trim().min(1, "First name required.").max(60),
  lastName: z.string().trim().min(1, "Last name required.").max(60),
  email: z.string().trim().email("Valid email required.").max(120),
  cell: z.string().trim().max(40).optional().or(z.literal("")),
});

const acceptSchema = z.object({
  inviteId: z.string().uuid(),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(2).optional().or(z.literal("")),
  position: z.string().trim().max(20).optional().or(z.literal("")),
});

const readForm = (fd: FormData) => {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
};

const nullable = (s?: string | null) => {
  const t = (s ?? "").trim();
  return t.length === 0 ? null : t;
};

/** Commissioner of the league or admin can invite. */
export async function createInvite(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  const session = await requireLeagueManager(v.leagueId);
  await requireManageView();

  const [league] = await db
    .select({ id: leagues.id, name: leagues.name })
    .from(leagues)
    .where(eq(leagues.id, v.leagueId))
    .limit(1);
  if (!league) return { ok: false, error: "League not found." };

  const [row] = await db
    .insert(invites)
    .values({
      leagueId: league.id,
      leagueName: league.name,
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      cell: nullable(v.cell),
      invitedBy: session.playerId,
      status: "pending",
    })
    .returning({ id: invites.id });

  revalidatePath(`/leagues/${v.leagueId}`);
  return { ok: true, data: { id: row.id } };
}

export async function deleteInvite(inviteId: string): Promise<ActionResult> {
  // Look up the invite first to authorize against its league.
  const [inv] = await db
    .select({ leagueId: invites.leagueId })
    .from(invites)
    .where(eq(invites.id, inviteId))
    .limit(1);
  if (!inv) return { ok: false, error: "Invite not found." };
  if (inv.leagueId) await requireLeagueManager(inv.leagueId);
  await requireManageView();

  await db.delete(invites).where(eq(invites.id, inviteId));
  if (inv.leagueId) revalidatePath(`/leagues/${inv.leagueId}`);
  return { ok: true };
}

/**
 * Public action — called from /invite/[id] when a player accepts.
 * Creates the player record, links them to the league, and marks the
 * invite accepted. No auth required (the invite ID is the bearer
 * token).
 */
export async function acceptInvite(
  formData: FormData,
): Promise<ActionResult<{ playerId: string }>> {
  const parsed = acceptSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;

  const [inv] = await db
    .select()
    .from(invites)
    .where(eq(invites.id, v.inviteId))
    .limit(1);
  if (!inv) return { ok: false, error: "Invite not found." };
  if (inv.status !== "pending") {
    return { ok: false, error: "This invite has already been used." };
  }

  // Create the player. If a player with the same email already exists,
  // re-use it instead of creating a duplicate.
  let playerId: string | null = null;
  if (inv.email) {
    const [existing] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.email, inv.email))
      .limit(1);
    if (existing) playerId = existing.id;
  }

  if (!playerId) {
    const [created] = await db
      .insert(players)
      .values({
        firstName: inv.firstName,
        lastName: inv.lastName,
        email: nullable(inv.email),
        cell: nullable(inv.cell),
        city: nullable(v.city),
        state: nullable(v.state)?.toUpperCase() ?? null,
        position: nullable(v.position),
      })
      .returning({ id: players.id });
    playerId = created.id;
  }

  // Add to the league (idempotent).
  if (inv.leagueId) {
    await db
      .insert(leaguePlayers)
      .values({ leagueId: inv.leagueId, playerId })
      .onConflictDoNothing();
  }

  // Mark accepted + bind the player.
  await db
    .update(invites)
    .set({ status: "accepted", playerId })
    .where(eq(invites.id, v.inviteId));

  if (inv.leagueId) revalidatePath(`/leagues/${inv.leagueId}`);
  return { ok: true, data: { playerId } };
}
