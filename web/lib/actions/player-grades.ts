"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, playerGrades, leaguePlayers } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { isVotableGrade } from "@/lib/queries/player-grades";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Cast (or update) the viewer's grade for a target player. The
 * voter must share at least one league with the target and may
 * not grade themselves.
 */
export async function castPlayerGrade(formData: FormData): Promise<ActionResult> {
  const session = await readSession();
  if (!session?.playerId) {
    return { ok: false, error: "Sign in to grade players." };
  }
  const targetId = String(formData.get("targetId") ?? "");
  const grade = String(formData.get("grade") ?? "");
  if (!targetId) return { ok: false, error: "Missing target." };
  if (!isVotableGrade(grade)) {
    return { ok: false, error: "Pick a grade." };
  }

  // Voter must share at least one league with the target. Voting on
  // yourself is allowed — that's still your own league.
  const targetLeagues = await db
    .select({ leagueId: leaguePlayers.leagueId })
    .from(leaguePlayers)
    .where(eq(leaguePlayers.playerId, targetId));
  if (targetLeagues.length === 0) {
    return { ok: false, error: "This player isn't in any league yet." };
  }
  if (session.playerId !== targetId) {
    const targetLeagueIds = targetLeagues.map((r) => r.leagueId);
    const [overlap] = await db
      .select({ leagueId: leaguePlayers.leagueId })
      .from(leaguePlayers)
      .where(
        and(
          eq(leaguePlayers.playerId, session.playerId),
          inArray(leaguePlayers.leagueId, targetLeagueIds),
        ),
      )
      .limit(1);
    if (!overlap) {
      return {
        ok: false,
        error: "You can only grade players in your league.",
      };
    }
  }

  await db
    .insert(playerGrades)
    .values({
      targetPlayerId: targetId,
      voterPlayerId: session.playerId,
      grade,
    })
    .onConflictDoUpdate({
      target: [playerGrades.targetPlayerId, playerGrades.voterPlayerId],
      set: { grade, updatedAt: new Date() },
    });

  revalidatePath(`/players/${targetId}`);
  revalidatePath("/players");
  return { ok: true };
}

/**
 * Remove the viewer's vote on a target. Used by the "Clear" action
 * in the grade widget.
 */
export async function clearPlayerGrade(targetId: string): Promise<ActionResult> {
  const session = await readSession();
  if (!session?.playerId) {
    return { ok: false, error: "Sign in to grade players." };
  }
  await db
    .delete(playerGrades)
    .where(
      and(
        eq(playerGrades.targetPlayerId, targetId),
        eq(playerGrades.voterPlayerId, session.playerId),
      ),
    );
  revalidatePath(`/players/${targetId}`);
  revalidatePath("/players");
  return { ok: true };
}
