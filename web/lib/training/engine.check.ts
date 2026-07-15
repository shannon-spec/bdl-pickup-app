/**
 * Engine self-check — run with `npx tsx lib/training/engine.check.ts`.
 *
 * The repo has no unit-test runner, so this is a standalone assertion
 * script (like scripts/verify-db.ts) that exercises the pure engine.
 * Exits non-zero on the first failed assertion.
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
  earnedTrophies,
  type ExerciseState,
} from "./engine";
import { exerciseBySlug, type Exercise } from "./catalog";

const pushups = exerciseBySlug("pushups")!;
const bench = exerciseBySlug("bench")!;

/* ------------------------------- levels/tiers ----------------------------- */
assert.equal(levelForXp(0), 1);
assert.equal(levelForXp(499), 1);
assert.equal(levelForXp(500), 2);
assert.equal(levelForXp(2000), 5); // Prospect entry
assert.equal(levelForXp(4500), 10); // Contender entry
assert.equal(levelForXp(7000), 15); // Beast entry
assert.equal(levelForXp(9500), 20); // Elite entry

assert.equal(tierForXp(0).key, "rookie");
assert.equal(tierForXp(2000).key, "prospect");
assert.equal(tierForXp(4500).key, "contender");
assert.equal(tierForXp(7000).key, "beast");
assert.equal(tierForXp(9500).key, "elite");

const lp = levelProgress(750);
assert.equal(lp.level, 2);
assert.equal(lp.into, 250);
assert.equal(lp.pct, 50);

/* ---------------------------------- dates --------------------------------- */
assert.equal(addDays("2026-07-13", 7), "2026-07-20");
assert.equal(daysBetween("2026-07-13", "2026-07-20"), 7);
assert.equal(addDays("2026-02-28", 1), "2026-03-01"); // 2026 not a leap year
assert.equal(addDays("2026-03-08", 1), "2026-03-09"); // US DST spring-forward day
// mondayOf always returns a Monday
const mon = mondayOf(new Date("2026-07-15T15:00:00Z"));
const monWd = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
}).format(new Date(`${mon}T17:00:00Z`));
assert.equal(monWd, "Mon");

/* -------------------------------- rollWeeks ------------------------------- */
const now = new Date("2026-07-15T15:00:00Z");
const curMon = mondayOf(now);
const prevMon = addDays(curMon, -7);

const base = (over: Partial<ExerciseState>): ExerciseState => ({
  ...initialState(now),
  ...over,
});

