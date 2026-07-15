"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  players,
  trainingProfile,
  trainingSets,
  trainingTrophies,
  trainingUserExercise,
  type TrainingUserExercise,
} from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { exerciseBySlug } from "@/lib/training/catalog";
import {
  applyLog,
  dayKey,
  earnedTrophies,
  levelForXp,
  mondayOf,
  rollWeeks,
  tierForXp,
  XP,
  type ExerciseState,
  type LogEvents,
} from "@/lib/training/engine";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const SIGN_IN = "Sign in to train." as const;

/** Map a training_user_exercise row to the engine's mutable state view. */
function rowToState(row: TrainingUserExercise): ExerciseState {
  return {
    weekStart: row.weekStart,
    daysLoggedThisWeek: row.daysLoggedThisWeek,
    currentStreakWeeks: row.currentStreakWeeks,
    bestStreakWeeks: row.bestStreakWeeks,
    lifetimeReps: row.lifetimeReps,
    bestSetReps: row.bestSetReps,
    bestSetWeight: row.bestSetWeight,
    lastLoggedDay: row.lastLoggedDay,
    repGoalDay: row.repGoalDay,
    prDay: row.prDay,
    weeklyGoalHitWeek: row.weeklyGoalHitWeek,
  };
}

/** Ensure the player has a training_profile row (idempotent). */
async function ensureProfile(playerId: string): Promise<void> {
  await db
    .insert(trainingProfile)
    .values({ playerId })
    .onConflictDoNothing({ target: trainingProfile.playerId });
}

/** Add an exercise to the player's cart (idempotent). */
export async function addExercise(slug: string): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: SIGN_IN };
  const ex = exerciseBySlug(slug);
  if (!ex) return { ok: false, error: "Unknown exercise." };

  await ensureProfile(session.playerId);
  await db
    .insert(trainingUserExercise)
    .values({
      playerId: session.playerId,
      exerciseSlug: ex.slug,
      repGoal: ex.defaultRepGoal,
      weightGoal: ex.defaultWeightGoal,
      weekStart: mondayOf(new Date()),
      daysLoggedThisWeek: [0, 0, 0, 0, 0, 0, 0],
    })
    .onConflictDoNothing({
      target: [trainingUserExercise.playerId, trainingUserExercise.exerciseSlug],
    });

  revalidatePath("/training");
  revalidatePath("/training/cart");
  return { ok: true, data: null };
}

/** Remove an exercise from the cart. Logged sets and trophies are kept. */
export async function removeExercise(
  slug: string,
): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: SIGN_IN };

  await db
    .delete(trainingUserExercise)
    .where(
      and(
        eq(trainingUserExercise.playerId, session.playerId),
        eq(trainingUserExercise.exerciseSlug, slug),
      ),
    );

  revalidatePath("/training");
  revalidatePath("/training/cart");
  return { ok: true, data: null };
}

export type LogResult = {
  awardedXp: number;
  events: LogEvents;
  milestonesHit: number[];
  newTrophies: string[];
  /** New level if this log crossed a level boundary, else null. */
  leveledTo: number | null;
  /** New tier key if this log crossed a tier boundary, else null. */
  newTier: string | null;
  totalXp: number;
};

/**
 * Log one set. Resolves any week rollover, awards XP + trophies, and
 * returns what fired so the UI can celebrate. Writes are sequential (the
 * Neon HTTP driver has no interactive transactions); each write is
 * ordered and idempotent enough for this personal feature.
 */
