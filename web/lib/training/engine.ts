/**
 * Training engine — pure, DB-free game logic.
 *
 * All XP / level / tier / streak / progression / trophy math lives here so
 * it can be unit-checked in isolation (engine.check.ts). Server actions
 * load rows, call these functions with the player's per-exercise targets,
 * and persist the results.
 *
 * Dates are `YYYY-MM-DD` strings (matching Drizzle `date` columns) computed
 * in a fixed timezone so day/week boundaries are stable. Weeks are Mon–Sun.
 *
 * Per-day logging is tracked at three levels in daysLoggedThisWeek[]:
 *   0 = nothing, 1 = logged (under the daily goal), 2 = daily goal met.
 * An exercise's weekQualifier decides which level counts toward the weekly
 * day-target ("logged" → ≥1, "goal-met" → 2).
 */

import type { Exercise } from "./catalog";

/** Fixed timezone for day/week boundaries. */
export const TRAINING_TZ = "America/New_York";

export const XP = {
  logDay: 20,
  repGoal: 30,
  prGoal: 50,
  weeklyGoal: 100,
  streakMilestone: 150,
} as const;

export const XP_PER_LEVEL = 500;
export const STREAK_MILESTONES = [4, 8, 12, 26, 52];

/* ---------------------------------- Dates --------------------------------- */

export function dayKey(d: Date, tz: string = TRAINING_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

const WD: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const pa = Date.parse(`${a}T12:00:00Z`);
  const pb = Date.parse(`${b}T12:00:00Z`);
  return Math.round((pb - pa) / 86_400_000);
}

