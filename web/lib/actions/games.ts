"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, games, gameRoster, leagues } from "@/lib/db";
import { requireGameManager, requireLeagueManager } from "@/lib/auth/perms";
import { requireManageView } from "@/lib/auth/view";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const FORMATS = ["5v5", "5v5-series", "3v3", "3v3-series"] as const;

const gameSchema = z.object({
  leagueId: z.string().uuid("Pick a league."),
  gameDate: z.string().min(1, "Date required."),
  gameTime: z.string().optional().or(z.literal("")),
  venue: z.string().trim().max(120).optional().or(z.literal("")),
  format: z.enum(FORMATS).default("5v5"),
  teamAName: z.string().trim().min(1).max(40).optional().or(z.literal("")),
  teamBName: z.string().trim().min(1).max(40).optional().or(z.literal("")),
});

const scoreSchema = z.object({
  scoreA: z.string().optional().or(z.literal("")),
  scoreB: z.string().optional().or(z.literal("")),
  gameWinnerId: z.string().optional().or(z.literal("")),
  locked: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
    .optional(),
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

export async function createGame(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = gameSchema.safeParse(readForm(formData));
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
  const [league] = await db
    .select({ name: leagues.name, teamA: leagues.teamAName, teamB: leagues.teamBName })
    .from(leagues)
    .where(eq(leagues.id, v.leagueId))
    .limit(1);
  if (!league) return { ok: false, error: "League not found." };

  const [row] = await db
    .insert(games)
    .values({
      leagueId: v.leagueId,
      leagueName: league.name,
      gameDate: v.gameDate,
      gameTime: nullable(v.gameTime),
      venue: nullable(v.venue),
      format: v.format,
      teamAName: league.teamA ?? "White",
      teamBName: league.teamB ?? "Dark",
    })
    .returning({ id: games.id });
  revalidatePath("/games");
  revalidatePath("/");
  return { ok: true, data: { id: row.id } };
}

export async function updateGame(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireGameManager(id);
  await requireManageView();
  const parsed = gameSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  const tA = (v.teamAName ?? "").trim();
  const tB = (v.teamBName ?? "").trim();
  await db
    .update(games)
    .set({
      leagueId: v.leagueId,
      gameDate: v.gameDate,
      gameTime: nullable(v.gameTime),
      venue: nullable(v.venue),
      format: v.format,
      ...(tA ? { teamAName: tA } : {}),
      ...(tB ? { teamBName: tB } : {}),
    })
    .where(eq(games.id, id));
  revalidatePath("/games");
  revalidatePath(`/games/${id}`);
  revalidatePath("/");
  return { ok: true, data: { id } };
}

export async function deleteGame(id: string): Promise<ActionResult> {
  await requireGameManager(id);
  await requireManageView();
  await db.delete(games).where(eq(games.id, id));
  revalidatePath("/games");
  revalidatePath("/");
  return { ok: true };
}

export async function setGameScore(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireGameManager(id);
  await requireManageView();
  const parsed = scoreSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  const sA = v.scoreA && v.scoreA !== "" ? parseInt(v.scoreA, 10) : null;
  const sB = v.scoreB && v.scoreB !== "" ? parseInt(v.scoreB, 10) : null;
  const winTeam =
    sA !== null && sB !== null
      ? sA > sB
        ? ("A" as const)
        : sB > sA
          ? ("B" as const)
          : ("Tie" as const)
      : null;
  await db
    .update(games)
    .set({
      scoreA: sA,
      scoreB: sB,
      winTeam,
      gameWinner: v.gameWinnerId && v.gameWinnerId !== "" ? v.gameWinnerId : null,
      locked: v.locked === "on" || v.locked === "true",
    })
    .where(eq(games.id, id));
  revalidatePath(`/games/${id}`);
  revalidatePath("/games");
  revalidatePath("/");
  return { ok: true };
}

export async function setGameRosterPlayer(
  gameId: string,
  playerId: string,
  side: "A" | "B" | "invited" | null,
): Promise<ActionResult> {
  await requireGameManager(gameId);
  await requireManageView();
  if (side === null) {
    await db
      .delete(gameRoster)
      .where(and(eq(gameRoster.gameId, gameId), eq(gameRoster.playerId, playerId)));
  } else {
    await db
      .insert(gameRoster)
      .values({ gameId, playerId, side })
      .onConflictDoUpdate({
        target: [gameRoster.gameId, gameRoster.playerId],
        set: { side },
      });
  }
  revalidatePath(`/games/${gameId}`);
  return { ok: true };
}
