"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  players,
  leaguePlayers,
  leagueTeamMeta,
  leagueTeamPlayers,
} from "@/lib/db";
import { requireLeagueManager } from "@/lib/auth/perms";
import { requireManageView } from "@/lib/auth/view";

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

const SIDES = ["A", "B"] as const;

async function gate(
  leagueId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireLeagueManager(leagueId);
    await requireManageView();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized." };
  }
}

const infoSchema = z.object({
  name: z.string().trim().max(40).optional().or(z.literal("")),
  avatarKind: z.enum(["monogram", "emoji"]).default("monogram"),
  avatarColor: z.string().trim().max(24).optional().or(z.literal("")),
  avatarEmoji: z.string().trim().max(8).optional().or(z.literal("")),
});

/** Upsert the display override (name + avatar) for a league side. */
export async function updateLeagueSideInfo(
  leagueId: string,
  side: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!SIDES.includes(side as (typeof SIDES)[number]))
    return { ok: false, error: "Invalid side." };
  const g = await gate(leagueId);
  if (!g.ok) return g;
  const parsed = infoSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  const patch = {
    name: nullable(v.name),
    avatarKind: v.avatarKind,
    avatarColor: nullable(v.avatarColor) ?? "brand",
    avatarEmoji: v.avatarKind === "emoji" ? nullable(v.avatarEmoji) : null,
  };
  await db
    .insert(leagueTeamMeta)
    .values({ leagueId, side, ...patch })
    .onConflictDoUpdate({
      target: [leagueTeamMeta.leagueId, leagueTeamMeta.side],
      set: patch,
    });
  revalidatePath(`/teams/league/${leagueId}/${side}`);
  return { ok: true };
}

/** Add an existing player to a league side's regular roster. */
export async function addLeagueSideRosterPlayer(
  leagueId: string,
  side: string,
  playerId: string,
): Promise<ActionResult> {
  if (!SIDES.includes(side as (typeof SIDES)[number]))
    return { ok: false, error: "Invalid side." };
  const g = await gate(leagueId);
  if (!g.ok) return g;
  await db
    .insert(leagueTeamPlayers)
    .values({ leagueId, side, playerId })
    .onConflictDoNothing();
  revalidatePath(`/teams/league/${leagueId}/${side}`);
  return { ok: true };
}

const newMemberSchema = z.object({
  firstName: z.string().trim().min(1, "First name required.").max(60),
  lastName: z.string().trim().min(1, "Last name required.").max(60),
});

/** Create a new player, add them to the league, and to this side's roster. */
export async function createAndAddLeagueSideMember(
  leagueId: string,
  side: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  if (!SIDES.includes(side as (typeof SIDES)[number]))
    return { ok: false, error: "Invalid side." };
  const g = await gate(leagueId);
  if (!g.ok) return g;
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
    .insert(leaguePlayers)
    .values({ leagueId, playerId: row.id })
    .onConflictDoNothing();
  await db
    .insert(leagueTeamPlayers)
    .values({ leagueId, side, playerId: row.id })
    .onConflictDoNothing();
  revalidatePath(`/teams/league/${leagueId}/${side}`);
  return { ok: true, data: { id: row.id } };
}

/** Remove a player from a league side's regular roster. */
export async function removeLeagueSideRosterPlayer(
  leagueId: string,
  side: string,
  playerId: string,
): Promise<ActionResult> {
  if (!SIDES.includes(side as (typeof SIDES)[number]))
    return { ok: false, error: "Invalid side." };
  const g = await gate(leagueId);
  if (!g.ok) return g;
  await db
    .delete(leagueTeamPlayers)
    .where(
      and(
        eq(leagueTeamPlayers.leagueId, leagueId),
        eq(leagueTeamPlayers.side, side),
        eq(leagueTeamPlayers.playerId, playerId),
      ),
    );
  revalidatePath(`/teams/league/${leagueId}/${side}`);
  return { ok: true };
}
