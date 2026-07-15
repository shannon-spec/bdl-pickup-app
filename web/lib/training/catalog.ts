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

/** How the daily goal changes over time. */
export type Progression = "weekly-step" | "none";

/** What makes a day "count" toward the weekly day-target. */
export type WeekQualifier = "logged" | "goal-met";

/** Which values the player configures in the exercise's setup form. */
export type SetupField = "baseRepGoal" | "weeklyIncrement" | "weeklyDayTarget";

/** An optional second value captured on the log form (weight or makes). */
export type SecondaryMetric = {
  key: "weight" | "made";
  label: string;
  required: boolean;
  suffix?: string;
};

export type Exercise = {
  slug: string;
  name: string;
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
  defaultWeeklyDayTarget: number;
  defaultWeightGoal: number | null;
  /** Fields shown in this exercise's setup form (empty = no setup form). */
  setupFields: SetupField[];
};

export const EXERCISES: Exercise[] = [
  {
    slug: "pushups",
    name: "Push-ups",
    type: "bodyweight",
    repCounting: "cumulative",
    progression: "weekly-step",
    weekQualifier: "goal-met",
    hasRepGoal: true,
    repLabel: "Reps",
    defaultBaseRepGoal: 50,
    defaultWeeklyIncrement: 10,
    defaultWeeklyDayTarget: 5,
    defaultWeightGoal: null,
    setupFields: ["baseRepGoal", "weeklyIncrement", "weeklyDayTarget"],
  },
  {
    slug: "bench",
    name: "Bench Press",
    type: "weighted",
    repCounting: "single-set",
    progression: "none",
    weekQualifier: "logged",
    hasRepGoal: true,
    repLabel: "Reps",
    secondary: { key: "weight", label: "Weight", required: true, suffix: "lb" },
    defaultBaseRepGoal: 5,
    defaultWeeklyIncrement: 0,
    defaultWeeklyDayTarget: 3,
    defaultWeightGoal: 185,
    setupFields: [],
  },
  {
    slug: "shots",
    name: "Daily Shots",
    type: "skill",
    repCounting: "cumulative",
    progression: "none",
    weekQualifier: "logged",
    hasRepGoal: false,
    repLabel: "Shots",
    secondary: { key: "made", label: "Made", required: false },
    defaultBaseRepGoal: 1,
    defaultWeeklyIncrement: 0,
    defaultWeeklyDayTarget: 3,
    defaultWeightGoal: null,
    setupFields: ["weeklyDayTarget"],
  },
];

export function exerciseBySlug(slug: string): Exercise | undefined {
  return EXERCISES.find((e) => e.slug === slug);
}
