/**
 * Training exercise catalog.
 *
 * Exercises are code-defined and each declares its own setup, progression,
 * and log-form shape, so the framework is exercise-agnostic. Slugs are
 * stored as plain text on the training tables so new exercises need no
 * migration.
 */

export type ExerciseType = "bodyweight" | "weighted" | "skill";

/** How the daily rep goal is measured. */
export type RepCounting = "cumulative" | "single-set";

/** How the goal changes over time: step reps weekly, step weight weekly, or none. */
export type Progression = "weekly-step" | "weekly-weight-step" | "none";

/** What makes a day "count" toward the weekly day-target. */
export type WeekQualifier = "logged" | "goal-met";

/** Which values the player configures in the exercise's setup form. */
export type SetupField =
  | "baseRepGoal"
  | "weeklyIncrement"
  | "baseWeightGoal"
  | "weeklyWeightIncrement"
  | "weeklyDayTarget";

/** An optional second value captured on the log form (weight or makes). */
export type SecondaryMetric = {
  key: "weight" | "made";
  label: string;
  required: boolean;
  suffix?: string;
};

/** One prescribed set in a plan-based exercise (e.g. bench). Weight only —
 *  reps are entered when the session is logged. */
export type PlanSet = { weight: number };

/** Program groups, shown as sections in the cart / train views. */
export type TrainingGroupKey = "skills" | "strength";
export const TRAINING_GROUPS: { key: TrainingGroupKey; label: string }[] = [
  { key: "skills", label: "Skills" },
  { key: "strength", label: "Strength & Conditioning" },
];

export type Exercise = {
  slug: string;
  name: string;
  group: TrainingGroupKey;
  type: ExerciseType;
  repCounting: RepCounting;
  progression: Progression;
  weekQualifier: WeekQualifier;
  /** Whether the exercise has a daily rep goal (drives the +30 award and
   *  goal-met day tracking). Consistency-only exercises set this false. */
  hasRepGoal: boolean;
  /** Label for the primary count input on the log form. */
  repLabel: string;
  /** Optional second log-form input. */
  secondary?: SecondaryMetric;
  defaultBaseRepGoal: number;
  defaultWeeklyIncrement: number;
  /** Starting weight goal (weight-progression exercises); null otherwise. */
  defaultBaseWeightGoal: number | null;
  defaultWeeklyWeightIncrement: number;
  defaultWeeklyDayTarget: number;
  defaultWeightGoal: number | null;
  /** Fields shown in this exercise's setup form (empty = no setup form). */
  setupFields: SetupField[];
  /** Plan-based: setup is a per-set plan (weight+reps) with a weekly
   *  confirm/adjust step, and logging is a single "mark done". */
  usesPlan?: boolean;
};

export const EXERCISES: Exercise[] = [
  {
    slug: "pushups",
    name: "Push-ups",
    group: "strength",
    type: "bodyweight",
    repCounting: "cumulative",
    progression: "weekly-step",
    weekQualifier: "goal-met",
    hasRepGoal: true,
    repLabel: "Reps",
    defaultBaseRepGoal: 50,
    defaultWeeklyIncrement: 10,
    defaultBaseWeightGoal: null,
    defaultWeeklyWeightIncrement: 0,
    defaultWeeklyDayTarget: 5,
    defaultWeightGoal: null,
    setupFields: ["baseRepGoal", "weeklyIncrement", "weeklyDayTarget"],
  },
  {
    slug: "bench",
    name: "Bench Press",
    group: "strength",
    type: "weighted",
    repCounting: "single-set",
    progression: "none",
    weekQualifier: "logged",
    hasRepGoal: false,
    repLabel: "Reps",
    defaultBaseRepGoal: 5,
    defaultWeeklyIncrement: 0,
    defaultBaseWeightGoal: 185,
    defaultWeeklyWeightIncrement: 5,
    defaultWeeklyDayTarget: 3,
    defaultWeightGoal: 185,
    setupFields: [],
    usesPlan: true,
  },
  {
    slug: "squats",
    name: "Squats",
    group: "strength",
    type: "weighted",
    repCounting: "single-set",
    progression: "none",
    weekQualifier: "logged",
    hasRepGoal: false,
    repLabel: "Reps",
    defaultBaseRepGoal: 5,
    defaultWeeklyIncrement: 0,
    defaultBaseWeightGoal: 225,
    defaultWeeklyWeightIncrement: 10,
    defaultWeeklyDayTarget: 3,
    defaultWeightGoal: 225,
    setupFields: [],
    usesPlan: true,
  },
  {
    slug: "shots",
    name: "Daily 3-Pt Shots",
    group: "skills",
    type: "skill",
    repCounting: "cumulative",
    progression: "none",
    weekQualifier: "goal-met",
    hasRepGoal: true,
    repLabel: "Shots",
    secondary: { key: "made", label: "Made", required: false },
    defaultBaseRepGoal: 100,
    defaultWeeklyIncrement: 0,
    defaultBaseWeightGoal: null,
    defaultWeeklyWeightIncrement: 0,
    defaultWeeklyDayTarget: 3,
    defaultWeightGoal: null,
    setupFields: ["baseRepGoal", "weeklyDayTarget"],
  },
];

export function exerciseBySlug(slug: string): Exercise | undefined {
  return EXERCISES.find((e) => e.slug === slug);
}
