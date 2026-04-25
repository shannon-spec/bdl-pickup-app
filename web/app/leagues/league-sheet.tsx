"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import type { League } from "@/lib/db";
import { createLeague, updateLeague } from "@/lib/actions/leagues";

type Mode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; row: League };

const FORMATS = [
  { v: "5v5", l: "5 V 5 — Single" },
  { v: "5v5-series", l: "5 V 5 — Series" },
  { v: "3v3", l: "3 V 3 — Single" },
  { v: "3v3-series", l: "3 V 3 — Series" },
];

export function LeagueSheet({
  mode,
  onClose,
  onSaved,
}: {
  mode: Mode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = mode.kind !== "closed";
  const editing = mode.kind === "edit" ? mode.row : null;
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const onSubmit = (formData: FormData) => {
    setError(null);
    setFieldErrors({});
    start(async () => {
      const res = editing
        ? await updateLeague(editing.id, formData)
        : await createLeague(formData);
      if (res.ok) {
        onSaved();
        return;
      }
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "Edit league" : "Add league"}
      className="fixed inset-0 z-[var(--z-modal)] flex"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex-1 bg-black/60 backdrop-blur-[2px]"
      />
      <aside
        className="w-full max-w-[460px] bg-[color:var(--surface)] border-l border-[color:var(--hairline-2)] shadow-xl flex flex-col max-sm:max-w-none max-sm:rounded-t-[20px] max-sm:max-h-[92dvh] max-sm:self-end max-sm:w-full"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-[color:var(--hairline)]">
          <div>
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
              {editing ? "Edit League" : "Add League"}
            </div>
            {editing && <div className="font-bold text-[16px] mt-0.5">{editing.name}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 inline-flex items-center justify-center rounded-[var(--r-lg)] text-[color:var(--text-3)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)]"
          >
            <X size={18} />
          </button>
        </header>

        <form action={onSubmit} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3.5">
          <Field label="Name *" error={fieldErrors.name?.[0]}>
            <input name="name" defaultValue={editing?.name ?? ""} required autoFocus className={inputCx} />
          </Field>
          <Row>
            <Field label="Season">
              <input
                name="season"
                defaultValue={editing?.season ?? ""}
                className={inputCx}
                placeholder="2026"
              />
            </Field>
            <Field label="Format">
              <select name="format" defaultValue={editing?.format ?? "5v5"} className={selectCx}>
                {FORMATS.map((f) => (
                  <option key={f.v} value={f.v}>
                    {f.l}
                  </option>
                ))}
              </select>
            </Field>
          </Row>
          <Field label="Schedule">
            <input
              name="schedule"
              defaultValue={editing?.schedule ?? ""}
              className={inputCx}
              placeholder="Tuesdays & Thursdays · 7:00 PM"
            />
          </Field>
          <Field label="Location">
            <input name="location" defaultValue={editing?.location ?? ""} className={inputCx} />
          </Field>
          <Row>
            <Field label="Start Time" hint="HH:MM">
              <input
                name="startTime"
                type="time"
                defaultValue={editing?.startTime ?? ""}
                className={inputCx}
              />
            </Field>
            <Field label="Max Players">
              <input
                name="maxPlayers"
                type="number"
                min={2}
                defaultValue={editing?.maxPlayers ?? ""}
                className={inputCx}
              />
            </Field>
          </Row>
          <Row>
            <Field label="Team A Name">
              <input
                name="teamAName"
                defaultValue={editing?.teamAName ?? "White"}
                className={inputCx}
              />
            </Field>
            <Field label="Team B Name">
              <input
                name="teamBName"
                defaultValue={editing?.teamBName ?? "Dark"}
                className={inputCx}
              />
            </Field>
          </Row>
          <Field label="Description">
            <textarea
              name="description"
              defaultValue={editing?.description ?? ""}
              rows={3}
              className={inputCx + " py-2 h-auto resize-none"}
            />
          </Field>

          {error && (
            <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
              {error}
            </div>
          )}

          <footer className="mt-auto flex items-center justify-end gap-2 pt-4 border-t border-[color:var(--hairline)] -mx-5 px-5 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
            >
              {pending ? "Saving…" : editing ? "Save changes" : "Add league"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

const inputCx =
  "w-full h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] transition-colors placeholder:text-[color:var(--text-4)]";
const selectCx = inputCx + " pr-8 cursor-pointer";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 flex-1 min-w-0">
      <span className="flex items-center justify-between text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
        <span>{label}</span>
        {hint && (
          <span className="text-[color:var(--text-4)] tracking-normal lowercase font-medium normal-case">
            {hint}
          </span>
        )}
      </span>
      {children}
      {error && <span className="text-[11px] text-[color:var(--down)]">{error}</span>}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">{children}</div>;
}
