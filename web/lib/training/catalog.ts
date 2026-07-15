/**
 * Training exercise catalog.
 *
 * Exercises are code-defined and each declares its own setup + progression
 * shape, so the framework is exercise-agnostic (push-ups progresses its
 * daily goal weekly; bench is flat for now; others drop in later with
 * their own rules). Slugs are stored as plain text on the training tables
 * so new exercises need no migration.
 */

export type ExerciseType = "bodyweight" | "weighted";

/** How the daily rep goal is measured. */
export type RepCounting = "cumulative" | "single-set";

/** How the daily goal changes over time. */
export type Progression = "weekly-step" | "none";

/** What makes a day "count" toward the weekly day-target. */
export type WeekQualifier = "logged" | "goal-met";

/** Which values the player configures in the exercise's setup form. */
export type SetupField = "baseRepGoal" | "weeklyIncrement" | "weeklyDayTarget";

export type Exercise = {
  slug: string;
  name: string;
  type: ExerciseType;
  repCounting: RepCounting;
  progression: Progression;
  weekQualifier: WeekQualifier;
  /** Default starting daily rep goal. */
  defaultBaseRepGoal: number;
  /** Default weekly step applied to the daily goal after a completed week. */
  defaultWeeklyIncrement: number;
  /** Default days within a Mon–Sun week required to complete it. */
  defaultWeeklyDayTarget: number;
  /** Default weight goal (lb) for the PR goal; null for bodyweight. */
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
    defaultBaseRepGoal: 5,
    defaultWeeklyIncrement: 0,
    defaultWeeklyDayTarget: 3,
    defaultWeightGoal: 185,
    setupFields: [],
  },
];

export function exerciseBySlug(slug: string): Exercise | undefined {
  return EXERCISES.find((e) => e.slug === slug);
}
