"use server";

import { z } from "zod";
import { and, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, games, gameRoster, gameStats, gameSubgames, leagues, teams } from "@/lib/db";
import {
  requireGameManager,
  requireLeagueManager,
  requireTeamManager,
} from "@/lib/auth/perms";
import { requireManageView } from "@/lib/auth/view";
import { STAT_FIELDS, type StatRowInput } from "@/lib/stats";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const FORMATS = ["5v5", "5v5-series", "3v3", "3v3-series"] as const;

/** Allowed scheduled game lengths, in minutes. Empty string = unset. */
const GAME_LENGTHS = ["20", "24", "30", "32", "36", "40", "44", "48"] as const;
const gameLengthField = z
  .enum(GAME_LENGTHS)
  .optional()
  .or(z.literal(""));
const gameLengthValue = (s?: string) => {
  const t = (s ?? "").trim();
  return t.length === 0 ? null : parseInt(t, 10);
};

const gameSchema = z.object({
  leagueId: z.string().uuid("Pick a league."),
  gameDate: z.string().min(1, "Date required."),
  gameTime: z.string().optional().or(z.literal("")),
  venue: z.string().trim().max(120).optional().or(z.literal("")),
  format: z.enum(FORMATS).default("5v5"),
  gameLengthMinutes: gameLengthField,
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

/**
 * Wraps perm + view checks so a failed gate becomes an inline error
 * (`{ ok: false, error }`) instead of a thrown exception. Throwing
 * inside a server action surfaces as an unhandled rejection in the
 * client tree and triggers Next.js's global-error UI — which is
 * exactly what we don't want for a recoverable "not authorized."
 */
async function gateGameManager(gameId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireGameManager(gameId);
    await requireManageView();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized." };
  }
}

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
      gameLengthMinutes: gameLengthValue(v.gameLengthMinutes),
      teamAName: league.teamA ?? "White",
      teamBName: league.teamB ?? "Dark",
    })
    .returning({ id: games.id });
  revalidatePath("/games");
  revalidatePath("/");
  return { ok: true, data: { id: row.id } };
}

const gameSlotSchema = z.object({
  gameDate: z.string().min(1, "Date required."),
  gameTime: z.string().optional().or(z.literal("")),
  venue: z.string().trim().max(120).optional().or(z.literal("")),
});

const leagueGamesSchema = z.object({
  leagueId: z.string().uuid("Pick a league."),
  format: z.enum(FORMATS).default("5v5"),
  gameLengthMinutes: gameLengthField,
  slots: z.array(gameSlotSchema).min(1, "Add at least one game.").max(50),
});

/** Schedule one or many league games in a single submit. Each slot becomes
 *  its own game; all share the league, format, and length. */
export async function createLeagueGames(
  input: unknown,
): Promise<ActionResult<{ ids: string[] }>> {
  const parsed = leagueGamesSchema.safeParse(input);
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

  const lengthVal = gameLengthValue(v.gameLengthMinutes);
  const rows = await db
    .insert(games)
    .values(
      v.slots.map((s) => ({
        leagueId: v.leagueId,
        leagueName: league.name,
        gameDate: s.gameDate,
        gameTime: nullable(s.gameTime),
        venue: nullable(s.venue),
        format: v.format,
        gameLengthMinutes: lengthVal,
        teamAName: league.teamA ?? "White",
        teamBName: league.teamB ?? "Dark",
      })),
    )
    .returning({ id: games.id });

  revalidatePath("/games");
  revalidatePath("/");
  return { ok: true, data: { ids: rows.map((r) => r.id) } };
}

const TOURNAMENT_ROUNDS = [
  "Seeding Game",
  "Quarterfinals",
  "Semifinals",
  "Championship",
] as const;

const teamGameSchema = z
  .object({
    teamAId: z.string().uuid("Your team is required."),
    teamBId: z.string().uuid("Pick an opponent."),
    gameDate: z.string().min(1, "Date required."),
    gameTime: z.string().optional().or(z.literal("")),
    venue: z.string().trim().max(120).optional().or(z.literal("")),
    format: z.enum(FORMATS).default("5v5"),
    gameLengthMinutes: gameLengthField,
    gameType: z.enum(["exhibition", "tournament"]).default("exhibition"),
    tournamentName: z.string().trim().max(120).optional().or(z.literal("")),
    tournamentRound: z.enum(TOURNAMENT_ROUNDS).optional().or(z.literal("")),
  })
  .refine((v) => v.teamAId !== v.teamBId, {
    message: "A team can't play itself.",
    path: ["teamBId"],
  })
  .refine(
    (v) => v.gameType !== "tournament" || !!v.tournamentName?.trim(),
    { message: "Tournament name is required.", path: ["tournamentName"] },
  )
  .refine(
    (v) => v.gameType !== "tournament" || !!v.tournamentRound,
    { message: "Pick a round.", path: ["tournamentRound"] },
  );

