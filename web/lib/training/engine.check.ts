/**
 * Engine self-check — run with `npx tsx lib/training/engine.check.ts`.
 * Standalone assertions (the repo has no unit-test runner). Exits non-zero
 * on the first failure.
 */

import assert from "node:assert/strict";
import {
  levelForXp,
  levelProgress,
  tierForXp,
  addDays,
  daysBetween,
  mondayOf,
  dayKey,
  initialState,
  rollWeeks,
  applyLog,
  displayStreak,
  earnedTrophies,
  qualifyingCount,
  type ExerciseState,
  type Targets,
} from "./engine";
import { exerciseBySlug, type Exercise } from "./catalog";

const pushups = exerciseBySlug("pushups")!;
const bench = exerciseBySlug("bench")!;

const PUSH: Targets = {
  repGoal: 50,
  weightGoal: null,
  weeklyDayTarget: 5,
  weeklyIncrement: 10,
};
const BENCH: Targets = {
  repGoal: 5,
  weightGoal: 185,
  weeklyDayTarget: 3,
  weeklyIncrement: 0,
};

/* ------------------------------- levels/tiers ----------------------------- */
assert.equal(levelForXp(0), 1);
assert.equal(levelForXp(2000), 5);
assert.equal(levelForXp(4500), 10);
assert.equal(tierForXp(2000).key, "prospect");
assert.equal(tierForXp(9500).key, "elite");
const lp = levelProgress(750);
assert.equal(lp.level, 2);
assert.equal(lp.into, 250);
assert.equal(lp.pct, 50);

/* ---------------------------------- dates --------------------------------- */
assert.equal(addDays("2026-07-13", 7), "2026-07-20");
assert.equal(daysBetween("2026-07-13", "2026-07-20"), 7);
assert.equal(addDays("2026-02-28", 1), "2026-03-01");
const mon = mondayOf(new Date("2026-07-15T15:00:00Z"));
const monWd = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
}).format(new Date(`${mon}T17:00:00Z`));
assert.equal(monWd, "Mon");

/* ------------------------------ qualifyingCount --------------------------- */
// Push-ups: only goal-met days (level 2) count.
assert.equal(qualifyingCount([2, 2, 1, 1, 0, 0, 0], pushups), 2);
// Bench: any logged day (level ≥ 1) counts.
assert.equal(qualifyingCount([2, 2, 1, 1, 0, 0, 0], bench), 4);

/* -------------------------------- rollWeeks ------------------------------- */
const now = new Date("2026-07-15T15:00:00Z");
const curMon = mondayOf(now);
const prevMon = addDays(curMon, -7);
const base = (over: Partial<ExerciseState>): ExerciseState => ({
  ...initialState(now),
  ...over,
});

// Push-ups: completed week (5 goal-met days) → streak++, milestone, goal steps up
{
  const s = base({
    weekStart: prevMon,
    daysLoggedThisWeek: [2, 2, 2, 2, 2, 0, 0],
    currentStreakWeeks: 3,
    bestStreakWeeks: 3,
  });
  const r = rollWeeks(s, pushups, PUSH, now);
  assert.equal(r.state.currentStreakWeeks, 4);
  assert.deepEqual(r.milestonesHit, [4]);
  assert.equal(r.newRepGoal, 60); // 50 + 10 step-up
}

// Push-ups: logged but never hit the goal → week NOT complete, no step, streak resets
{
  const s = base({
    weekStart: prevMon,
    daysLoggedThisWeek: [1, 1, 1, 1, 1, 0, 0], // 5 logged, 0 goal-met
    currentStreakWeeks: 2,
  });
  const r = rollWeeks(s, pushups, PUSH, now);
  assert.equal(r.state.currentStreakWeeks, 0);
  assert.equal(r.newRepGoal, 50); // no level-up
}

// Push-ups: two-week gap breaks streak but the completed week still stepped the goal
{
  const s = base({
    weekStart: addDays(curMon, -14),
    daysLoggedThisWeek: [2, 2, 2, 2, 2, 0, 0],
    currentStreakWeeks: 3,
    bestStreakWeeks: 3,
  });
  const r = rollWeeks(s, pushups, PUSH, now);
  assert.equal(r.state.currentStreakWeeks, 0);
  assert.equal(r.state.bestStreakWeeks, 4);
  assert.deepEqual(r.milestonesHit, [4]);
  assert.equal(r.newRepGoal, 60);
}

// Bench: 3 logged days completes the week; progression "none" → goal unchanged
{
  const s = base({
    weekStart: prevMon,
    daysLoggedThisWeek: [1, 1, 1, 0, 0, 0, 0],
    currentStreakWeeks: 0,
  });
  const r = rollWeeks(s, bench, BENCH, now);
  assert.equal(r.state.currentStreakWeeks, 1);
  assert.equal(r.newRepGoal, 5);
}

/* --------------------------------- applyLog ------------------------------- */
const today = dayKey(now);

