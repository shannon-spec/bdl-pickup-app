/**
 * Training read models. Plain async functions scoped to a player id;
 * heavy lifting (streaks, week buckets, heatmap) is computed in TS from
 * a small set of rows, per the repo's query conventions.
 */

import { and, asc, eq, gte } from "drizzle-orm";
import {
  db,
  trainingProfile,
  trainingSets,
  trainingTrophies,
  trainingUserExercise,
  type TrainingUserExercise,
} from "@/lib/db";
import { EXERCISES, exerciseBySlug, type Exercise } from "@/lib/training/catalog";
import {
  addDays,
  daysBetween,
  displayStreak,
  levelForXp,
  levelProgress,
  mondayOf,
  mondayOfKey,
  TIERS,
  TROPHIES,
  tierForLevel,
  type ExerciseState,
  type Tier,
  type Trophy,
} from "@/lib/training/engine";

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

/** Current-week (Mon–Sun) day flags, empty if the stored week is stale. */
function currentWeekDays(row: TrainingUserExercise, now: Date): number[] {
  const cur = mondayOf(now);
  if (row.weekStart === cur && row.daysLoggedThisWeek)
    return row.daysLoggedThisWeek.slice(0, 7);
  return [0, 0, 0, 0, 0, 0, 0];
}

/* --------------------------------- Home ----------------------------------- */

export type HomeExercise = {
  slug: string;
  name: string;
  type: Exercise["type"];
  repGoal: number;
  weightGoal: number | null;
  weeklyDayTarget: number;
  streak: number;
  days: number[]; // 7 flags, Mon…Sun
};

export type TrainingHome = {
  xp: number;
  level: number;
  tier: Tier;
  progress: { into: number; needed: number; pct: number };
  exercises: HomeExercise[];
  hasCart: boolean;
};

export async function getTrainingHome(playerId: string): Promise<TrainingHome> {
  const now = new Date();
  const [[prof], rows] = await Promise.all([
    db
      .select({ xp: trainingProfile.xp })
      .from(trainingProfile)
      .where(eq(trainingProfile.playerId, playerId)),
    db
      .select()
      .from(trainingUserExercise)
      .where(eq(trainingUserExercise.playerId, playerId))
      .orderBy(asc(trainingUserExercise.addedAt)),
  ]);

  const xp = prof?.xp ?? 0;
  const level = levelForXp(xp);
  const { into, needed, pct } = levelProgress(xp);

  const exercises: HomeExercise[] = rows
    .map((r) => {
      const ex = exerciseBySlug(r.exerciseSlug);
      if (!ex) return null;
      return {
        slug: ex.slug,
        name: ex.name,
        type: ex.type,
        repGoal: r.repGoal,
        weightGoal: r.weightGoal,
        weeklyDayTarget: ex.weeklyDayTarget,
        streak: displayStreak(rowToState(r), ex, now),
        days: currentWeekDays(r, now),
      };
    })
    .filter((x): x is HomeExercise => x !== null);

  return {
    xp,
    level,
    tier: tierForLevel(level),
    progress: { into, needed, pct },
    exercises,
    hasCart: exercises.length > 0,
  };
}

/* --------------------------------- Cart ----------------------------------- */

export type CartExercise = {
  slug: string;
  name: string;
  type: Exercise["type"];
  repGoal: number;
  weightGoal: number | null;
  weeklyDayTarget: number;
};

export type CartView = {
  cart: CartExercise[];
  addable: {
    slug: string;
    name: string;
    type: Exercise["type"];
    defaultRepGoal: number;
    defaultWeightGoal: number | null;
    weeklyDayTarget: number;
  }[];
};

export async function getCart(playerId: string): Promise<CartView> {
  const rows = await db
    .select()
    .from(trainingUserExercise)
    .where(eq(trainingUserExercise.playerId, playerId))
    .orderBy(asc(trainingUserExercise.addedAt));

  const inCart = new Set(rows.map((r) => r.exerciseSlug));
  const cart: CartExercise[] = rows
    .map((r) => {
      const ex = exerciseBySlug(r.exerciseSlug);
      if (!ex) return null;
      return {
        slug: ex.slug,
        name: ex.name,
        type: ex.type,
        repGoal: r.repGoal,
        weightGoal: r.weightGoal,
        weeklyDayTarget: ex.weeklyDayTarget,
      };
    })
    .filter((x): x is CartExercise => x !== null);

  const addable = EXERCISES.filter((e) => !inCart.has(e.slug)).map((e) => ({
    slug: e.slug,
    name: e.name,
    type: e.type,
    defaultRepGoal: e.defaultRepGoal,
    defaultWeightGoal: e.defaultWeightGoal,
    weeklyDayTarget: e.weeklyDayTarget,
  }));

  return { cart, addable };
}