/** Schedule a standalone team-vs-team game (Exhibition or Tournament).
 *  No leagueId; the two sides are the chosen teams. */
export async function createTeamGame(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = teamGameSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  await requireTeamManager(v.teamAId);
  await requireManageView();

  const rows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(inArray(teams.id, [v.teamAId, v.teamBId]));
  const teamA = rows.find((t) => t.id === v.teamAId);
  const teamB = rows.find((t) => t.id === v.teamBId);
  if (!teamA || !teamB) return { ok: false, error: "Team not found." };

  const [row] = await db
    .insert(games)
    .values({
      leagueId: null,
      teamAId: v.teamAId,
      teamBId: v.teamBId,
      gameType: v.gameType,
      tournamentName:
        v.gameType === "tournament" ? nullable(v.tournamentName) : null,
      tournamentRound:
        v.gameType === "tournament" ? v.tournamentRound || null : null,
      gameDate: v.gameDate,
      gameTime: nullable(v.gameTime),
      venue: nullable(v.venue),
      format: v.format,
      gameLengthMinutes: gameLengthValue(v.gameLengthMinutes),
      teamAName: teamA.name,
      teamBName: teamB.name,
    })
    .returning({ id: games.id });

  revalidatePath(`/teams/${v.teamAId}`);
  revalidatePath(`/teams/${v.teamBId}`);
  return { ok: true, data: { id: row.id } };
}

const teamGameEditSchema = z
  .object({
    gameDate: z.string().min(1, "Date required."),
    gameTime: z.string().optional().or(z.literal("")),
    venue: z.string().trim().max(120).optional().or(z.literal("")),
    format: z.enum(FORMATS).default("5v5"),
    gameLengthMinutes: gameLengthField,
    teamAName: z.string().trim().min(1).max(40).optional().or(z.literal("")),
    teamBName: z.string().trim().min(1).max(40).optional().or(z.literal("")),
    gameType: z.enum(["exhibition", "tournament"]).default("exhibition"),
    tournamentName: z.string().trim().max(120).optional().or(z.literal("")),
    tournamentRound: z.enum(TOURNAMENT_ROUNDS).optional().or(z.literal("")),
  })
  .refine((v) => v.gameType !== "tournament" || !!v.tournamentName?.trim(), {
    message: "Tournament name is required.",
    path: ["tournamentName"],
  })
  .refine((v) => v.gameType !== "tournament" || !!v.tournamentRound, {
    message: "Pick a round.",
    path: ["tournamentRound"],
  });

export async function updateGame(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const gate = await gateGameManager(id);
  if (!gate.ok) return gate;

  const [existing] = await db
    .select({
      leagueId: games.leagueId,
      teamAId: games.teamAId,
      teamBId: games.teamBId,
    })
    .from(games)
    .where(eq(games.id, id))
    .limit(1);
  const isTeamGame =
    !!existing && !existing.leagueId && !!(existing.teamAId || existing.teamBId);

  if (isTeamGame) {
    const parsed = teamGameEditSchema.safeParse(readForm(formData));
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
        gameDate: v.gameDate,
        gameTime: nullable(v.gameTime),
        venue: nullable(v.venue),
        format: v.format,
        gameLengthMinutes: gameLengthValue(v.gameLengthMinutes),
        ...(tA ? { teamAName: tA } : {}),
        ...(tB ? { teamBName: tB } : {}),
        gameType: v.gameType,
        tournamentName:
          v.gameType === "tournament" ? nullable(v.tournamentName) : null,
        tournamentRound:
          v.gameType === "tournament" ? v.tournamentRound || null : null,
      })
      .where(eq(games.id, id));
    revalidatePath("/games");
    revalidatePath(`/games/${id}`);
    revalidatePath("/");
    return { ok: true, data: { id } };
  }

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
      gameLengthMinutes: gameLengthValue(v.gameLengthMinutes),
      ...(tA ? { teamAName: tA } : {}),
      ...(tB ? { teamBName: tB } : {}),
    })
    .where(eq(games.id, id));
  revalidatePath("/games");
  revalidatePath(`/games/${id}`);
  revalidatePath("/");
  return { ok: true, data: { id } };
}

