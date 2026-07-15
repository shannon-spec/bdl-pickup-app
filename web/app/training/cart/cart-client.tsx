"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  addExercise,
  removeExercise,
  startNewStreak,
  updateExerciseSetup,
} from "@/lib/actions/training";
import type {
  AddableExercise,
  CartExercise,
  CartView,
} from "@/lib/queries/training";
import type { SetupField } from "@/lib/training/catalog";

const FIELD_META: Record<
  SetupField,
  { label: string; suffix: string; min: number; max: number }
> = {
  baseRepGoal: { label: "Baseline daily goal", suffix: "reps", min: 1, max: 1000 },
  weeklyIncrement: { label: "Weekly increase", suffix: "reps/wk", min: 0, max: 500 },
  weeklyDayTarget: { label: "Days per week", suffix: "of 7", min: 1, max: 7 },
};

type Vals = Partial<Record<SetupField, string>>;
type PanelMode = "edit" | "restart";

const toPayload = (v: Vals) => ({
  baseRepGoal: v.baseRepGoal != null ? Number(v.baseRepGoal) : undefined,
  weeklyIncrement: v.weeklyIncrement != null ? Number(v.weeklyIncrement) : undefined,
  weeklyDayTarget: v.weeklyDayTarget != null ? Number(v.weeklyDayTarget) : undefined,
});

const valsFromCart = (c: CartExercise): Vals => ({
  baseRepGoal: String(c.baseRepGoal),
  weeklyIncrement: String(c.weeklyIncrement),
  weeklyDayTarget: String(c.weeklyDayTarget),
});