/** Monday (`YYYY-MM-DD`) of the week containing a plain date key. */
export function mondayOfKey(key: string): string {
  const wd = new Date(`${key}T12:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
  return addDays(key, -((wd + 6) % 7));
}

/** Monday (`YYYY-MM-DD`) of the week containing `d`, in the training tz. */
export function mondayOf(d: Date, tz: string = TRAINING_TZ): string {
  const wdName = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(d);
  return addDays(dayKey(d, tz), -((WD[wdName] + 6) % 7));
}

/* --------------------------------- Levels --------------------------------- */

export function levelForXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

export function levelProgress(xp: number): {
  level: number;
  into: number;
  needed: number;
  pct: number;
} {
  const level = levelForXp(xp);
  const into = Math.max(0, xp) - (level - 1) * XP_PER_LEVEL;
  return {
    level,
    into,
    needed: XP_PER_LEVEL,
    pct: Math.round((into / XP_PER_LEVEL) * 100),
  };
}

/* ---------------------------------- Tiers --------------------------------- */

export type TierKey = "rookie" | "prospect" | "contender" | "beast" | "elite";

export type Tier = {
  key: TierKey;
  name: string;
  minLevel: number;
  stars: number;
  color: string;
  perk: string;
};

export const TIERS: Tier[] = [
  {
    key: "rookie",
    name: "Rookie",
    minLevel: 1,
    stars: 1,
    color: "var(--text-3)",
    perk: "Learning the ropes — first trophies and the 7-day tracker.",
  },
  {
    key: "prospect",
    name: "Prospect",
    minLevel: 5,
    stars: 2,
    color: "var(--info)",
    perk: "1 Streak Freeze token per month (coming soon).",
  },
  {
    key: "contender",
    name: "Contender",
    minLevel: 10,
    stars: 3,
    color: "var(--brand)",
    perk: "Weekly challenges (coming soon).",
  },
  {
    key: "beast",
    name: "Beast",
    minLevel: 15,
    stars: 4,
    color: "var(--brand-2)",
    perk: "Weekend 1.5× XP boost and exclusive trophies (coming soon).",
  },
  {
    key: "elite",
    name: "Elite",
    minLevel: 20,
    stars: 5,
    color: "var(--gold)",
    perk: "Prestige badge and leaderboard eligibility (coming soon).",
  },
];

export function tierForLevel(level: number): Tier {
  let t = TIERS[0];
  for (const tier of TIERS) if (level >= tier.minLevel) t = tier;
  return t;
}

export function tierForXp(xp: number): Tier {
  return tierForLevel(levelForXp(xp));
}

/* ------------------------------ Exercise state ---------------------------- */

/** The player's per-exercise goals (from training_user_exercise). */
export type Targets = {
  /** Current daily rep goal (evolves via weekly-step progression). */
  repGoal: number;
  weightGoal: number | null;
  weeklyDayTarget: number;
  weeklyIncrement: number;
};

/** In-memory mirror of the mutable game-state columns. */
export type ExerciseState = {
  weekStart: string | null;
  /** 7 per-day levels (0 none / 1 logged / 2 goal-met), index 0 = Monday. */
  daysLoggedThisWeek: number[] | null;
  currentStreakWeeks: number;
  bestStreakWeeks: number;
  lifetimeReps: number;
  bestSetReps: number | null;
  bestSetWeight: number | null;
  lastLoggedDay: string | null;
  repGoalDay: string | null;
  prDay: string | null;
  weeklyGoalHitWeek: string | null;
};

const emptyWeek = (): number[] => [0, 0, 0, 0, 0, 0, 0];

/** Days logged at all (level ≥ 1) — used for the dot tracker + heatmap. */
const loggedCount = (flags: number[] | null): number =>
  (flags ?? []).reduce((n, f) => n + (f >= 1 ? 1 : 0), 0);

const qualifyThreshold = (exercise: Exercise): number =>
  exercise.weekQualifier === "goal-met" ? 2 : 1;

/** Days that count toward this exercise's weekly day-target. */
export function qualifyingCount(
  flags: number[] | null,
  exercise: Exercise,
): number {
  const t = qualifyThreshold(exercise);
  return (flags ?? []).reduce((n, f) => n + (f >= t ? 1 : 0), 0);
}

function goalMet(
  exercise: Exercise,
  repGoal: number,
  reps: number,
  repsTodayTotal: number,
): boolean {
  return exercise.repCounting === "cumulative"
    ? repsTodayTotal >= repGoal
    : reps >= repGoal;
}

export function initialState(now: Date): ExerciseState {
  return {
    weekStart: mondayOf(now),
    daysLoggedThisWeek: emptyWeek(),
    currentStreakWeeks: 0,
    bestStreakWeeks: 0,
    lifetimeReps: 0,
    bestSetReps: null,
    bestSetWeight: null,
    lastLoggedDay: null,
    repGoalDay: null,
    prDay: null,
    weeklyGoalHitWeek: null,
  };
}

/**
 * Advance state to the current week, resolving elapsed week(s). A stored
 * week succeeds when its qualifying-day count met the target: success
 * bumps the streak (and may hit a milestone) and — for weekly-step
 * exercises — steps the daily goal up by the increment. A miss/gap resets
 * the streak; the goal never steps mid-week.
 */
export function rollWeeks(
  state: ExerciseState,
  exercise: Exercise,
  targets: Targets,
  now: Date,
): { state: ExerciseState; milestonesHit: number[]; newRepGoal: number } {
  const current = mondayOf(now);

  if (!state.weekStart) {
    return {
      state: { ...state, weekStart: current, daysLoggedThisWeek: emptyWeek() },
      milestonesHit: [],
      newRepGoal: targets.repGoal,
    };
  }
  if (state.weekStart === current) {
    return {
      state: {
        ...state,
        daysLoggedThisWeek: state.daysLoggedThisWeek ?? emptyWeek(),
      },
      milestonesHit: [],
      newRepGoal: targets.repGoal,
    };
  }

  const weeksPassed = Math.round(daysBetween(state.weekStart, current) / 7);
  const storedWeekSucceeded =
    qualifyingCount(state.daysLoggedThisWeek, exercise) >=
    targets.weeklyDayTarget;

  const successStreak = storedWeekSucceeded ? state.currentStreakWeeks + 1 : 0;
  const milestonesHit =
    storedWeekSucceeded && STREAK_MILESTONES.includes(successStreak)
      ? [successStreak]
      : [];

  const currentStreakWeeks = weeksPassed > 1 ? 0 : successStreak;
  const bestStreakWeeks = Math.max(state.bestStreakWeeks, successStreak);

  // Level up the daily goal only on a completed week (never mid-week).
  const newRepGoal =
    storedWeekSucceeded && exercise.progression === "weekly-step"
      ? targets.repGoal + targets.weeklyIncrement
      : targets.repGoal;

  return {
    state: {
      ...state,
      weekStart: current,
      daysLoggedThisWeek: emptyWeek(),
      currentStreakWeeks,
      bestStreakWeeks,
    },
    milestonesHit,
    newRepGoal,
  };
}

/** Read-only current streak, without mutating (safe in server components). */
export function displayStreak(
  state: ExerciseState,
  exercise: Exercise,
  targets: Targets,
  now: Date,
): number {
  return rollWeeks(state, exercise, targets, now).state.currentStreakWeeks;
}

export type LogEvents = {
  logDay: boolean;
  repGoal: boolean;
  pr: boolean;
  weekly: boolean;
};

/**
 * Apply a single logged set to (already week-rolled) state. Returns the
 * updated state, which one-time XP triggers fired, and the XP awarded.
 * `repsTodayTotal` is the day's cumulative reps *including* this set.
 */
export function applyLog(args: {
  state: ExerciseState;
  exercise: Exercise;
  targets: Targets;
  reps: number;
  weight: number | null;
  now: Date;
  repsTodayTotal: number;
}): { state: ExerciseState; events: LogEvents; xp: number } {
  const { exercise, targets, reps, weight, now, repsTodayTotal } = args;
  const state: ExerciseState = {
    ...args.state,
    daysLoggedThisWeek: [...(args.state.daysLoggedThisWeek ?? emptyWeek())],
  };
  const today = dayKey(now);
  const weekStart = state.weekStart ?? mondayOf(now);
  const idx = Math.min(6, Math.max(0, daysBetween(weekStart, today)));

  const events: LogEvents = {
    logDay: false,
    repGoal: false,
    pr: false,
    weekly: false,
  };
  let xp = 0;

  state.lifetimeReps += reps;
  state.bestSetReps = Math.max(state.bestSetReps ?? 0, reps);
  if (exercise.type === "weighted" && weight != null) {
    state.bestSetWeight = Math.max(state.bestSetWeight ?? 0, weight);
  }

  const met = goalMet(exercise, targets.repGoal, reps, repsTodayTotal);
  const quality = met ? 2 : 1;
  // Record the day at the highest level reached so far (can rise to 2 later).
  state.daysLoggedThisWeek![idx] = Math.max(
    state.daysLoggedThisWeek![idx] ?? 0,
    quality,
  );

  // +20 first log of the day.
  if (state.lastLoggedDay !== today) {
    events.logDay = true;
    xp += XP.logDay;
    state.lastLoggedDay = today;
  }

  // +30 daily rep goal.
  if (met && state.repGoalDay !== today) {
    events.repGoal = true;
    xp += XP.repGoal;
    state.repGoalDay = today;
  }

  // +50 rep + weight PR (weighted only).
  if (exercise.type === "weighted" && targets.weightGoal != null) {
    const prHit = reps >= targets.repGoal && (weight ?? 0) >= targets.weightGoal;
    if (prHit && state.prDay !== today) {
      events.pr = true;
      xp += XP.prGoal;
      state.prDay = today;
    }
  }

  // +100 weekly consistency goal (once per week).
  if (
    qualifyingCount(state.daysLoggedThisWeek, exercise) >=
      targets.weeklyDayTarget &&
    state.weeklyGoalHitWeek !== weekStart
  ) {
    events.weekly = true;
    xp += XP.weeklyGoal;
    state.weeklyGoalHitWeek = weekStart;
  }

  return { state, events, xp };
}

/* --------------------------------- Trophies ------------------------------- */

export type TrophyCategory =
  | "Consistency"
  | "Push-ups"
  | "Bench"
  | "Progression";

export type Trophy = {
  id: string;
  category: TrophyCategory;
  label: string;
  desc: string;
  comingSoon?: boolean;
};

export const TROPHIES: Trophy[] = [
  { id: "first-rep", category: "Consistency", label: "First Rep", desc: "Log your first session." },
  { id: "week-one", category: "Consistency", label: "Week One", desc: "Hit any weekly goal for the first time." },
  { id: "iron-streak", category: "Consistency", label: "Iron Streak", desc: "Reach a 4-week streak on any exercise." },
  { id: "unbreakable", category: "Consistency", label: "Unbreakable", desc: "Reach a 12-week streak." },
  { id: "perfect-week", category: "Consistency", label: "Perfect Week", desc: "Log all 7 days of a week on any exercise." },
  { id: "century-club", category: "Push-ups", label: "Century Club", desc: "100 push-ups in a day." },
  { id: "pushups-500", category: "Push-ups", label: "500 Club", desc: "500 lifetime push-ups." },
  { id: "pushups-1000", category: "Push-ups", label: "1000 Club", desc: "1000 lifetime push-ups." },
  { id: "bench-bodyweight", category: "Bench", label: "Bodyweight Bench", desc: "Bench at or above your bodyweight." },
  { id: "bench-135", category: "Bench", label: "One Plate", desc: "Bench 135 lb for a rep." },
  { id: "bench-225", category: "Bench", label: "Two Plates", desc: "Bench 225 lb for a rep." },
  { id: "bench-315", category: "Bench", label: "Three Plates", desc: "Bench 315 lb for a rep." },
  { id: "pr-machine", category: "Bench", label: "PR Machine", desc: "Set 5 personal records.", comingSoon: true },
  { id: "tier-prospect", category: "Progression", label: "Prospect", desc: "Reach the Prospect tier." },
  { id: "tier-contender", category: "Progression", label: "Contender", desc: "Reach the Contender tier." },
  { id: "tier-beast", category: "Progression", label: "Beast", desc: "Reach the Beast tier." },
  { id: "tier-elite", category: "Progression", label: "Elite", desc: "Reach the Elite tier." },
];

const anyState = (
  states: { exercise: Exercise; state: ExerciseState }[],
  pred: (s: ExerciseState, e: Exercise) => boolean,
): boolean => states.some(({ state, exercise }) => pred(state, exercise));

const forSlug = (
  states: { exercise: Exercise; state: ExerciseState }[],
  slug: string,
): ExerciseState | undefined =>
  states.find((s) => s.exercise.slug === slug)?.state;

export function earnedTrophies(ctx: {
  states: { exercise: Exercise; state: ExerciseState }[];
  xp: number;
  playerWeight: number | null;
  today?: { slug: string; repsToday: number } | null;
}): string[] {
  const { states, xp, playerWeight, today } = ctx;
  const level = levelForXp(xp);
  const pushups = forSlug(states, "pushups");
  const bench = forSlug(states, "bench");
  const earned = new Set<string>();
  const add = (id: string, cond: boolean) => {
    if (cond) earned.add(id);
  };

  add("first-rep", anyState(states, (s) => s.lifetimeReps > 0));
  add(
    "week-one",
    anyState(states, (s) => s.currentStreakWeeks >= 1 || s.bestStreakWeeks >= 1),
  );
  add("iron-streak", anyState(states, (s) => s.bestStreakWeeks >= 4));
  add("unbreakable", anyState(states, (s) => s.bestStreakWeeks >= 12));
  add("perfect-week", anyState(states, (s) => loggedCount(s.daysLoggedThisWeek) >= 7));

  add("century-club", today?.slug === "pushups" && (today?.repsToday ?? 0) >= 100);
  add("pushups-500", (pushups?.lifetimeReps ?? 0) >= 500);
  add("pushups-1000", (pushups?.lifetimeReps ?? 0) >= 1000);

  const benchBest = bench?.bestSetWeight ?? 0;
  add("bench-bodyweight", playerWeight != null && benchBest >= playerWeight && benchBest > 0);
  add("bench-135", benchBest >= 135);
  add("bench-225", benchBest >= 225);
  add("bench-315", benchBest >= 315);

  add("tier-prospect", level >= 5);
  add("tier-contender", level >= 10);
  add("tier-beast", level >= 15);
  add("tier-elite", level >= 20);

  return [...earned];
}