const toInt = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

/** Save the manual box score for a game: upsert one row per player. */
export async function saveGameStats(
  gameId: string,
  rows: StatRowInput[],
): Promise<ActionResult> {
  const gate = await gateGameManager(gameId);
  if (!gate.ok) return gate;
  if (!Array.isArray(rows)) return { ok: false, error: "Invalid stats." };

  for (const r of rows) {
    if (!r?.playerId) continue;
    const values: Record<string, number | null> = {};
    for (const f of STAT_FIELDS) values[f] = toInt(r[f]);
    await db
      .insert(gameStats)
      .values({ gameId, playerId: r.playerId, ...values })
      .onConflictDoUpdate({
        target: [gameStats.gameId, gameStats.playerId],
        set: values,
      });
  }
  revalidatePath(`/games/${gameId}`);
  return { ok: true };
}

/** Delete every saved box-score row for a game. */
export async function clearGameStats(gameId: string): Promise<ActionResult> {
  const gate = await gateGameManager(gameId);
  if (!gate.ok) return gate;
  await db.delete(gameStats).where(eq(gameStats.gameId, gameId));
  revalidatePath(`/games/${gameId}`);
  return { ok: true };
}

export async function deleteGame(id: string): Promise<ActionResult> {
  const gate = await gateGameManager(id);
  if (!gate.ok) return gate;
  await db.delete(games).where(eq(games.id, id));
  revalidatePath("/games");
  revalidatePath("/");
  return { ok: true };
}