function SetupInputs({
  fields,
  vals,
  onChange,
}: {
  fields: SetupField[];
  vals: Vals;
  onChange: (f: SetupField, v: string) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {fields.map((f) => {
        const m = FIELD_META[f];
        return (
          <label key={f} className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-[color:var(--text-3)]">
              {m.label}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <input
                type="number"
                min={m.min}
                max={m.max}
                inputMode="numeric"
                value={vals[f] ?? ""}
                onChange={(e) => onChange(f, e.target.value)}
                className="h-10 w-20 rounded-[10px] bg-[color:var(--surface-2)] px-2 text-center text-[15px] font-bold num font-[family-name:var(--mono)] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[11px] text-[color:var(--text-4)]">
                {m.suffix}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function CartClient({ cart, addable }: CartView) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [addVals, setAddVals] = useState<Record<string, Vals>>(() => {
    const o: Record<string, Vals> = {};
    for (const a of addable) {
      o[a.slug] = {
        baseRepGoal: String(a.defaultBaseRepGoal),
        weeklyIncrement: String(a.defaultWeeklyIncrement),
        weeklyDayTarget: String(a.defaultWeeklyDayTarget),
      };
    }
    return o;
  });

  const [panel, setPanel] = useState<{ slug: string; mode: PanelMode } | null>(
    null,
  );
  const [panelVals, setPanelVals] = useState<Vals>({});

  const openPanel = (c: CartExercise, mode: PanelMode) => {
    if (panel?.slug === c.slug && panel.mode === mode) {
      setPanel(null);
      return;
    }
    setPanel({ slug: c.slug, mode });
    setPanelVals(valsFromCart(c));
  };

  const runAdd = (a: AddableExercise) => {
    setError(null);
    setBusy(a.slug);
    const v = addVals[a.slug] ?? {};
    start(async () => {
      const res = await addExercise({ slug: a.slug, ...toPayload(v) });
      setBusy(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  const runRemove = (slug: string) => {
    setError(null);
    setBusy(slug);
    start(async () => {
      const res = await removeExercise(slug);
      setBusy(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  const runPanel = (slug: string, mode: PanelMode) => {
    setError(null);
    setBusy(slug);
    const payload = { slug, ...toPayload(panelVals) };
    start(async () => {
      const res =
        mode === "edit"
          ? await updateExerciseSetup(payload)
          : await startNewStreak(payload);
      setBusy(null);
      if (res.ok) {
        setPanel(null);
        router.refresh();
      } else setError(res.error);
    });
  };

  const goalLine = (c: CartExercise) => {
    const parts = [`${c.currentGoal} reps/day`];
    if (c.progression === "weekly-step" && c.weeklyIncrement > 0)
      parts.push(`+${c.weeklyIncrement}/wk`);
    if (c.type === "weighted" && c.weightGoal != null)
      parts.push(`@ ${c.weightGoal} lb`);
    parts.push(`${c.weeklyDayTarget} of 7 days`);
    return parts.join(" · ");
  };

  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-[var(--r-lg)] px-3 text-[12px] font-semibold shadow-[inset_0_0_0_1px_var(--hairline-2)] disabled:opacity-60";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-2)]">
          Your program
        </h2>
        {cart.length === 0 ? (
          <p className="rounded-[12px] bg-[color:var(--surface)] p-4 text-[12.5px] text-[color:var(--text-3)] shadow-[inset_0_0_0_1px_var(--hairline-2)]">
            No exercises yet — set one up below to start training.
          </p>
        ) : (
          cart.map((c) => {
            const open = panel?.slug === c.slug ? panel.mode : null;
            return (
              <div
                key={c.slug}
                className="flex flex-col gap-3 rounded-[12px] bg-[color:var(--surface)] p-3.5 shadow-[inset_0_0_0_1px_var(--hairline)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-bold">{c.name}</div>
                    <div className="text-[11.5px] text-[color:var(--text-3)]">
                      {goalLine(c)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {c.setupFields.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openPanel(c, "edit")}
                        disabled={pending}
                        className={`${btn} text-[color:var(--text-2)] hover:text-[color:var(--text)]`}
                      >
                        {open === "edit" ? (
                          <X size={14} strokeWidth={2.5} />
                        ) : (
                          <Pencil size={13} strokeWidth={2.5} />
                        )}
                        {open === "edit" ? "Cancel" : "Edit"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openPanel(c, "restart")}
                      disabled={pending}
                      className={`${btn} text-[color:var(--text-2)] hover:text-[color:var(--brand-ink)]`}
                    >
                      {open === "restart" ? (
                        <X size={14} strokeWidth={2.5} />
                      ) : (
                        <RotateCcw size={13} strokeWidth={2.5} />
                      )}
                      {open === "restart" ? "Cancel" : "New streak"}
                    </button>
                    <button
                      type="button"
                      onClick={() => runRemove(c.slug)}
                      disabled={pending}
                      className={`${btn} text-[color:var(--text-2)] hover:text-[color:var(--down)]`}
                    >
                      {busy === c.slug && open === null ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} strokeWidth={2.5} />
                      )}
                      Remove
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="flex flex-col gap-3 rounded-[10px] bg-[color:var(--surface-2)] p-3">
                    {open === "restart" && (
                      <p className="text-[11.5px] text-[color:var(--text-3)]">
                        Starts a fresh streak: resets this week and your
                        current streak, and sets your daily goal back to the
                        baseline below. Your XP, best streak, lifetime reps,
                        and trophies are kept.
                      </p>
                    )}
                    <SetupInputs
                      fields={c.setupFields}
                      vals={panelVals}
                      onChange={(f, v) =>
                        setPanelVals((prev) => ({ ...prev, [f]: v }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => runPanel(c.slug, open)}
                      disabled={pending}
                      className="inline-flex h-9 w-fit items-center gap-1.5 rounded-[var(--r-lg)] bg-[color:var(--brand)] px-4 text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-[var(--cta-shadow)] hover:bg-[color:var(--brand-hover)] disabled:opacity-60"
                    >
                      {busy === c.slug ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : open === "restart" ? (
                        <RotateCcw size={14} strokeWidth={2.5} />
                      ) : (
                        <Check size={14} strokeWidth={2.5} />
                      )}
                      {open === "restart" ? "Start new streak" : "Save setup"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {addable.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-2)]">
            Add an exercise
          </h2>
          {addable.map((a) => (
            <div
              key={a.slug}
              className="flex flex-col gap-3 rounded-[12px] bg-[color:var(--surface)] p-3.5 shadow-[inset_0_0_0_1px_var(--hairline)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[14px] font-bold">{a.name}</div>
                <button
                  type="button"
                  onClick={() => runAdd(a)}
                  disabled={pending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[var(--r-lg)] bg-[color:var(--brand)] px-3.5 text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-[var(--cta-shadow)] hover:bg-[color:var(--brand-hover)] disabled:opacity-60"
                >
                  {busy === a.slug ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} strokeWidth={2.5} />
                  )}
                  {a.setupFields.length > 0 ? "Add to program" : "Add"}
                </button>
              </div>
              {a.setupFields.length > 0 && (
                <SetupInputs
                  fields={a.setupFields}
                  vals={addVals[a.slug] ?? {}}
                  onChange={(f, v) =>
                    setAddVals((prev) => ({
                      ...prev,
                      [a.slug]: { ...prev[a.slug], [f]: v },
                    }))
                  }
                />
              )}
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
