/**
 * Training exercise catalog.
 *
 * Exercises are code-defined (the gamified framework is exercise-agnostic;
 * only the two below ship at v0.1). Slugs are stored as plain text on the
 * training tables so adding squat / pull-ups / deadlift later needs no
 * migration — just a new entry here.
 */

export type ExerciseType = "bodyweight" | "weighted";

/** How the daily rep goal is measured. */
export type RepCounting = "cumulative" | "single-set";

export type Exercise = {
  slug: string;
  name: string;
  type: ExerciseType;
  /** Days within a Mon–Sun week that must be logged for a "successful" week. */
  weeklyDayTarget: number;
  /** Default daily rep goal (reps that count as "goal hit"). */
  defaultRepGoal: number;
  /** Default weight goal (lb) paired with the rep goal for the PR goal;
   *  null for bodyweight exercises. */
  defaultWeightGoal: number | null;
  /** Push-ups sum reps across the day; bench uses a single set. */
  repCounting: RepCounting;
};

export const EXERCISES: Exercise[] = [
  {
    slug: "pushups",
    name: "Push-ups",
    type: "bodyweight",
    weeklyDayTarget: 5,
    defaultRepGoal: 50,
    defaultWeightGoal: null,
    repCounting: "cumulative",
  },
  {
    slug: "bench",
    name: "Bench Press",
    type: "weighted",
    weeklyDayTarget: 3,
    defaultRepGoal: 5,
    defaultWeightGoal: 185,
    repCounting: "single-set",
  },
];

export function exerciseBySlug(slug: string): Exercise | undefined {
  return EXERCISES.find((e) => e.slug === slug);
}