// Push-ups cumulative: first log under goal = +20 + level-1 day; crossing goal = +30 + level-2
{
  const start = base({ weekStart: today, daysLoggedThisWeek: [0, 0, 0, 0, 0, 0, 0] });
  const a = applyLog({
    state: start,
    exercise: pushups,
    targets: PUSH,
    day: today,
    reps: 30,
    weight: null,
    repsTodayTotal: 30,
    firstLogToday: true,
    priorGoalMet: false,
    priorPr: false,
  });
  assert.equal(a.xp, 20);
  assert.equal(a.events.repGoal, false);
  assert.equal(a.state.daysLoggedThisWeek![0], 1); // logged, under goal

  const b = applyLog({
    state: a.state,
    exercise: pushups,
    targets: PUSH,
    day: today,
    reps: 25,
    weight: null,
    repsTodayTotal: 55, // cumulative crosses 50
    firstLogToday: false,
    priorGoalMet: false,
    priorPr: false,
  });
  assert.equal(b.xp, 30);
  assert.equal(b.events.repGoal, true);
  assert.equal(b.state.daysLoggedThisWeek![0], 2); // day upgraded to goal-met
}

// Back-dated set to a day already at goal → no duplicate XP
{
  const start = base({ weekStart: today, daysLoggedThisWeek: [2, 0, 0, 0, 0, 0, 0] });
  const r = applyLog({
    state: start,
    exercise: pushups,
    targets: PUSH,
    day: today,
    reps: 20,
    weight: null,
    repsTodayTotal: 70,
    firstLogToday: false,
    priorGoalMet: true,
    priorPr: false,
  });
  assert.equal(r.xp, 0);
  assert.equal(r.events.logDay, false);
  assert.equal(r.events.repGoal, false);
}

// Push-ups weekly bonus on the 5th goal-met day
{
  const start = base({
    weekStart: addDays(today, -4), // today = idx 4
    daysLoggedThisWeek: [2, 2, 2, 2, 0, 0, 0], // 4 goal-met days
  });
  const r = applyLog({
    state: start,
    exercise: pushups,
    targets: PUSH,
    day: today,
    reps: 50,
    weight: null,
    repsTodayTotal: 50, // meets goal
    firstLogToday: true,
    priorGoalMet: false,
    priorPr: false,
  });
  assert.equal(r.events.logDay, true);
  assert.equal(r.events.repGoal, true);
  assert.equal(r.events.weekly, true);
  assert.equal(r.xp, 20 + 30 + 100);
}

// Bench PR
{
  const start = base({ weekStart: today });
  const pr = applyLog({
    state: start,
    exercise: bench,
    targets: BENCH,
    day: today,
    reps: 5,
    weight: 185,
    repsTodayTotal: 5,
    firstLogToday: true,
    priorGoalMet: false,
    priorPr: false,
  });
  assert.equal(pr.events.pr, true);
  assert.equal(pr.xp, 20 + 30 + 50);
}

// Daily Shots: no rep goal — logging awards +20 only; day is "logged"
{
  const shots = exerciseBySlug("shots")!;
  const SHOTS: Targets = {
    repGoal: 1,
    weightGoal: null,
    weeklyDayTarget: 3,
    weeklyIncrement: 0,
  };
  const a = applyLog({
    state: base({ weekStart: today, daysLoggedThisWeek: [0, 0, 0, 0, 0, 0, 0] }),
    exercise: shots,
    targets: SHOTS,
    day: today,
    reps: 40,
    weight: null,
    repsTodayTotal: 40,
    firstLogToday: true,
    priorGoalMet: false,
    priorPr: false,
  });
  assert.equal(a.xp, 20);
  assert.equal(a.events.repGoal, false);
  assert.equal(a.state.daysLoggedThisWeek![0], 1); // logged, never goal-met

  // 3 logged days completes the week under the "logged" qualifier
  const r = applyLog({
    state: base({
      weekStart: addDays(today, -2),
      daysLoggedThisWeek: [1, 1, 0, 0, 0, 0, 0],
    }),
    exercise: shots,
    targets: SHOTS,
    day: today,
    reps: 25,
    weight: null,
    repsTodayTotal: 25,
    firstLogToday: true,
    priorGoalMet: false,
    priorPr: false,
  });
  assert.equal(r.events.weekly, true);
  assert.equal(r.xp, 20 + 100);
}

/* ------------------------------- displayStreak ---------------------------- */
{
  const s = base({
    weekStart: prevMon,
    daysLoggedThisWeek: [2, 2, 2, 2, 2, 0, 0],
    currentStreakWeeks: 1,
  });
  assert.equal(displayStreak(s, pushups, PUSH, now), 2);
}

/* -------------------------------- trophies -------------------------------- */
{
  const states: { exercise: Exercise; state: ExerciseState }[] = [
    { exercise: pushups, state: base({ lifetimeReps: 500 }) },
    { exercise: bench, state: base({ bestSetWeight: 225 }) },
  ];
  const earned = earnedTrophies({
    states,
    xp: 4500,
    playerWeight: 200,
    today: { slug: "pushups", repsToday: 100 },
  });
  for (const id of [
    "first-rep",
    "pushups-500",
    "century-club",
    "bench-225",
    "bench-bodyweight",
    "tier-contender",
  ]) {
    assert.ok(earned.includes(id), `expected trophy ${id}`);
  }
  assert.ok(!earned.includes("bench-315"));
  assert.ok(!earned.includes("tier-beast"));
}

console.log("training engine self-check: ALL PASSED");
