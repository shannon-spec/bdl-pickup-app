"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, playerGrades, leaguePlayers } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { isVotableGrade } from "@/lib/queries/player-grades";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Cast (or update) the viewer's grade for a target player IN A
 * SPECIFIC LEAGUE. Both voter and target must be members of that
 * league. Self-voting is allowed (you're still a member of your own
 * league).
 */
export async function castPlayerGrade(formData: FormData): Promise<ActionResult> {
  const session = await readSession();
  if (!session?.playerId) {
    return { ok: false, error: "Sign in to grade players." };
  }
  const targetId = String(formData.get("targetId") ?? "");
  const leagueId = String(formData.get("leagueId") ?? "");
  const grade = String(formData.get("grade") ?? "");
  if (!targetId) return { ok: false, error: "Missing target." };
  if (!leagueId) return { ok: false, error: "Missing league context." };
  if (!isVotableGrade(grade)) {
    return { ok: false, error: "Pick a grade." };
  }

  // Both target and voter must be members of THIS league.
  const [targetMember] = await db
    .select({ leagueId: leaguePlayers.leagueId })
    .from(leaguePlayers)
    .where(
      and(
        eq(leaguePlayers.playerId, targetId),
        eq(leaguePlayers.leagueId, leagueId),
      ),
    )
    .limit(1);
  if (!targetMember) {
    return { ok: false, error: "This player isn't in that league." };
  }

  if (session.playerId !== targetId) {
    const [voterMember] = await db
      .select({ leagueId: leaguePlayers.leagueId })
      .from(leaguePlayers)
      .where(
        and(
          eq(leaguePlayers.playerId, session.playerId),
          eq(leaguePlayers.leagueId, leagueId),
        ),
      )
      .limit(1);
    if (!voterMember) {
      return {
        ok: false,
        error: "You can only grade players in leagues you're in.",
      };
    }
  }

  await db
    .insert(playerGrades)
    .values({
      targetPlayerId: targetId,
      voterPlayerId: session.playerId,
      leagueId,
      grade,
    })
    .onConflictDoUpdate({
      target: [
        playerGrades.targetPlayerId,
        playerGrades.voterPlayerId,
        playerGrades.leagueId,
      ],
      set: { grade, updatedAt: new Date() },
    });

  revalidatePath(`/players/${targetId}`);
  revalidatePath("/players");
  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}

/**
 * Remove the viewer's vote on a target in a specific league. Used by
 * the "Clear" action in the grade widget.
 */
export async function clearPlayerGrade(
  targetId: string,
  leagueId: string,
): Promise<ActionResult> {
  const session = await readSession();
  if (!session?.playerId) {
    return { ok: false, error: "Sign in to grade players." };
  }
  if (!leagueId) return { ok: false, error: "Missing league context." };
  await db
    .delete(playerGrades)
    .where(
      and(
        eq(playerGrades.targetPlayerId, targetId),
        eq(playerGrades.voterPlayerId, session.playerId),
        eq(playerGrades.leagueId, leagueId),
      ),
    );
  revalidatePath(`/players/${targetId}`);
  revalidatePath("/players");
  revalidatePath(`/leagues/${leagueId}`);
  return { ok: true };
}