// Success last week → streak++ ; hitting 4 → milestone
{
  const s = base({
    weekStart: prevMon,
    daysLoggedThisWeek: [1, 1, 1, 1, 1, 0, 0], // 5 ≥ target 5
    currentStreakWeeks: 3,
    bestStreakWeeks: 3,
  });
  const { state, milestonesHit } = rollWeeks(s, pushups, now);
  assert.equal(state.currentStreakWeeks, 4);
  assert.equal(state.bestStreakWeeks, 4);
  assert.equal(state.weekStart, curMon);
  assert.deepEqual(state.daysLoggedThisWeek, [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(milestonesHit, [4]);
}

// Missed last week → streak resets to 0
{
  const s = base({
    weekStart: prevMon,
    daysLoggedThisWeek: [1, 1, 0, 0, 0, 0, 0], // 2 < 5
    currentStreakWeeks: 6,
    bestStreakWeeks: 6,
  });
  const { state, milestonesHit } = rollWeeks(s, pushups, now);
  assert.equal(state.currentStreakWeeks, 0);
  assert.equal(state.bestStreakWeeks, 6);
  assert.deepEqual(milestonesHit, []);
}

// Two-week gap breaks the streak even if the stored week succeeded
{
  const s = base({
    weekStart: addDays(curMon, -14),
    daysLoggedThisWeek: [1, 1, 1, 1, 1, 0, 0],
    currentStreakWeeks: 3,
    bestStreakWeeks: 3,
  });
  const { state, milestonesHit } = rollWeeks(s, pushups, now);
  assert.equal(state.currentStreakWeeks, 0); // gap broke it
  assert.equal(state.bestStreakWeeks, 4); // but the completed week counts toward best
  assert.deepEqual(milestonesHit, [4]); // milestone was reached
}

/* --------------------------------- applyLog ------------------------------- */
const today = dayKey(now);

// Push-ups: cumulative rep goal, first log = +20 only, goal on cumulative
{
  const start = base({
    weekStart: addDays(today, 0),
    daysLoggedThisWeek: [0, 0, 0, 0, 0, 0, 0],
  });
  const first = applyLog({
    state: start,
    exercise: pushups,
    repGoal: 50,
    weightGoal: null,
    reps: 30,
    weight: null,
    now,
    repsTodayTotal: 30,
  });
  assert.equal(first.xp, 20);
  assert.equal(first.events.logDay, true);
  assert.equal(first.events.repGoal, false);

  const second = applyLog({
    state: first.state,
    exercise: pushups,
    repGoal: 50,
    weightGoal: null,
    reps: 25,
    weight: null,
    now,
    repsTodayTotal: 55, // cumulative crosses 50
  });
  assert.equal(second.xp, 30); // rep goal only; day already logged
  assert.equal(second.events.logDay, false);
  assert.equal(second.events.repGoal, true);
  assert.equal(second.state.lifetimeReps, 55);
}

// Weekly bonus fires on the 5th logged day (once)
{
  const start = base({
    weekStart: addDays(today, -4), // makes today idx 4
    daysLoggedThisWeek: [1, 1, 1, 1, 0, 0, 0], // 4 days already
    lastLoggedDay: addDays(today, -1),
  });
  const r = applyLog({
    state: start,
    exercise: pushups,
    repGoal: 50,
    weightGoal: null,
    reps: 10,
    weight: null,
    now,
    repsTodayTotal: 10,
  });
  assert.equal(r.events.logDay, true);
  assert.equal(r.events.weekly, true);
  assert.equal(r.xp, 20 + 100); // log day + weekly
}

// Bench: single-set rep goal + PR
{
  const start = base({ weekStart: today });
  const pr = applyLog({
    state: start,
    exercise: bench,
    repGoal: 5,
    weightGoal: 185,
    reps: 5,
    weight: 185,
    now,
    repsTodayTotal: 5,
  });
  assert.equal(pr.events.logDay, true);
  assert.equal(pr.events.repGoal, true);
  assert.equal(pr.events.pr, true);
  assert.equal(pr.xp, 20 + 30 + 50);
  assert.equal(pr.state.bestSetWeight, 185);

  // Below the weight goal on another day: rep goal yes, PR no
  const lighter = applyLog({
    state: { ...pr.state, lastLoggedDay: null, repGoalDay: null, prDay: null },
    exercise: bench,
    repGoal: 5,
    weightGoal: 185,
    reps: 5,
    weight: 135,
    now,
    repsTodayTotal: 5,
  });
  assert.equal(lighter.events.pr, false);
  assert.equal(lighter.events.repGoal, true);
}

/* -------------------------------- trophies -------------------------------- */
{
  const states: { exercise: Exercise; state: ExerciseState }[] = [
    { exercise: pushups, state: base({ lifetimeReps: 500 }) },
    { exercise: bench, state: base({ bestSetWeight: 225, lifetimeReps: 20 }) },
  ];
  const earned = earnedTrophies({
    states,
    xp: 4500, // level 10 → Prospect + Contender
    playerWeight: 200,
    today: { slug: "pushups", repsToday: 100 },
  });
  for (const id of [
    "first-rep",
    "pushups-500",
    "century-club",
    "bench-135",
    "bench-225",
    "bench-bodyweight",
    "tier-prospect",
    "tier-contender",
  ]) {
    assert.ok(earned.includes(id), `expected trophy ${id}`);
  }
  assert.ok(!earned.includes("pushups-1000"), "1000 club not yet");
  assert.ok(!earned.includes("bench-315"), "315 not yet");
  assert.ok(!earned.includes("tier-beast"), "beast not yet");
  assert.ok(!earned.includes("pr-machine"), "pr-machine is coming-soon");
}

console.log("training engine self-check: ALL PASSED");
