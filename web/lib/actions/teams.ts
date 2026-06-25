"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, teams, teamPlayers, teamCommissioners, players } from "@/lib/db";
import {
  isAdminLike,
  requireAdminOnly,
  requireTeamManager,
} from "@/lib/auth/perms";
import { readSession } from "@/lib/auth/session";
import { requireManageView } from "@/lib/auth/view";

const TEAM_FORMATS = ["5v5", "3v3"] as const;
const AVATAR_KINDS = ["monogram", "emoji"] as const;
const AVATAR_COLORS = [
  "brand", "emerald", "teal", "ruby", "sage", "rose", "coral", "pink",
  "amber", "violet", "slate", "graphite", "sky", "mint", "seafoam",
  "lavender", "blush", "peach", "buttercream", "linen",
] as const;

const teamSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z
    .string()
    .trim()
    .max(2)
    .regex(/^([A-Za-z]{2})?$/, "Two-letter state code.")
    .optional()
    .or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  defaultFormat: z.enum(TEAM_FORMATS).default("5v5"),
  avatarKind: z.enum(AVATAR_KINDS).default("monogram"),
  avatarColor: z.enum(AVATAR_COLORS).default("brand"),
  avatarEmoji: z.string().trim().max(8).optional().or(z.literal("")),
});

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const readForm = (fd: FormData) => {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
};
const nullable = (s?: string | null) => {
  const t = (s ?? "").trim();
  return t.length === 0 ? null : t;
};

export async function createTeam(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireManageView();
  const session = await readSession();
  if (!session) return { ok: false, error: "Not authenticated." };
  const isAdmin = isAdminLike(session);
  if (!isAdmin && !session.playerId) {
    return {
      ok: false,
      error: "Only admins or rostered commissioners can create teams.",
    };
  }
  const parsed = teamSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  const [row] = await db
    .insert(teams)
    .values({
      name: v.name,
      city: nullable(v.city),
      state: nullable(v.state)?.toUpperCase() ?? null,
      description: nullable(v.description),
      defaultFormat: v.defaultFormat,
      avatarKind: v.avatarKind,
      avatarColor: v.avatarColor,
      avatarEmoji: v.avatarKind === "emoji" ? nullable(v.avatarEmoji) : null,
      createdBy: session.playerId ?? null,
    })
    .returning({ id: teams.id });

  // The creator becomes a commissioner of their new team — including
  // admins, so the team shows up in their commissioner-scoped Teams
  // list and "My teams", not just the admin-view all-teams list.
  if (session.playerId) {
    await db
      .insert(teamCommissioners)
      .values({ teamId: row.id, playerId: session.playerId })
      .onConflictDoNothing();
  }

  revalidatePath("/teams");
  return { ok: true, data: { id: row.id } };
}

export async function updateTeam(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireTeamManager(id);
  await requireManageView();
  const parsed = teamSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  await db
    .update(teams)
    .set({
      name: v.name,
      city: nullable(v.city),
      state: nullable(v.state)?.toUpperCase() ?? null,
      description: nullable(v.description),
      defaultFormat: v.defaultFormat,
      avatarKind: v.avatarKind,
      avatarColor: v.avatarColor,
      avatarEmoji: v.avatarKind === "emoji" ? nullable(v.avatarEmoji) : null,
    })
    .where(eq(teams.id, id));
  revalidatePath("/teams");
  revalidatePath(`/teams/${id}`);
  return { ok: true, data: { id } };
}

export async function addTeamPlayer(
  teamId: string,
  playerId: string,
): Promise<ActionResult> {
  await requireTeamManager(teamId);
  await requireManageView();
  await db
    .insert(teamPlayers)
    .values({ teamId, playerId })
    .onConflictDoNothing();
  revalidatePath(`/teams/${teamId}`);
  return { ok: true };
}

export async function removeTeamPlayer(
  teamId: string,
  playerId: string,
): Promise<ActionResult> {
  await requireTeamManager(teamId);
  await requireManageView();
  await db
    .delete(teamPlayers)
    .where(
      and(eq(teamPlayers.teamId, teamId), eq(teamPlayers.playerId, playerId)),
    );
  revalidatePath(`/teams/${teamId}`);
  return { ok: true };
}

const newMemberSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(60),
  lastName: z.string().trim().min(1, "Last name is required.").max(60),
});

export async function createAndAddTeamMember(
  teamId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireTeamManager(teamId);
  await requireManageView();
  const parsed = newMemberSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  const [row] = await db
    .insert(players)
    .values({ firstName: v.firstName, lastName: v.lastName })
    .returning({ id: players.id });
  await db
    .insert(teamPlayers)
    .values({ teamId, playerId: row.id })
    .onConflictDoNothing();
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/roster");
  return { ok: true, data: { id: row.id } };
}

/** Permanently delete a team. Team managers (creator / commissioner)
 *  or admins can delete. Cascades roster + commissioner rows; any games
 *  referencing the team have their team side set to null (FK).
 *  Returns ok so the client can redirect to the teams list. */
export async function deleteTeam(teamId: string): Promise<ActionResult> {
  await requireTeamManager(teamId);
  await requireManageView();
  await db.delete(teams).where(eq(teams.id, teamId));
  revalidatePath("/teams");
  return { ok: true };
}

/** Soft-hide / unhide a team (admin only) — mirrors setLeagueHidden. */
export async function setTeamHidden(
  id: string,
  hidden: boolean,
): Promise<ActionResult> {
  await requireAdminOnly();
  await db
    .update(teams)
    .set({ hiddenAt: hidden ? sql`now()` : null })
    .where(eq(teams.id, id));
  revalidatePath("/teams");
  revalidatePath(`/teams/${id}`);
  return { ok: true };
}
