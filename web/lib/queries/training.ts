/**
 * Training read models. Plain async functions scoped to a player id;
 * streaks / week buckets / heatmap are computed in TS from a small set of
 * rows, per the repo's query conventions.
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
import {
  EXERCISES,
  exerciseBySlug,
  type Exercise,
  type SetupField,
} from "@/lib/training/catalog";
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
  type Targets,
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

function rowToTargets(row: TrainingUserExercise): Targets {
  return {
    repGoal: row.repGoal,
    weightGoal: row.weightGoal,
    weeklyDayTarget: row.weeklyDayTarget,
    weeklyIncrement: row.weeklyIncrement,
  };
}

/** Current-week (Mon–Sun) per-day levels (0/1/2), zeros if week is stale. */
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
  progression: Exercise["progression"];
  currentGoal: number;
  nextGoal: number | null; // weekly-step only
  weightGoal: number | null;
  weeklyIncrement: number;
  weeklyDayTarget: number;
  streak: number;
  days: number[]; // 7 levels (0/1/2), Mon…Sun
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
        progression: ex.progression,
        currentGoal: r.repGoal,
        nextGoal:
          ex.progression === "weekly-step" ? r.repGoal + r.weeklyIncrement : null,
        weightGoal: r.weightGoal,
        weeklyIncrement: r.weeklyIncrement,
        weeklyDayTarget: r.weeklyDayTarget,
        streak: displayStreak(rowToState(r), ex, rowToTargets(r), now),
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
  progression: Exercise["progression"];
  currentGoal: number;
  baseRepGoal: number;
  weightGoal: number | null;
  weeklyIncrement: number;
  weeklyDayTarget: number;
  setupFields: SetupField[];
};

export type AddableExercise = {
  slug: string;
  name: string;
  type: Exercise["type"];
  progression: Exercise["progression"];
  defaultBaseRepGoal: number;
  defaultWeeklyIncrement: number;
  defaultWeeklyDayTarget: number;
  defaultWeightGoal: number | null;
  setupFields: SetupField[];
};

export type CartView = { cart: CartExercise[]; addable: AddableExercise[] };

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
        progression: ex.progression,
        currentGoal: r.repGoal,
        baseRepGoal: r.baseRepGoal,
        weightGoal: r.weightGoal,
        weeklyIncrement: r.weeklyIncrement,
        weeklyDayTarget: r.weeklyDayTarget,
        setupFields: ex.setupFields,
      };
    })
    .filter((x): x is CartExercise => x !== null);

  const addable: AddableExercise[] = EXERCISES.filter(
    (e) => !inCart.has(e.slug),
  ).map((e) => ({
    slug: e.slug,
    name: e.name,
    type: e.type,
    progression: e.progression,
    defaultBaseRepGoal: e.defaultBaseRepGoal,
    defaultWeeklyIncrement: e.defaultWeeklyIncrement,
    defaultWeeklyDayTarget: e.defaultWeeklyDayTarget,
    defaultWeightGoal: e.defaultWeightGoal,
    setupFields: e.setupFields,
  }));

  return { cart, addable };
}

/* --------------------------------- Stats ---------------------------------- */

export type HeatCell = "none" | "pushups" | "bench" | "both";

export type TrainingStats = {
  weeks: string[];
  volume: {
    slug: string;
    name: string;
    type: Exercise["type"];
    series: { week: string; reps: number }[];
    max: number;
  }[];
  chips: { slug: string; name: string; weekly: { week: string; hit: boolean }[] }[];
  heatmap: { week: string; days: HeatCell[] }[];
  streaks: { slug: string; name: string; streak: number }[];
  trophies: (Trophy & { unlocked: boolean })[];
  tiers: Tier[];
};

export async function getTrainingStats(
  playerId: string,
): Promise<TrainingStats> {
  const now = new Date();
  const curMon = mondayOf(now);
  const weeks8 = Array.from({ length: 8 }, (_, i) => addDays(curMon, -7 * (7 - i)));
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

  // Per-user weekly day-target (falls back to the catalog default).
  const dayTargetFor = (slug: string): number =>
    rows.find((r) => r.exerciseSlug === slug)?.weeklyDayTarget ??
    exerciseBySlug(slug)?.defaultWeeklyDayTarget ??
    5;

  const cartSlugs = rows.map((r) => r.exerciseSlug);
  const reportSlugs = cartSlugs.length ? cartSlugs : EXERCISES.map((e) => e.slug);

  const repsByWeek = new Map<string, number>();
  const daysByWeek = new Map<string, Set<number>>();
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
      const target = dayTargetFor(slug);
      const weekly = weeks8.map((week) => ({
        week,
        hit: (daysByWeek.get(`${slug}|${week}`)?.size ?? 0) >= target,
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
        streak: displayStreak(rowToState(r), ex, rowToTargets(r), now),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const unlocked = new Set(trophyRows.map((t) => t.trophyId));
  const trophies = TROPHIES.map((t) => ({ ...t, unlocked: unlocked.has(t.id) }));

  return { weeks: weeks8, volume, chips, heatmap, streaks, trophies, tiers: TIERS };
}
