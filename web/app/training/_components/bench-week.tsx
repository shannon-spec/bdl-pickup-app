"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Dumbbell, Loader2, TrendingUp } from "lucide-react";
import { logSet, setBenchPlan } from "@/lib/actions/training";
import type { PlanSet } from "@/lib/training/catalog";

/** Plan-based exercise control: the weekly confirm/adjust prompt (at week
 *  start) gates a one-tap "mark done". Shared by the Train card and Log. */
export function BenchWeek({
  slug,
  plan,
  needsWeekConfirm,
  suggestedSets,
}: {
  slug: string;
  plan: PlanSet[] | null;
  needsWeekConfirm: boolean;
  suggestedSets: PlanSet[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<string[]>(() =>
    suggestedSets.map((s) => String(s.weight)),
  );

  const cta =
    "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--r-lg)] bg-[color:var(--brand)] px-4 text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-[var(--cta-shadow)] hover:bg-[color:var(--brand-hover)] disabled:opacity-60";

  if (!plan || plan.length === 0) {
    return (
      <Link href="/training/cart" className={cta}>
        <Dumbbell size={14} strokeWidth={2.5} /> Set up your plan
      </Link>
    );
  }

  if (needsWeekConfirm) {
    const confirm = () => {
      setError(null);
      const sets = suggestedSets.map((s, i) => ({
        weight: Math.floor(Number(weights[i])) || 0,
        reps: s.reps,
      }));
      start(async () => {
        const res = await setBenchPlan({ slug, sets });
        if (res.ok) router.refresh();
        else setError(res.error);
      });
    };
    return (
      <div className="flex flex-col gap-2 rounded-[12px] bg-[color:var(--brand-soft)] p-3">
        <div className="text-[12px] font-bold text-[color:var(--brand-ink)]">
          Confirm this week&apos;s weights
        </div>
        <div className="flex flex-col gap-1.5">
          {suggestedSets.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="w-11 text-[color:var(--text-3)]">Set {i + 1}</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={weights[i] ?? ""}
                onChange={(e) =>
                  setWeights((prev) =>
                    prev.map((w, idx) => (idx === i ? e.target.value : w)),
                  )
                }
                className="h-9 w-20 rounded-[8px] bg-[color:var(--surface)] px-2 text-center text-[14px] font-bold num font-[family-name:var(--mono)] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[color:var(--text-4)] num">
                lb × {s.reps}
              </span>
            </div>
          ))}
        </div>
        {error && (
          <div className="text-[12px] text-[color:var(--down)]">{error}</div>
        )}
        <button type="button" onClick={confirm} disabled={pending} className={cta}>
          {pending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <TrendingUp size={14} strokeWidth={2.5} />
          )}
          Confirm week
        </button>
      </div>
    );
  }

  const markDone = () => {
    setError(null);
    start(async () => {
      const res = await logSet({ slug });
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={markDone}
        disabled={pending}
        className={cta}
      >
        {pending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Check size={15} strokeWidth={2.5} />
        )}
        Mark bench done
      </button>
      {error && (
        <div className="text-[12px] text-[color:var(--down)]">{error}</div>
      )}
    </div>
  );
}
