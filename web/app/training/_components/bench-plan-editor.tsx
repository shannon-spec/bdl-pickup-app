"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { setBenchPlan } from "@/lib/actions/training";
import type { PlanSet } from "@/lib/training/catalog";

/** Per-set plan builder — a weight per set, plus weekly increase and
 *  days-per-week. Reps are entered when the session is logged. Used for
 *  both the initial cart setup and the Edit panel. */
export function BenchPlanEditor({
  slug,
  initialSets,
  initialIncrement,
  initialDayTarget,
  ctaLabel,
  onDone,
}: {
  slug: string;
  initialSets: PlanSet[];
  initialIncrement: number;
  initialDayTarget: number;
  ctaLabel: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<string[]>(() =>
    initialSets.length ? initialSets.map((s) => String(s.weight)) : [""],
  );
  const [inc, setInc] = useState(String(initialIncrement));
  const [days, setDays] = useState(String(initialDayTarget));

  const setWeight = (i: number, v: string) =>
    setWeights((prev) => prev.map((w, idx) => (idx === i ? v : w)));
  const addSet = () =>
    setWeights((prev) => [...prev, prev[prev.length - 1] ?? ""]);
  const removeSet = (i: number) =>
    setWeights((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const save = () => {
    setError(null);
    const sets = weights.map((w) => ({ weight: Math.floor(Number(w)) }));
    if (sets.some((s) => !Number.isFinite(s.weight) || s.weight < 0)) {
      setError("Enter a weight for every set.");
      return;
    }
    start(async () => {
      const res = await setBenchPlan({
        slug,
        sets,
        weeklyWeightIncrement: Number(inc) || 0,
        weeklyDayTarget: Number(days) || 3,
      });
      if (res.ok) {
        onDone?.();
        router.refresh();
      } else setError(res.error);
    });
  };

  const cell =
    "h-10 w-24 rounded-[10px] bg-[color:var(--surface)] px-2 text-center text-[15px] font-bold num font-[family-name:var(--mono)] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div className="flex flex-col gap-3 rounded-[10px] bg-[color:var(--surface-2)] p-3">
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 text-[10px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-3)]">
          <span className="w-6" />
          <span className="w-24 text-center">Weight (lb)</span>
        </div>
        {weights.map((w, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 text-[11px] font-bold text-[color:var(--text-4)] num">
              {i + 1}
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={w}
              onChange={(e) => setWeight(i, e.target.value)}
              className={cell}
            />
            <button
              type="button"
              onClick={() => removeSet(i)}
              disabled={weights.length <= 1}
              aria-label="Remove set"
              className="grid h-8 w-8 place-items-center rounded-[8px] text-[color:var(--text-3)] hover:text-[color:var(--down)] disabled:opacity-40"
            >
              <Trash2 size={14} strokeWidth={2.5} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addSet}
          disabled={weights.length >= 10}
          className="inline-flex h-8 w-fit items-center gap-1.5 rounded-[var(--r-lg)] px-3 text-[12px] font-semibold text-[color:var(--text-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)] hover:text-[color:var(--text)] disabled:opacity-50"
        >
          <Plus size={13} strokeWidth={2.5} /> Add set
        </button>
        <p className="text-[11px] text-[color:var(--text-4)]">
          Enter the reps you did when you log each session.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-3)]">
            Weekly increase (lb)
          </span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={inc}
            onChange={(e) => setInc(e.target.value)}
            className={cell}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-3)]">
            Days / week
          </span>
          <input
            type="number"
            min={1}
            max={7}
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className={cell}
          />
        </label>
      </div>

      {error && (
        <div className="rounded-[var(--r-md)] bg-[color:var(--down-soft)] px-3 py-2 text-[12px] text-[color:var(--down)]">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-[var(--r-lg)] bg-[color:var(--brand)] px-4 text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-[var(--cta-shadow)] hover:bg-[color:var(--brand-hover)] disabled:opacity-60"
      >
        {pending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Check size={14} strokeWidth={2.5} />
        )}
        {ctaLabel}
      </button>
    </div>
  );
}
