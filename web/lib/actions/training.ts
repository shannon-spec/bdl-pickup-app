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
  type Targets,
} from "@/lib/training/engine";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const SIGN_IN = "Sign in to train." as const;

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

function rowToTargets(row: TrainingUserExercise): Targets {
  return {
    repGoal: row.repGoal,
    weightGoal: row.weightGoal,
    weeklyDayTarget: row.weeklyDayTarget,
    weeklyIncrement: row.weeklyIncrement,
  };
}

const clampInt = (
  v: number | undefined,
  def: number,
  min: number,
  max: number,
): number => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
};

async function ensureProfile(playerId: string): Promise<void> {
  await db
    .insert(trainingProfile)
    .values({ playerId })
    .onConflictDoNothing({ target: trainingProfile.playerId });
}

export type SetupInput = {
  slug: string;
  baseRepGoal?: number;
  weeklyIncrement?: number;
  weeklyDayTarget?: number;
};

/** Add an exercise to the cart with its (per-player) setup (idempotent). */
export async function addExercise(
  input: SetupInput,
): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: SIGN_IN };
  const ex = exerciseBySlug(input.slug);
  if (!ex) return { ok: false, error: "Unknown exercise." };

  const baseRepGoal = clampInt(input.baseRepGoal, ex.defaultBaseRepGoal, 1, 1000);
  const weeklyDayTarget = clampInt(
    input.weeklyDayTarget,
    ex.defaultWeeklyDayTarget,
    1,
    7,
  );
  const weeklyIncrement =
    ex.progression === "weekly-step"
      ? clampInt(input.weeklyIncrement, ex.defaultWeeklyIncrement, 0, 500)
      : 0;

  await ensureProfile(session.playerId);
  await db
    .insert(trainingUserExercise)
    .values({
      playerId: session.playerId,
      exerciseSlug: ex.slug,
      repGoal: baseRepGoal, // current daily goal starts at the baseline
      baseRepGoal,
      weeklyIncrement,
      weeklyDayTarget,
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

/** Edit a cart exercise's setup (baseline / weekly increase / day target). */
export async function updateExerciseSetup(input: {
  slug: string;
  baseRepGoal?: number;
  weeklyIncrement?: number;
  weeklyDayTarget?: number;
}): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: SIGN_IN };
  const ex = exerciseBySlug(input.slug);
  if (!ex) return { ok: false, error: "Unknown exercise." };

  const [row] = await db
    .select()
    .from(trainingUserExercise)
    .where(
      and(
        eq(trainingUserExercise.playerId, session.playerId),
        eq(trainingUserExercise.exerciseSlug, ex.slug),
      ),
    );
  if (!row)
    return { ok: false, error: "Add this exercise to your program first." };

  const set: Partial<TrainingUserExercise> = {};
  if (input.weeklyDayTarget !== undefined)
    set.weeklyDayTarget = clampInt(input.weeklyDayTarget, row.weeklyDayTarget, 1, 7);
  if (ex.progression === "weekly-step" && input.weeklyIncrement !== undefined)
    set.weeklyIncrement = clampInt(input.weeklyIncrement, row.weeklyIncrement, 0, 500);
  if (input.baseRepGoal !== undefined) {
    const b = clampInt(input.baseRepGoal, row.baseRepGoal, 1, 1000);
    set.baseRepGoal = b;
    // If the daily goal hasn't progressed past the baseline yet, move it too.
    if (row.repGoal === row.baseRepGoal) set.repGoal = b;
  }

  if (Object.keys(set).length) {
    await db
      .update(trainingUserExercise)
      .set(set)
      .where(
        and(
          eq(trainingUserExercise.playerId, session.playerId),
          eq(trainingUserExercise.exerciseSlug, ex.slug),
        ),
      );
  }

  revalidatePath("/training");
  revalidatePath("/training/cart");
  return { ok: true, data: null };
}

/**
 * Start a fresh streak: zero the current streak + this week and re-baseline
 * the daily goal to the entered baseline. Keeps XP, best streak, lifetime
 * reps, best set, and trophies (account-level history is preserved).
 */
export async function startNewStreak(input: {
  slug: string;
  baseRepGoal?: number;
  weeklyIncrement?: number;
  weeklyDayTarget?: number;
}): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: SIGN_IN };
  const ex = exerciseBySlug(input.slug);
  if (!ex) return { ok: false, error: "Unknown exercise." };

  const [row] = await db
    .select()
    .from(trainingUserExercise)
    .where(
      and(
        eq(trainingUserExercise.playerId, session.playerId),
        eq(trainingUserExercise.exerciseSlug, ex.slug),
      ),
    );
  if (!row)
    return { ok: false, error: "Add this exercise to your program first." };

  const baseRepGoal = clampInt(input.baseRepGoal, row.baseRepGoal, 1, 1000);
  const weeklyDayTarget = clampInt(input.weeklyDayTarget, row.weeklyDayTarget, 1, 7);
  const weeklyIncrement =
    ex.progression === "weekly-step"
      ? clampInt(input.weeklyIncrement, row.weeklyIncrement, 0, 500)
      : 0;

  await db
    .update(trainingUserExercise)
    .set({
      baseRepGoal,
      repGoal: baseRepGoal, // re-baseline the current daily goal
      weeklyIncrement,
      weeklyDayTarget,
      currentStreakWeeks: 0,
      weekStart: mondayOf(new Date()),
      daysLoggedThisWeek: [0, 0, 0, 0, 0, 0, 0],
      lastLoggedDay: null,
      repGoalDay: null,
      prDay: null,
      weeklyGoalHitWeek: null,
      // Preserved: bestStreakWeeks, lifetimeReps, bestSetReps, bestSetWeight.
    })
    .where(
      and(
        eq(trainingUserExercise.playerId, session.playerId),
        eq(trainingUserExercise.exerciseSlug, ex.slug),
      ),
    );

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
  leveledTo: number | null;
  newTier: string | null;
  /** Daily goal after this log stepped it up (week rollover), else null. */
  goalRaisedTo: number | null;
  totalXp: number;
};

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

  // 1) Roll elapsed weeks — streak, milestone XP, and any daily-goal step-up.
  const rolled = rollWeeks(rowToState(row), ex, rowToTargets(row), now);
  const milestoneXp = rolled.milestonesHit.length * XP.streakMilestone;
  const goalRaisedTo =
    rolled.newRepGoal > row.repGoal ? rolled.newRepGoal : null;
  // This week's goal is the (possibly stepped-up) value.
  const targets: Targets = { ...rowToTargets(row), repGoal: rolled.newRepGoal };

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
    targets,
    reps,
    weight,
    now,
    repsTodayTotal,
  });
  const totalXp = milestoneXp + applied.xp;

  // 4) Persist the set, the exercise state (+ stepped goal), and profile XP.
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
      repGoal: rolled.newRepGoal,
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
      goalRaisedTo,
      totalXp,
    },
  };
}
