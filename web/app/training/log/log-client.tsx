"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, BarChart3, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { logSet, type LogResult } from "@/lib/actions/training";
import type { CartExercise } from "@/lib/queries/training";
import { mondayOfKey, TROPHIES } from "@/lib/training/engine";
import { ExerciseIcon } from "../_components/exercise-icon";
import { BenchWeek } from "../_components/bench-week";

const trophyLabel = (id: string) =>
  TROPHIES.find((t) => t.id === id)?.label ?? id;

export function LogClient({
  cart,
  initialSlug,
  today,
}: {
  cart: CartExercise[];
  initialSlug: string | null;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [slug, setSlug] = useState(initialSlug ?? cart[0]?.slug ?? "");
  const [reps, setReps] = useState("");
  const [secondaryVal, setSecondaryVal] = useState("");
  const [date, setDate] = useState(today);
  const isPastWeek = date < mondayOfKey(today);
  const [error, setError] = useState<string | null>(null);
  // `tick` re-mounts the celebration so the animation replays each save.
  const [result, setResult] = useState<{ r: LogResult; tick: number } | null>(
    null,
  );

  const exercise = useMemo(
    () => cart.find((c) => c.slug === slug) ?? cart[0],
    [cart, slug],
  );
  const weighted = exercise?.type === "weighted";
  const secondary = exercise?.secondary;

  const onSubmit = () => {
    setError(null);
    const repsN = Number(reps);
    if (!Number.isFinite(repsN) || repsN <= 0) {
      setError("Enter a value above zero.");
      return;
    }
    const hasSecVal = secondaryVal.trim() !== "";
    if (secondary?.required && (!hasSecVal || Number(secondaryVal) < 0)) {
      setError(`Enter the ${secondary.label.toLowerCase()}.`);
      return;
    }
    const secNum = hasSecVal ? Math.floor(Number(secondaryVal)) : null;
    start(async () => {
      const res = await logSet({
        slug: exercise.slug,
        reps: Math.floor(repsN),
        weight: secondary?.key === "weight" ? secNum : null,
        made: secondary?.key === "made" ? secNum : null,
        day: date,
      });
      if (res.ok) {
        setResult((prev) => ({ r: res.data, tick: (prev?.tick ?? 0) + 1 }));
        setReps("");
        setSecondaryVal("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  if (!exercise) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Exercise selector */}
      {cart.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {cart.map((c) => {
            const on = c.slug === exercise.slug;
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => setSlug(c.slug)}
                className={`inline-flex h-9 items-center rounded-full px-3.5 text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors ${
                  on
                    ? "bg-[color:var(--brand)] text-white shadow-[var(--cta-shadow)]"
                    : "bg-[color:var(--surface)] text-[color:var(--text-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)]"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-[16px] bg-[color:var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--hairline)]">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
              <ExerciseIcon slug={exercise.slug} size={16} />
            </span>
            <div className="text-[15px] font-bold">{exercise.name}</div>
          </div>
          <div className="text-[11.5px] text-[color:var(--text-3)]">
            {exercise.usesPlan ? (
              <>
                {exercise.plan?.length
                  ? `${exercise.plan.map((s) => s.weight).join(" · ")} lb`
                  : "No plan set"}{" "}
                · {exercise.weeklyDayTarget} of 7 days
              </>
            ) : exercise.hasRepGoal ? (
              <>
                Daily goal: {exercise.currentGoal}{" "}
                {exercise.repLabel.toLowerCase()}
                {weighted && exercise.weightGoal != null && (
                  <> · PR: {exercise.currentGoal} @ {exercise.weightGoal} lb</>
                )}
              </>
            ) : (
              <>{exercise.weeklyDayTarget} of 7 days</>
            )}
          </div>
        </div>

        {exercise.usesPlan ? (
          <BenchWeek
            slug={exercise.slug}
            plan={exercise.plan}
            needsWeekConfirm={exercise.needsWeekConfirm}
            suggestedSets={exercise.suggestedSets}
          />
        ) : (
          <>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-3)]">
              Date
            </span>
            <input
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-[10px] bg-[color:var(--surface-2)] px-3 text-[14px] num font-[family-name:var(--mono)] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-3)]">
              {exercise.repLabel}
            </span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="h-11 w-24 rounded-[10px] bg-[color:var(--surface-2)] px-3 text-center text-[16px] font-bold num font-[family-name:var(--mono)] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          </label>
          {secondary && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-3)]">
                {secondary.label}
                {secondary.suffix ? ` (${secondary.suffix})` : ""}
                {secondary.required ? "" : " · opt"}
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={secondaryVal}
                onChange={(e) => setSecondaryVal(e.target.value)}
                className="h-11 w-28 rounded-[10px] bg-[color:var(--surface-2)] px-3 text-center text-[16px] font-bold num font-[family-name:var(--mono)] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </label>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-[var(--r-lg)] bg-[color:var(--brand)] px-5 text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-[var(--cta-shadow)] hover:bg-[color:var(--brand-hover)] disabled:opacity-60"
          >
            {pending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <BarChart3 size={15} strokeWidth={2.5} />
            )}
            {pending ? "Saving…" : "Complete set"}
          </button>
        </div>

        {isPastWeek && (
          <div className="rounded-[var(--r-md)] bg-[color:var(--surface-2)] px-3 py-2 text-[11.5px] text-[color:var(--text-3)]">
            Past week — counts toward your totals and charts, but won&apos;t
            change your current streak or XP.
          </div>
        )}

        {error && (
          <div className="rounded-[var(--r-md)] bg-[color:var(--down-soft)] px-3 py-2 text-[12px] text-[color:var(--down)]">
            {error}
          </div>
        )}
          </>
        )}
      </div>

      {!exercise.usesPlan && result && (
        <Celebration key={result.tick} r={result.r} />
      )}
    </div>
  );
}

function Celebration({ r }: { r: LogResult }) {
  const nothing =
    r.totalXp === 0 &&
    r.newTrophies.length === 0 &&
    r.leveledTo == null &&
    r.goalRaised == null;
  if (nothing) {
    return (
      <div className="rounded-[16px] bg-[color:var(--surface-2)] px-4 py-3 text-[12.5px] text-[color:var(--text-2)]">
        Set logged — it counts toward your totals and charts.
      </div>
    );
  }

  const lines: string[] = [];
  if (r.events.logDay) lines.push(`Logged the day · +20 XP`);
  if (r.events.repGoal) lines.push(`Rep goal hit · +30 XP`);
  if (r.events.pr) lines.push(`New PR · +50 XP`);
  if (r.events.weekly) lines.push(`Weekly goal · +100 XP`);
  for (const m of r.milestonesHit) lines.push(`${m}-week streak! · +150 XP`);

  return (
    <div className="flex flex-col gap-2 rounded-[16px] bg-[color:var(--brand-soft)] p-4">
      <div className="flex items-center gap-2 text-[color:var(--brand-ink)]">
        <Sparkles size={18} strokeWidth={2.5} />
        <span className="text-[18px] font-extrabold num font-[family-name:var(--mono)]">
          +{r.totalXp} XP
        </span>
      </div>
      {lines.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-[12px] text-[color:var(--brand-ink)]">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      {r.leveledTo != null && (
        <div className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[color:var(--up)]">
          <TrendingUp size={15} strokeWidth={2.5} /> Level up — you reached level{" "}
          {r.leveledTo}!
        </div>
      )}
      {r.goalRaised != null && (
        <div className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[color:var(--brand-ink)]">
          <TrendingUp size={15} strokeWidth={2.5} /> Week complete — goal raised
          to {r.goalRaised.to} {r.goalRaised.unit}!
        </div>
      )}
      {r.newTrophies.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {r.newTrophies.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--surface)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--gold)] shadow-[inset_0_0_0_1px_var(--hairline)]"
            >
              <Award size={13} strokeWidth={2.5} /> {trophyLabel(id)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
