"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { addExercise, removeExercise } from "@/lib/actions/training";
import type { CartView } from "@/lib/queries/training";

const goalText = (
  type: "bodyweight" | "weighted",
  repGoal: number,
  weightGoal: number | null,
  weeklyDayTarget: number,
) =>
  `${repGoal} reps${type === "weighted" && weightGoal != null ? ` @ ${weightGoal} lb` : ""} · ${weeklyDayTarget} of 7 days`;

export function CartClient({ cart, addable }: CartView) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (slug: string, fn: typeof addExercise) => {
    setError(null);
    setBusy(slug);
    start(async () => {
      const res = await fn(slug);
      setBusy(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-2)]">
          Your program
        </h2>
        {cart.length === 0 ? (
          <p className="rounded-[12px] bg-[color:var(--surface)] p-4 text-[12.5px] text-[color:var(--text-3)] shadow-[inset_0_0_0_1px_var(--hairline-2)]">
            No exercises yet — add one below to start training.
          </p>
        ) : (
          cart.map((ex) => (
            <div
              key={ex.slug}
              className="flex items-center justify-between gap-3 rounded-[12px] bg-[color:var(--surface)] p-3.5 shadow-[inset_0_0_0_1px_var(--hairline)]"
            >
              <div>
                <div className="text-[14px] font-bold">{ex.name}</div>
                <div className="text-[11.5px] text-[color:var(--text-3)]">
                  {goalText(ex.type, ex.repGoal, ex.weightGoal, ex.weeklyDayTarget)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => run(ex.slug, removeExercise)}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-lg)] px-3 text-[12px] font-semibold text-[color:var(--text-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)] hover:text-[color:var(--down)] disabled:opacity-60"
              >
                {busy === ex.slug ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} strokeWidth={2.5} />
                )}
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {addable.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-2)]">
            Add an exercise
          </h2>
          {addable.map((ex) => (
            <div
              key={ex.slug}
              className="flex items-center justify-between gap-3 rounded-[12px] bg-[color:var(--surface)] p-3.5 shadow-[inset_0_0_0_1px_var(--hairline)]"
            >
              <div>
                <div className="text-[14px] font-bold">{ex.name}</div>
                <div className="text-[11.5px] text-[color:var(--text-3)]">
                  {goalText(
                    ex.type,
                    ex.defaultRepGoal,
                    ex.defaultWeightGoal,
                    ex.weeklyDayTarget,
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => run(ex.slug, addExercise)}
                disabled={pending}
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-lg)] bg-[color:var(--brand)] px-3.5 text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-[var(--cta-shadow)] hover:bg-[color:var(--brand-hover)] disabled:opacity-60"
              >
                {busy === ex.slug ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} strokeWidth={2.5} />
                )}
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-[var(--r-md)] bg-[color:var(--down-soft)] px-3 py-2 text-[12px] text-[color:var(--down)]">
          {error}
        </div>
      )}
    </div>
  );
}
