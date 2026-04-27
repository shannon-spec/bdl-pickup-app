"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db, leagues, leaguePlayers, leagueCommissioners, players } from "@/lib/db";
import {
  isAdminLike,
  requireAdminOnly,
  requireLeagueManager,
} from "@/lib/auth/perms";
import { readSession } from "@/lib/auth/session";
import { requireAdminView, requireManageView } from "@/lib/auth/view";

// Legacy enum values kept on the column for old rows; only the three
// values below are selectable in the UI going forward.
const FORMATS = ["5v5", "3v3", "series"] as const;
const LEVELS = [
  "Not Rated",
  "Novice",
  "Intermediate",
  "Advanced",
  "Game Changer",
  "Pro",
] as const;

const intString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""));

const leagueSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  season: z.string().trim().max(20).optional().or(z.literal("")),
  schedule: z.string().trim().max(120).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  format: z.enum(FORMATS).default("5v5"),
  level: z.enum(LEVELS).default("Not Rated"),
  startTime: z.string().trim().max(8).optional().or(z.literal("")),
  maxPlayers: z.string().trim().optional().or(z.literal("")),
  seriesGameCount: intString,
  seriesPointTarget: intString,
  playToScore: intString,
  teamAName: z.string().trim().min(1).max(40).default("White"),
  teamBName: z.string().trim().min(1).max(40).default("Dark"),
});

const toInt = (s?: string | null) => {
  const n = s ? parseInt(s, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

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
  await requireManageView();
  const session = await readSession();
  if (!session) {
    return { ok: false, error: "Not authenticated." };
  }
  const isAdmin = isAdminLike(session);
  if (!isAdmin && !session.playerId) {
    return {
      ok: false,
      error: "Only admins or rostered commissioners can create leagues.",
    };
  }
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
  const isSeries = v.format === "series";
  const [row] = await db
    .insert(leagues)
    .values({
      name: v.name,
      season: nullable(v.season),
      schedule: nullable(v.schedule),
      location: nullable(v.location),
      description: nullable(v.description),
      format: v.format,
      level: v.level,
      startTime: nullable(v.startTime),
      maxPlayers: Number.isFinite(max) ? max : null,
      seriesGameCount: isSeries ? toInt(v.seriesGameCount) : null,
      seriesPointTarget: isSeries ? toInt(v.seriesPointTarget) : null,
      playToScore: isSeries ? null : toInt(v.playToScore),
      teamAName: v.teamAName || "White",
      teamBName: v.teamBName || "Dark",
    })
    .returning({ id: leagues.id });

  // Non-admin creators become a commissioner of their new league so
  // they can manage it immediately. Admins skip this — they manage
  // every league globally.
  if (!isAdmin && session.playerId) {
    await db
      .insert(leagueCommissioners)
      .values({ leagueId: row.id, playerId: session.playerId })
      .onConflictDoNothing();
  }

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
  const isSeries = v.format === "series";
  await db
    .update(leagues)
    .set({
      name: v.name,
      season: nullable(v.season),
      schedule: nullable(v.schedule),
      location: nullable(v.location),
      description: nullable(v.description),
      format: v.format,
      level: v.level,
      startTime: nullable(v.startTime),
      maxPlayers: Number.isFinite(max) ? max : null,
      seriesGameCount: isSeries ? toInt(v.seriesGameCount) : null,
      seriesPointTarget: isSeries ? toInt(v.seriesPointTarget) : null,
      playToScore: isSeries ? null : toInt(v.playToScore),
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

const newPlayerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(60),
  lastName: z.string().trim().min(1, "Last name is required.").max(60),
});

const credentialsSchema = z.object({
  leagueId: z.string().uuid("Pick a league."),
  firstName: z.string().trim().min(1, "First name required.").max(60),
  lastName: z.string().trim().min(1, "Last name required.").max(60),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Invalid email.",
    ),
  username: z
    .string()
    .trim()
    .min(3, "Username must be 3-32 chars.")
    .max(32, "Username must be 3-32 chars.")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Letters, numbers, dot, dash, and underscore only.",
    ),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export async function createPlayerWithCredentials(
  formData: FormData,
): Promise<ActionResult<{ id: string; username: string }>> {
  const parsed = credentialsSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  await requireLeagueManager(v.leagueId);
  await requireManageView();

  const username = v.username.toLowerCase();
  const [taken] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.username, username))
    .limit(1);
  if (taken) {
    return {
      ok: false,
      error: "Username is already in use.",
      fieldErrors: { username: ["Username is already in use."] },
    };
  }

  const passwordHash = await bcrypt.hash(v.password, 10);
  const [row] = await db
    .insert(players)
    .values({
      firstName: v.firstName,
      lastName: v.lastName,
      email: nullable(v.email),
      username,
      passwordHash,
    })
    .returning({ id: players.id });

  await db
    .insert(leaguePlayers)
    .values({ leagueId: v.leagueId, playerId: row.id })
    .onConflictDoNothing();

  revalidatePath(`/leagues/${v.leagueId}`);
  revalidatePath("/players");
  revalidatePath("/roster");
  revalidatePath("/");
  return { ok: true, data: { id: row.id, username } };
}

export async function createAndAddLeagueMember(
  leagueId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireLeagueManager(leagueId);
  await requireManageView();
  const parsed = newPlayerSchema.safeParse(readForm(formData));
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
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath("/roster");
  revalidatePath("/");
  return { ok: true, data: { id: row.id } };
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

async function gateLeagueManager(leagueId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireLeagueManager(leagueId);
    await requireManageView();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized." };
  }
}

export async function addCommissioner(
  leagueId: string,
  playerId: string,
): Promise<ActionResult> {
  const gate = await gateLeagueManager(leagueId);
  if (!gate.ok) return gate;
  await db
    .insert(leagueCommissioners)
    .values({ leagueId, playerId })
    .onConflictDoNothing();
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath("/admin/commissioners");
  return { ok: true };
}

export async function removeCommissioner(
  leagueId: string,
  playerId: string,
): Promise<ActionResult> {
  const gate = await gateLeagueManager(leagueId);
  if (!gate.ok) return gate;
  await db
    .delete(leagueCommissioners)
    .where(
      and(
        eq(leagueCommissioners.leagueId, leagueId),
        eq(leagueCommissioners.playerId, playerId),
      ),
    );
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath("/admin/commissioners");
  return { ok: true };
}
