"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Dumbbell, Loader2, TrendingUp } from "lucide-react";
import { logSet, setBenchPlan } from "@/lib/actions/training";
import type { PlanSet } from "@/lib/training/catalog";

/** Plan-based exercise control: the weekly confirm/adjust prompt (at week
 *  start) gates the session log, where you enter the reps you did for each
 *  planned set. Shared by the Train card and Log. */
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
  const [confirmWeights, setConfirmWeights] = useState<string[]>(() =>
    suggestedSets.map((s) => String(s.weight)),
  );
  const [reps, setReps] = useState<string[]>(() => (plan ?? []).map(() => ""));

  const cta =
    "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--r-lg)] bg-[color:var(--brand)] px-4 text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-[var(--cta-shadow)] hover:bg-[color:var(--brand-hover)] disabled:opacity-60";
  const repInput =
    "h-9 w-16 rounded-[8px] bg-[color:var(--surface)] px-2 text-center text-[14px] font-bold num font-[family-name:var(--mono)] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";

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
      const sets = suggestedSets.map((_, i) => ({
        weight: Math.floor(Number(confirmWeights[i])) || 0,
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
          {suggestedSets.map((_, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="w-11 text-[color:var(--text-3)]">Set {i + 1}</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={confirmWeights[i] ?? ""}
                onChange={(e) =>
                  setConfirmWeights((prev) =>
                    prev.map((w, idx) => (idx === i ? e.target.value : w)),
                  )
                }
                className={repInput + " w-20"}
              />
              <span className="text-[color:var(--text-4)]">lb</span>
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
    const total = reps.reduce((n, r) => n + (Math.floor(Number(r)) || 0), 0);
    if (total <= 0) {
      setError("Enter the reps you did.");
      return;
    }
    start(async () => {
      const res = await logSet({ slug, reps: total });
      if (res.ok) {
        setReps(plan.map(() => ""));
        router.refresh();
      } else setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-[12px] bg-[color:var(--surface-2)] p-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-3)]">
        Reps you did today
      </div>
      <div className="flex flex-col gap-1.5">
        {plan.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="w-11 text-[color:var(--text-3)]">Set {i + 1}</span>
            <span className="w-16 num font-semibold text-[color:var(--text-2)]">
              {s.weight} lb
            </span>
            <span className="text-[color:var(--text-4)]">×</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="reps"
              value={reps[i] ?? ""}
              onChange={(e) =>
                setReps((prev) =>
                  prev.map((r, idx) => (idx === i ? e.target.value : r)),
                )
              }
              className={repInput}
            />
          </div>
        ))}
      </div>
      {error && (
        <div className="text-[12px] text-[color:var(--down)]">{error}</div>
      )}
      <button type="button" onClick={markDone} disabled={pending} className={cta}>
        {pending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Check size={15} strokeWidth={2.5} />
        )}
        Mark bench done
      </button>
    </div>
  );
}