export async function setGameScore(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const gate = await gateGameManager(id);
  if (!gate.ok) return gate;
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
  const willLock = v.locked === "on" || v.locked === "true";
  const lockedAtPatch = await computeLockedAtPatch(id, willLock);
  await db
    .update(games)
    .set({
      scoreA: sA,
      scoreB: sB,
      winTeam,
      gameWinner: v.gameWinnerId && v.gameWinnerId !== "" ? v.gameWinnerId : null,
      locked: willLock,
      ...lockedAtPatch,
    })
    .where(eq(games.id, id));
  revalidatePath(`/games/${id}`);
  revalidatePath("/games");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Decide what to write to games.locked_at on a transition. We only
 * stamp it when the row is actually moving from unlocked → locked
 * (so re-saves of an already-locked game don't reset the auto-sync
 * watermark) and clear it on locked → unlocked.
 */
async function computeLockedAtPatch(
  id: string,
  willLock: boolean,
): Promise<{ lockedAt?: Date | null }> {
  const [row] = await db
    .select({ locked: games.locked, lockedAt: games.lockedAt })
    .from(games)
    .where(eq(games.id, id))
    .limit(1);
  if (!row) return {};
  if (willLock && !row.locked) return { lockedAt: new Date() };
  if (!willLock && row.locked) return { lockedAt: null };
  return {};
}

/**
 * Series-format scoring. The form posts pairs `scoreA_<i>` / `scoreB_<i>`
 * for i in 0..N-1; rows where both fields are blank are ignored. Per-game
 * winners are derived from the per-game score; the parent `games` row's
 * scoreA/scoreB store the *series tally* (count of wins per side) so all
 * downstream queries (W-L, leaderboards) treat the night as one outcome.
 */
export async function setSeriesScore(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const gate = await gateGameManager(id);
  if (!gate.ok) return gate;
  const raw = readForm(formData);

  const subRows: { i: number; sA: number; sB: number; w: "A" | "B" | "Tie" }[] = [];
  for (let i = 0; i < 32; i++) {
    const a = (raw[`scoreA_${i}`] ?? "").trim();
    const b = (raw[`scoreB_${i}`] ?? "").trim();
    if (a === "" && b === "") continue;
    if (a === "" || b === "") {
      return { ok: false, error: `Game ${i + 1} needs both scores.` };
    }
    const sA = Number.parseInt(a, 10);
    const sB = Number.parseInt(b, 10);
    if (!Number.isFinite(sA) || !Number.isFinite(sB) || sA < 0 || sB < 0) {
      return { ok: false, error: `Game ${i + 1} has an invalid score.` };
    }
    const w: "A" | "B" | "Tie" = sA > sB ? "A" : sB > sA ? "B" : "Tie";
    subRows.push({ i, sA, sB, w });
  }

  // Derive parent tally from sub-game wins (ties contribute to neither).
  const winsA = subRows.filter((r) => r.w === "A").length;
  const winsB = subRows.filter((r) => r.w === "B").length;
  const parentScoreA = subRows.length > 0 ? winsA : null;
  const parentScoreB = subRows.length > 0 ? winsB : null;
  const parentWin: "A" | "B" | "Tie" | null =
    subRows.length === 0
      ? null
      : winsA > winsB
        ? "A"
        : winsB > winsA
          ? "B"
          : "Tie";

  await db.delete(gameSubgames).where(eq(gameSubgames.gameId, id));
  if (subRows.length > 0) {
    await db.insert(gameSubgames).values(
      subRows.map((r) => ({
        gameId: id,
        gameIndex: r.i,
        scoreA: r.sA,
        scoreB: r.sB,
        winTeam: r.w,
      })),
    );
  }

  const willLock = raw.locked === "on" || raw.locked === "true";
  const lockedAtPatch = await computeLockedAtPatch(id, willLock);
  await db
    .update(games)
    .set({
      scoreA: parentScoreA,
      scoreB: parentScoreB,
      winTeam: parentWin,
      gameWinner:
        raw.gameWinnerId && raw.gameWinnerId !== "" ? raw.gameWinnerId : null,
      locked: willLock,
      ...lockedAtPatch,
    })
    .where(eq(games.id, id));

  revalidatePath(`/games/${id}`);
  revalidatePath("/games");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Copy the A/B team rosters from this league's most recent prior game
 * onto this game (upsert — keeps anyone already added, doesn't touch
 * the Invited list). Admin/commissioner gated like every roster edit.
 */
export async function loadPreviousGameRoster(
  gameId: string,
): Promise<ActionResult<{ loaded: number }>> {
  const gate = await gateGameManager(gameId);
  if (!gate.ok) return gate;

  try {
    const [cur] = await db
      .select({ leagueId: games.leagueId, gameDate: games.gameDate })
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);
    if (!cur) return { ok: false, error: "Game not found." };
    if (!cur.leagueId) {
      return { ok: false, error: "This game isn't tied to a league." };
    }

    const [prev] = await db
      .select({ id: games.id })
      .from(games)
      .where(
        and(
          eq(games.leagueId, cur.leagueId),
          ne(games.id, gameId),
          cur.gameDate ? lt(games.gameDate, cur.gameDate) : undefined,
        ),
      )
      .orderBy(desc(games.gameDate), desc(games.gameTime))
      .limit(1);
    if (!prev) return { ok: false, error: "No previous game to copy from." };

    const prevRoster = await db
      .select({ playerId: gameRoster.playerId, side: gameRoster.side })
      .from(gameRoster)
      .where(
        and(eq(gameRoster.gameId, prev.id), inArray(gameRoster.side, ["A", "B"])),
      );
    if (prevRoster.length === 0) {
      return { ok: false, error: "The previous game has no team rosters." };
    }

    // Single batched upsert — one round-trip instead of one per player.
    await db
      .insert(gameRoster)
      .values(
        prevRoster.map((r) => ({
          gameId,
          playerId: r.playerId,
          side: r.side,
        })),
      )
      .onConflictDoUpdate({
        target: [gameRoster.gameId, gameRoster.playerId],
        set: { side: sql`excluded.side` },
      });

    revalidatePath(`/games/${gameId}`);
    return { ok: true, data: { loaded: prevRoster.length } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load previous teams.",
    };
  }
}

/** Remove every player from this game's roster (White, Dark, Invited). */
export async function clearGameRoster(
  gameId: string,
): Promise<ActionResult<{ cleared: number }>> {
  const gate = await gateGameManager(gameId);
  if (!gate.ok) return gate;
  const removed = await db
    .delete(gameRoster)
    .where(eq(gameRoster.gameId, gameId))
    .returning({ playerId: gameRoster.playerId });
  revalidatePath(`/games/${gameId}`);
  return { ok: true, data: { cleared: removed.length } };
}

export async function setGameRosterPlayer(
  gameId: string,
  playerId: string,
  side: "A" | "B" | "TBD" | "invited" | null,
): Promise<ActionResult> {
  const gate = await gateGameManager(gameId);
  if (!gate.ok) return gate;
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