/* --------------------------------- Stats ---------------------------------- */

export type HeatCell = "none" | "pushups" | "bench" | "both";

export type TrainingStats = {
  weeks: string[]; // 8 Monday keys, oldest → newest
  volume: {
    slug: string;
    name: string;
    type: Exercise["type"];
    /** last 6 weeks */
    series: { week: string; reps: number }[];
    max: number;
  }[];
  chips: {
    slug: string;
    name: string;
    weekly: { week: string; hit: boolean }[]; // last 8
  }[];
  heatmap: { week: string; days: HeatCell[] }[]; // 8 × 7 (Mon…Sun)
  streaks: { slug: string; name: string; streak: number }[];
  trophies: (Trophy & { unlocked: boolean })[];
  tiers: Tier[];
};

export async function getTrainingStats(
  playerId: string,
): Promise<TrainingStats> {
  const now = new Date();
  const curMon = mondayOf(now);
  const weeks8 = Array.from({ length: 8 }, (_, i) =>
    addDays(curMon, -7 * (7 - i)),
  ); // oldest → newest
  const cutoff = weeks8[0];

  const [rows, sets, trophyRows] = await Promise.all([
    db
      .select()
      .from(trainingUserExercise)
      .where(eq(trainingUserExercise.playerId, playerId))
      .orderBy(asc(trainingUserExercise.addedAt)),
    db
      .select({
        slug: trainingSets.exerciseSlug,
        day: trainingSets.performedDay,
        reps: trainingSets.reps,
      })
      .from(trainingSets)
      .where(
        and(
          eq(trainingSets.playerId, playerId),
          gte(trainingSets.performedDay, cutoff),
        ),
      ),
    db
      .select({ trophyId: trainingTrophies.trophyId })
      .from(trainingTrophies)
      .where(eq(trainingTrophies.playerId, playerId)),
  ]);

  // The exercises to report on: whatever's in the cart (fallback: catalog).
  const cartSlugs = rows.map((r) => r.exerciseSlug);
  const reportSlugs = cartSlugs.length
    ? cartSlugs
    : EXERCISES.map((e) => e.slug);

  // Bucket sets by (slug, week) for volume, and (slug, week, dayIdx) for days.
  const repsByWeek = new Map<string, number>(); // `${slug}|${week}` → reps
  const daysByWeek = new Map<string, Set<number>>(); // `${slug}|${week}` → dayIdx set
  for (const s of sets) {
    const wk = mondayOfKey(s.day);
    const kw = `${s.slug}|${wk}`;
    repsByWeek.set(kw, (repsByWeek.get(kw) ?? 0) + s.reps);
    const idx = Math.min(6, Math.max(0, daysBetween(wk, s.day)));
    if (!daysByWeek.has(kw)) daysByWeek.set(kw, new Set());
    daysByWeek.get(kw)!.add(idx);
  }

  const volume = reportSlugs
    .map((slug) => {
      const ex = exerciseBySlug(slug);
      if (!ex) return null;
      const series = weeks8.slice(-6).map((week) => ({
        week,
        reps: repsByWeek.get(`${slug}|${week}`) ?? 0,
      }));
      return {
        slug,
        name: ex.name,
        type: ex.type,
        series,
        max: Math.max(1, ...series.map((p) => p.reps)),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const chips = reportSlugs
    .map((slug) => {
      const ex = exerciseBySlug(slug);
      if (!ex) return null;
      const weekly = weeks8.map((week) => ({
        week,
        hit:
          (daysByWeek.get(`${slug}|${week}`)?.size ?? 0) >= ex.weeklyDayTarget,
      }));
      return { slug, name: ex.name, weekly };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const heatmap = weeks8.map((week) => {
    const pDays = daysByWeek.get(`pushups|${week}`) ?? new Set<number>();
    const bDays = daysByWeek.get(`bench|${week}`) ?? new Set<number>();
    const days: HeatCell[] = Array.from({ length: 7 }, (_, i) => {
      const p = pDays.has(i);
      const b = bDays.has(i);
      return p && b ? "both" : p ? "pushups" : b ? "bench" : "none";
    });
    return { week, days };
  });

  const streaks = rows
    .map((r) => {
      const ex = exerciseBySlug(r.exerciseSlug);
      if (!ex) return null;
      return {
        slug: ex.slug,
        name: ex.name,
        streak: displayStreak(rowToState(r), ex, now),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const unlocked = new Set(trophyRows.map((t) => t.trophyId));
  const trophies = TROPHIES.map((t) => ({ ...t, unlocked: unlocked.has(t.id) }));

  return {
    weeks: weeks8,
    volume,
    chips,
    heatmap,
    streaks,
    trophies,
    tiers: TIERS,
  };
}
