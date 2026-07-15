/**
 * Training engine — pure, DB-free game logic.
 *
 * All XP / level / tier / streak / trophy math lives here so it can be
 * unit-checked in isolation (see engine.check.ts). Server actions load
 * rows, call these functions, and persist the results.
 *
 * Dates are handled as `YYYY-MM-DD` strings (matching Drizzle's `date`
 * columns) computed in a fixed timezone so day/week boundaries are stable
 * for the (US) user base. The week is a fixed Mon–Sun window.
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

/** `YYYY-MM-DD` for a Date in the training timezone (en-CA → ISO order). */
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

/** Add `n` days to a `YYYY-MM-DD` key (DST-safe via UTC noon). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b − a). Both `YYYY-MM-DD`. */
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
  const daysSinceMon = (WD[wdName] + 6) % 7; // Mon→0 … Sun→6
  return addDays(dayKey(d, tz), -daysSinceMon);
}

/* --------------------------------- Levels --------------------------------- */

/** Level N is reached at cumulative XP `XP_PER_LEVEL × (N−1)`. */
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
  /** CSS custom-property reference for the tier's identity color. */
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
    perk: "Custom goal setting and weekly challenges (coming soon).",
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

/** In-memory mirror of the mutable columns on `training_user_exercise`. */
export type ExerciseState = {
  weekStart: string | null;
  daysLoggedThisWeek: number[] | null; // 7 flags, index 0 = Monday
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

const daysCount = (flags: number[] | null): number =>
  (flags ?? []).reduce((n, f) => n + (f ? 1 : 0), 0);

/** Fresh state for a newly-added exercise, anchored to the current week. */
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
 * Advance state to the current week, resolving any elapsed week(s).
 * The stored week succeeds when its logged-day count met the target;
 * a success bumps the streak (and may hit a milestone), a miss/gap
 * resets it. Returns the number of milestone streak-lengths reached
 * (each worth `XP.streakMilestone`).
 */
export function rollWeeks(
  state: ExerciseState,
  exercise: Exercise,
  now: Date,
): { state: ExerciseState; milestonesHit: number[] } {
  const current = mondayOf(now);

  if (!state.weekStart) {
    return {
      state: { ...state, weekStart: current, daysLoggedThisWeek: emptyWeek() },
      milestonesHit: [],
    };
  }
  if (state.weekStart === current) {
    // Same week — just make sure the flag array exists.
    return {
      state: {
        ...state,
        daysLoggedThisWeek: state.daysLoggedThisWeek ?? emptyWeek(),
      },
      milestonesHit: [],
    };
  }

  const weeksPassed = Math.round(daysBetween(state.weekStart, current) / 7);
  const storedWeekSucceeded =
    daysCount(state.daysLoggedThisWeek) >= exercise.weeklyDayTarget;

  const successStreak = storedWeekSucceeded ? state.currentStreakWeeks + 1 : 0;
  const milestonesHit =
    storedWeekSucceeded && STREAK_MILESTONES.includes(successStreak)
      ? [successStreak]
      : [];

  // A fully-missed week between the stored week and now breaks the streak.
  const currentStreakWeeks = weeksPassed > 1 ? 0 : successStreak;
  const bestStreakWeeks = Math.max(state.bestStreakWeeks, successStreak);

  return {
    state: {
      ...state,
      weekStart: current,
      daysLoggedThisWeek: emptyWeek(),
      currentStreakWeeks,
      bestStreakWeeks,
    },
    milestonesHit,
  };
}

/** Read-only current streak accounting for time since the last log,
 *  without mutating anything (safe to call from server components). */
export function displayStreak(
  state: ExerciseState,
  exercise: Exercise,
  now: Date,
): number {
  const { state: rolled } = rollWeeks(state, exercise, now);
  return rolled.currentStreakWeeks;
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
 * `repsTodayTotal` is the day's cumulative reps *including* this set —
 * used for cumulative rep-goal exercises (push-ups).
 */
export function applyLog(args: {
  state: ExerciseState;
  exercise: Exercise;
  /** The player's goals for this exercise (from training_user_exercise). */
  repGoal: number;
  weightGoal: number | null;
  reps: number;
  weight: number | null;
  now: Date;
  repsTodayTotal: number;
}): { state: ExerciseState; events: LogEvents; xp: number } {
  const { exercise, repGoal, weightGoal, reps, weight, now, repsTodayTotal } =
    args;
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

  // Lifetime + best-set tracking.
  state.lifetimeReps += reps;
  state.bestSetReps = Math.max(state.bestSetReps ?? 0, reps);
  if (exercise.type === "weighted" && weight != null) {
    state.bestSetWeight = Math.max(state.bestSetWeight ?? 0, weight);
  }

  // +20 first log of the day.
  if (state.lastLoggedDay !== today) {
    events.logDay = true;
    xp += XP.logDay;
    state.lastLoggedDay = today;
    state.daysLoggedThisWeek![idx] = 1;
  }

  // +30 daily rep goal.
  const repGoalHit =
    exercise.repCounting === "cumulative"
      ? repsTodayTotal >= repGoal
      : reps >= repGoal;
  if (repGoalHit && state.repGoalDay !== today) {
    events.repGoal = true;
    xp += XP.repGoal;
    state.repGoalDay = today;
  }

  // +50 rep + weight PR (weighted only).
  if (exercise.type === "weighted" && weightGoal != null) {
    const prHit = reps >= repGoal && (weight ?? 0) >= weightGoal;
    if (prHit && state.prDay !== today) {
      events.pr = true;
      xp += XP.prGoal;
      state.prDay = today;
    }
  }

  // +100 weekly consistency goal (once per week).
  if (
    daysCount(state.daysLoggedThisWeek) >= exercise.weeklyDayTarget &&
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
  /** Not evaluated at v0.1 (needs data we don't yet track). Shows locked. */
  comingSoon?: boolean;
};

export const TROPHIES: Trophy[] = [
  // Consistency
  { id: "first-rep", category: "Consistency", label: "First Rep", desc: "Log your first session." },
  { id: "week-one", category: "Consistency", label: "Week One", desc: "Hit any weekly goal for the first time." },
  { id: "iron-streak", category: "Consistency", label: "Iron Streak", desc: "Reach a 4-week streak on any exercise." },
  { id: "unbreakable", category: "Consistency", label: "Unbreakable", desc: "Reach a 12-week streak." },
  { id: "perfect-week", category: "Consistency", label: "Perfect Week", desc: "Log all 7 days of a week on any exercise." },
  // Push-ups
  { id: "century-club", category: "Push-ups", label: "Century Club", desc: "100 push-ups in a day." },
  { id: "pushups-500", category: "Push-ups", label: "500 Club", desc: "500 lifetime push-ups." },
  { id: "pushups-1000", category: "Push-ups", label: "1000 Club", desc: "1000 lifetime push-ups." },
  // Bench
  { id: "bench-bodyweight", category: "Bench", label: "Bodyweight Bench", desc: "Bench at or above your bodyweight." },
  { id: "bench-135", category: "Bench", label: "One Plate", desc: "Bench 135 lb for a rep." },
  { id: "bench-225", category: "Bench", label: "Two Plates", desc: "Bench 225 lb for a rep." },
  { id: "bench-315", category: "Bench", label: "Three Plates", desc: "Bench 315 lb for a rep." },
  { id: "pr-machine", category: "Bench", label: "PR Machine", desc: "Set 5 personal records.", comingSoon: true },
  // Progression (tier)
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

/**
 * All trophy ids currently earned, computed from durable state (+ the
 * just-logged set for the day-scoped "Century Club"). Callers diff this
 * against already-unlocked ids to find newly-earned ones.
 */
export function earnedTrophies(ctx: {
  states: { exercise: Exercise; state: ExerciseState }[];
  xp: number;
  playerWeight: number | null;
  /** The set just logged this call, for day-scoped trophies. */
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

  // Consistency
  add("first-rep", anyState(states, (s) => s.lifetimeReps > 0));
  add(
    "week-one",
    anyState(states, (s) => s.currentStreakWeeks >= 1 || s.bestStreakWeeks >= 1),
  );
  add("iron-streak", anyState(states, (s) => s.bestStreakWeeks >= 4));
  add("unbreakable", anyState(states, (s) => s.bestStreakWeeks >= 12));
  add(
    "perfect-week",
    anyState(states, (s) => daysCount(s.daysLoggedThisWeek) >= 7),
  );

  // Push-ups
  add(
    "century-club",
    today?.slug === "pushups" && (today?.repsToday ?? 0) >= 100,
  );
  add("pushups-500", (pushups?.lifetimeReps ?? 0) >= 500);
  add("pushups-1000", (pushups?.lifetimeReps ?? 0) >= 1000);

  // Bench
  const benchBest = bench?.bestSetWeight ?? 0;
  add(
    "bench-bodyweight",
    playerWeight != null && benchBest >= playerWeight && benchBest > 0,
  );
  add("bench-135", benchBest >= 135);
  add("bench-225", benchBest >= 225);
  add("bench-315", benchBest >= 315);

  // Progression (tier)
  add("tier-prospect", level >= 5);
  add("tier-contender", level >= 10);
  add("tier-beast", level >= 15);
  add("tier-elite", level >= 20);

  return [...earned];
}