export async function logSet(input: {
  slug: string;
  reps: number;
  weight?: number | null;
}): Promise<ActionResult<LogResult>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: SIGN_IN };
  const pid = session.playerId;

  const ex = exerciseBySlug(input.slug);
  if (!ex) return { ok: false, error: "Unknown exercise." };

  const reps = Math.floor(Number(input.reps));
  if (!Number.isFinite(reps) || reps <= 0)
    return { ok: false, error: "Enter a rep count above zero." };

  let weight: number | null = null;
  if (ex.type === "weighted") {
    const w = Math.floor(Number(input.weight));
    if (!Number.isFinite(w) || w < 0)
      return { ok: false, error: "Enter a valid weight." };
    weight = w;
  }

  const [row] = await db
    .select()
    .from(trainingUserExercise)
    .where(
      and(
        eq(trainingUserExercise.playerId, pid),
        eq(trainingUserExercise.exerciseSlug, ex.slug),
      ),
    );
  if (!row)
    return { ok: false, error: "Add this exercise to your program first." };

  const now = new Date();
  const today = dayKey(now);

  // 1) Roll any elapsed weeks (streak increments + milestone XP).
  const rolled = rollWeeks(rowToState(row), ex, now);
  const milestoneXp = rolled.milestonesHit.length * XP.streakMilestone;

  // 2) Today's cumulative reps (for cumulative-goal exercises).
  const [agg] = await db
    .select({ total: sql<number>`coalesce(sum(${trainingSets.reps}), 0)` })
    .from(trainingSets)
    .where(
      and(
        eq(trainingSets.playerId, pid),
        eq(trainingSets.exerciseSlug, ex.slug),
        eq(trainingSets.performedDay, today),
      ),
    );
  const repsTodayTotal = Number(agg?.total ?? 0) + reps;

  // 3) Apply the set.
  const applied = applyLog({
    state: rolled.state,
    exercise: ex,
    repGoal: row.repGoal,
    weightGoal: row.weightGoal,
    reps,
    weight,
    now,
    repsTodayTotal,
  });
  const totalXp = milestoneXp + applied.xp;

  // 4) Persist: the set row, the exercise state, the profile XP.
  await db.insert(trainingSets).values({
    playerId: pid,
    exerciseSlug: ex.slug,
    reps,
    weight,
    performedDay: today,
  });

  const s = applied.state;
  await db
    .update(trainingUserExercise)
    .set({
      weekStart: s.weekStart,
      daysLoggedThisWeek: s.daysLoggedThisWeek,
      currentStreakWeeks: s.currentStreakWeeks,
      bestStreakWeeks: s.bestStreakWeeks,
      lifetimeReps: s.lifetimeReps,
      bestSetReps: s.bestSetReps,
      bestSetWeight: s.bestSetWeight,
      lastLoggedDay: s.lastLoggedDay,
      repGoalDay: s.repGoalDay,
      prDay: s.prDay,
      weeklyGoalHitWeek: s.weeklyGoalHitWeek,
    })
    .where(
      and(
        eq(trainingUserExercise.playerId, pid),
        eq(trainingUserExercise.exerciseSlug, ex.slug),
      ),
    );

  const [prof] = await db
    .select({ xp: trainingProfile.xp })
    .from(trainingProfile)
    .where(eq(trainingProfile.playerId, pid));
  const beforeXp = prof?.xp ?? 0;
  const afterXp = beforeXp + totalXp;
  await db
    .insert(trainingProfile)
    .values({ playerId: pid, xp: afterXp })
    .onConflictDoUpdate({
      target: trainingProfile.playerId,
      set: { xp: afterXp },
    });

  // 5) Trophies — evaluate against fresh cart state + updated XP.
  const [allRows, [me]] = await Promise.all([
    db
      .select()
      .from(trainingUserExercise)
      .where(eq(trainingUserExercise.playerId, pid)),
    db
      .select({ weight: players.weight })
      .from(players)
      .where(eq(players.id, pid)),
  ]);
  const states = allRows
    .map((r) => {
      const exr = exerciseBySlug(r.exerciseSlug);
      return exr ? { exercise: exr, state: rowToState(r) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const earned = earnedTrophies({
    states,
    xp: afterXp,
    playerWeight: me?.weight ?? null,
    today: { slug: ex.slug, repsToday: repsTodayTotal },
  });

  const existing = await db
    .select({ trophyId: trainingTrophies.trophyId })
    .from(trainingTrophies)
    .where(eq(trainingTrophies.playerId, pid));
  const have = new Set(existing.map((t) => t.trophyId));
  const newTrophies = earned.filter((id) => !have.has(id));
  if (newTrophies.length) {
    await db
      .insert(trainingTrophies)
      .values(newTrophies.map((trophyId) => ({ playerId: pid, trophyId })))
      .onConflictDoNothing({
        target: [trainingTrophies.playerId, trainingTrophies.trophyId],
      });
  }

  const leveledTo =
    levelForXp(afterXp) > levelForXp(beforeXp) ? levelForXp(afterXp) : null;
  const newTier =
    tierForXp(afterXp).key !== tierForXp(beforeXp).key
      ? tierForXp(afterXp).key
      : null;

  revalidatePath("/training");
  revalidatePath("/training/log");
  revalidatePath("/training/stats");

  return {
    ok: true,
    data: {
      awardedXp: applied.xp,
      events: applied.events,
      milestonesHit: rolled.milestonesHit,
      newTrophies,
      leveledTo,
      newTier,
      totalXp,
    },
  };
}
