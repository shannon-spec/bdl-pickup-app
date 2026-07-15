"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db,
  players,
  trainingProfile,
  trainingSets,
  trainingTrophies,
  trainingUserExercise,
  trainingWeekResults,
  type TrainingUserExercise,
} from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { exerciseBySlug, type Exercise } from "@/lib/training/catalog";
import {
  applyLog,
  dayKey,
  earnedTrophies,
  levelForXp,
  mondayOf,
  qualifyingCount,
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
    weeklyWeightIncrement: row.weeklyWeightIncrement,
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

/** Record (or refresh) a week's completion result. Called on the live week
 *  each log, and to freeze the prior week when it rolls over. */
async function upsertWeekResult(
  playerId: string,
  exercise: Exercise,
  weekStart: string,
  flags: number[] | null,
  dayTarget: number,
  dailyGoal: number,
): Promise<void> {
  const qualifyingDays = qualifyingCount(flags, exercise);
  const completed = qualifyingDays >= dayTarget;
  await db
    .insert(trainingWeekResults)
    .values({
      playerId,
      exerciseSlug: exercise.slug,
      weekStart,
      qualifyingDays,
      dayTarget,
      dailyGoal,
      completed,
    })
    .onConflictDoUpdate({
      target: [
        trainingWeekResults.playerId,
        trainingWeekResults.exerciseSlug,
        trainingWeekResults.weekStart,
      ],
      set: { qualifyingDays, dayTarget, dailyGoal, completed },
    });
}

export type SetupInput = {
  slug: string;
  baseRepGoal?: number;
  weeklyIncrement?: number;
  baseWeightGoal?: number;
  weeklyWeightIncrement?: number;
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

  // Weight-progression config (bench): starting weight + weekly weight step.
  const isWeightProg = ex.progression === "weekly-weight-step";
  const baseWeightGoal = isWeightProg
    ? clampInt(input.baseWeightGoal, ex.defaultBaseWeightGoal ?? 0, 0, 2000)
    : ex.defaultBaseWeightGoal;
  const weeklyWeightIncrement = isWeightProg
    ? clampInt(input.weeklyWeightIncrement, ex.defaultWeeklyWeightIncrement, 0, 500)
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
      baseWeightGoal,
      weeklyWeightIncrement,
      weeklyDayTarget,
      // current weight goal starts at the baseline for weight progression
      weightGoal: isWeightProg ? baseWeightGoal : ex.defaultWeightGoal,
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
  baseWeightGoal?: number;
  weeklyWeightIncrement?: number;
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
  if (
    ex.progression === "weekly-weight-step" &&
    input.weeklyWeightIncrement !== undefined
  )
    set.weeklyWeightIncrement = clampInt(
      input.weeklyWeightIncrement,
      row.weeklyWeightIncrement,
      0,
      500,
    );
  if (
    ex.progression === "weekly-weight-step" &&
    input.baseWeightGoal !== undefined
  ) {
    const bw = clampInt(input.baseWeightGoal, row.baseWeightGoal ?? 0, 0, 2000);
    set.baseWeightGoal = bw;
    // If the weight goal hasn't progressed past the baseline yet, move it too.
    if (row.weightGoal === row.baseWeightGoal) set.weightGoal = bw;
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
  baseWeightGoal?: number;
  weeklyWeightIncrement?: number;
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
  const isWeightProg = ex.progression === "weekly-weight-step";
  const baseWeightGoal = isWeightProg
    ? clampInt(input.baseWeightGoal, row.baseWeightGoal ?? 0, 0, 2000)
    : row.baseWeightGoal;
  const weeklyWeightIncrement = isWeightProg
    ? clampInt(input.weeklyWeightIncrement, row.weeklyWeightIncrement, 0, 500)
    : row.weeklyWeightIncrement;

  await db
    .update(trainingUserExercise)
    .set({
      baseRepGoal,
      repGoal: baseRepGoal, // re-baseline the current daily goal
      weeklyIncrement,
      baseWeightGoal,
      weeklyWeightIncrement,
      weightGoal: isWeightProg ? baseWeightGoal : row.weightGoal,
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

/**
 * Set (or re-confirm) a plan-based exercise's per-set plan. Used for the
 * initial cart setup, the Edit panel, and the weekly confirm/adjust step —
 * all just write the sets and stamp the current week as confirmed. Streak
 * and lifetime state are preserved on an existing row.
 */
export async function setBenchPlan(input: {
  slug: string;
  sets: { weight: number; reps: number }[];
  weeklyWeightIncrement?: number;
  weeklyDayTarget?: number;
}): Promise<ActionResult<null>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: SIGN_IN };
  const pid = session.playerId;
  const ex = exerciseBySlug(input.slug);
  if (!ex || !ex.usesPlan) return { ok: false, error: "Unknown exercise." };

  const raw = Array.isArray(input.sets) ? input.sets : [];
  if (raw.length === 0) return { ok: false, error: "Add at least one set." };
  if (raw.length > 10) return { ok: false, error: "Up to 10 sets." };
  const sets = raw.map((s) => ({
    weight: clampInt(s.weight, 0, 0, 2000),
    reps: clampInt(s.reps, 1, 1, 100),
  }));
  const weeklyDayTarget = clampInt(
    input.weeklyDayTarget,
    ex.defaultWeeklyDayTarget,
    1,
    7,
  );
  const weeklyWeightIncrement = clampInt(
    input.weeklyWeightIncrement,
    ex.defaultWeeklyWeightIncrement,
    0,
    500,
  );
  const weightGoal = Math.max(0, ...sets.map((s) => s.weight));
  const week = mondayOf(new Date());

  await ensureProfile(pid);
  const [existing] = await db
    .select({ playerId: trainingUserExercise.playerId })
    .from(trainingUserExercise)
    .where(
      and(
        eq(trainingUserExercise.playerId, pid),
        eq(trainingUserExercise.exerciseSlug, ex.slug),
      ),
    );

  if (existing) {
    await db
      .update(trainingUserExercise)
      .set({
        plan: sets,
        planConfirmedWeek: week,
        weeklyWeightIncrement,
        weeklyDayTarget,
        weightGoal,
      })
      .where(
        and(
          eq(trainingUserExercise.playerId, pid),
          eq(trainingUserExercise.exerciseSlug, ex.slug),
        ),
      );
  } else {
    await db.insert(trainingUserExercise).values({
      playerId: pid,
      exerciseSlug: ex.slug,
      repGoal: ex.defaultBaseRepGoal,
      baseRepGoal: ex.defaultBaseRepGoal,
      weightGoal,
      baseWeightGoal: weightGoal,
      weeklyWeightIncrement,
      weeklyDayTarget,
      plan: sets,
      planConfirmedWeek: week,
      weekStart: week,
      daysLoggedThisWeek: [0, 0, 0, 0, 0, 0, 0],
    });
  }

  revalidatePath("/training");
  revalidatePath("/training/cart");
  revalidatePath("/training/log");
  return { ok: true, data: null };
}

export type LogResult = {
  awardedXp: number;
  events: LogEvents;
  milestonesHit: number[];
  newTrophies: string[];
  leveledTo: number | null;
  newTier: string | null;
  /** Goal after a completed week stepped it up (rep or weight), else null. */
  goalRaised: { to: number; unit: string } | null;
  totalXp: number;
};

export async function logSet(input: {
  slug: string;
  reps?: number;
  weight?: number | null;
  made?: number | null;
  day?: string;
}): Promise<ActionResult<LogResult>> {
  const session = await readSession();
  if (!session?.playerId) return { ok: false, error: SIGN_IN };
  const pid = session.playerId;

  const ex = exerciseBySlug(input.slug);
  if (!ex) return { ok: false, error: "Unknown exercise." };

  const now = new Date();
  const today = dayKey(now);
  // Date override: defaults to today; must be valid and not in the future.
  const day = input.day ?? today;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    Number.isNaN(Date.parse(`${day}T12:00:00Z`))
  )
    return { ok: false, error: "Enter a valid date." };
  if (day > today) return { ok: false, error: "Can't log a future date." };
  const isCurrentWeek = day >= mondayOf(now); // day <= today already ensured

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

  // Derive the logged values. Plan-based exercises (bench) are "mark done":
  // reps/weight come from the confirmed plan, not user input.
  let reps: number;
  let weight: number | null = null;
  let made: number | null = null;
  if (ex.usesPlan) {
    const plan = row.plan ?? [];
    if (plan.length === 0)
      return { ok: false, error: "Set up your plan first." };
    if (row.planConfirmedWeek !== mondayOf(now))
      return { ok: false, error: "Confirm this week's weights first." };
    reps = plan.reduce((n, s) => n + s.reps, 0);
    weight = Math.max(0, ...plan.map((s) => s.weight)) || null;
  } else {
    reps = Math.floor(Number(input.reps));
    if (!Number.isFinite(reps) || reps <= 0)
      return { ok: false, error: "Enter a rep count above zero." };
    if (ex.type === "weighted") {
      const w = Math.floor(Number(input.weight));
      if (!Number.isFinite(w) || w < 0)
        return { ok: false, error: "Enter a valid weight." };
      weight = w;
    }
    if (ex.secondary?.key === "made" && input.made != null) {
      const m = Math.floor(Number(input.made));
      if (!Number.isFinite(m) || m < 0)
        return { ok: false, error: "Enter a valid makes count." };
      made = Math.min(m, reps);
    }
  }

  // Roll elapsed weeks — streak, milestone XP, and any daily-goal step-up
  // (time-based; independent of the logged day).
  const rolled = rollWeeks(rowToState(row), ex, rowToTargets(row), now);
  const milestoneXp = rolled.milestonesHit.length * XP.streakMilestone;
  const repRaised = rolled.newRepGoal > row.repGoal;
  const weightRaised = (rolled.newWeightGoal ?? 0) > (row.weightGoal ?? 0);
  const goalRaised = repRaised
    ? { to: rolled.newRepGoal, unit: ex.repLabel.toLowerCase() }
    : weightRaised && rolled.newWeightGoal != null
      ? { to: rolled.newWeightGoal, unit: "lb" }
      : null;
  const targets: Targets = {
    ...rowToTargets(row),
    repGoal: rolled.newRepGoal,
    weightGoal: rolled.newWeightGoal,
  };

  // On rollover, freeze the just-finished week's completion result.
  if (row.weekStart && rolled.state.weekStart !== row.weekStart) {
    await upsertWeekResult(
      pid,
      ex,
      row.weekStart,
      row.daysLoggedThisWeek,
      row.weeklyDayTarget,
      row.repGoal,
    );
  }

  // Day-level facts from the stored sets for `day` (before inserting this
  // one) — keeps the once-per-day awards correct even when back-dating.
  const prior = await db
    .select({ reps: trainingSets.reps, weight: trainingSets.weight })
    .from(trainingSets)
    .where(
      and(
        eq(trainingSets.playerId, pid),
        eq(trainingSets.exerciseSlug, ex.slug),
        eq(trainingSets.performedDay, day),
      ),
    );
  const priorReps = prior.reduce((n, r) => n + r.reps, 0);
  const repsTodayTotal = priorReps + reps;
  const firstLogToday = prior.length === 0;
  const priorGoalMet =
    ex.repCounting === "cumulative"
      ? priorReps >= targets.repGoal
      : prior.some((r) => r.reps >= targets.repGoal);
  const wg = targets.weightGoal;
  const priorPr =
    ex.type === "weighted" && wg != null
      ? prior.some((r) => r.reps >= targets.repGoal && (r.weight ?? 0) >= wg)
      : false;

  // Record the set.
  await db.insert(trainingSets).values({
    playerId: pid,
    exerciseSlug: ex.slug,
    reps,
    weight,
    made,
    performedDay: day,
  });

  // Awards + day flags apply only for the live week; past-week logs are
  // totals-only (recorded above, counted in lifetime below).
  let s = rolled.state;
  let events: LogEvents = {
    logDay: false,
    repGoal: false,
    pr: false,
    weekly: false,
  };
  let awardedXp = 0;
  if (isCurrentWeek) {
    const applied = applyLog({
      state: s,
      exercise: ex,
      targets,
      day,
      reps,
      weight,
      repsTodayTotal,
      firstLogToday,
      priorGoalMet,
      priorPr,
    });
    s = applied.state;
    events = applied.events;
    awardedXp = applied.xp;
  }
  // Lifetime totals + best set apply for any day (incl. past weeks).
  s = {
    ...s,
    lifetimeReps: s.lifetimeReps + reps,
    bestSetReps: Math.max(s.bestSetReps ?? 0, reps),
    bestSetWeight:
      ex.type === "weighted" && weight != null
        ? Math.max(s.bestSetWeight ?? 0, weight)
        : s.bestSetWeight,
  };
  const totalXp = milestoneXp + awardedXp;
  await db
    .update(trainingUserExercise)
    .set({
      repGoal: rolled.newRepGoal,
      weightGoal: rolled.newWeightGoal,
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

  // Refresh the live week's completion result (current-week logs only).
  if (isCurrentWeek && s.weekStart) {
    await upsertWeekResult(
      pid,
      ex,
      s.weekStart,
      s.daysLoggedThisWeek,
      targets.weeklyDayTarget,
      targets.repGoal,
    );
  }

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
      awardedXp,
      events,
      milestonesHit: rolled.milestonesHit,
      newTrophies,
      leveledTo,
      newTier,
      goalRaised,
      totalXp,
    },
  };
}
