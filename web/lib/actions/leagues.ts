"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, leagues, leaguePlayers, leagueCommissioners } from "@/lib/db";
import { requireAdminOnly, requireLeagueManager } from "@/lib/auth/perms";
import { requireAdminView, requireManageView } from "@/lib/auth/view";

const FORMATS = ["5v5", "5v5-series", "3v3", "3v3-series"] as const;

const leagueSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  season: z.string().trim().max(20).optional().or(z.literal("")),
  schedule: z.string().trim().max(120).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  format: z.enum(FORMATS).default("5v5"),
  startTime: z.string().trim().max(8).optional().or(z.literal("")),
  maxPlayers: z.string().trim().optional().or(z.literal("")),
  teamAName: z.string().trim().min(1).max(40).default("White"),
  teamBName: z.string().trim().min(1).max(40).default("Dark"),
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

export async function createLeague(formData: FormData): Promise<ActionResult<{ id: string }>> {
  await requireAdminOnly();
  await requireManageView();
  const parsed = leagueSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  const max = v.maxPlayers ? parseInt(v.maxPlayers, 10) : null;
  const [row] = await db
    .insert(leagues)
    .values({
      name: v.name,
      season: nullable(v.season),
      schedule: nullable(v.schedule),
      location: nullable(v.location),
      description: nullable(v.description),
      format: v.format,
      startTime: nullable(v.startTime),
      maxPlayers: Number.isFinite(max) ? max : null,
      teamAName: v.teamAName || "White",
      teamBName: v.teamBName || "Dark",
    })
    .returning({ id: leagues.id });
  revalidatePath("/leagues");
  return { ok: true, data: { id: row.id } };
}

export async function updateLeague(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireLeagueManager(id);
  await requireManageView();
  const parsed = leagueSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  const max = v.maxPlayers ? parseInt(v.maxPlayers, 10) : null;
  await db
    .update(leagues)
    .set({
      name: v.name,
      season: nullable(v.season),
      schedule: nullable(v.schedule),
      location: nullable(v.location),
      description: nullable(v.description),
      format: v.format,
      startTime: nullable(v.startTime),
      maxPlayers: Number.isFinite(max) ? max : null,
      teamAName: v.teamAName || "White",
      teamBName: v.teamBName || "Dark",
    })
    .where(eq(leagues.id, id));
  revalidatePath("/leagues");
  revalidatePath(`/leagues/${id}`);
  revalidatePath("/");
  return { ok: true, data: { id } };
}

export async function deleteLeague(id: string): Promise<ActionResult> {
  await requireAdminOnly();
  await requireAdminView();
  await db.delete(leagues).where(eq(leagues.id, id));
  revalidatePath("/leagues");
  revalidatePath("/");
  return { ok: true };
}

export async function addLeaguePlayer(
  leagueId: string,
  playerId: string,
  teamName?: string | null,
): Promise<ActionResult> {
  await requireLeagueManager(leagueId);
  await requireManageView();
  await db
    .insert(leaguePlayers)
    .values({ leagueId, playerId, teamName: teamName ?? null })
    .onConflictDoNothing();
  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}

export async function removeLeaguePlayer(
  leagueId: string,
  playerId: string,
): Promise<ActionResult> {
  await requireLeagueManager(leagueId);
  await requireManageView();
  await db
    .delete(leaguePlayers)
    .where(
      and(eq(leaguePlayers.leagueId, leagueId), eq(leaguePlayers.playerId, playerId)),
    );
  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}

export async function addCommissioner(
  leagueId: string,
  playerId: string,
): Promise<ActionResult> {
  await requireAdminOnly();
  await requireAdminView();
  await db
    .insert(leagueCommissioners)
    .values({ leagueId, playerId })
    .onConflictDoNothing();
  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}

export async function removeCommissioner(
  leagueId: string,
  playerId: string,
): Promise<ActionResult> {
  await requireAdminOnly();
  await requireAdminView();
  await db
    .delete(leagueCommissioners)
    .where(
      and(
        eq(leagueCommissioners.leagueId, leagueId),
        eq(leagueCommissioners.playerId, playerId),
      ),
    );
  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}
