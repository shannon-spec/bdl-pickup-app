"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import type { Game } from "@/lib/db";
import { createGame, updateGame } from "@/lib/actions/games";

type Mode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; row: Game };

const FORMATS = [
  { v: "5v5", l: "5 V 5 — Single" },
  { v: "5v5-series", l: "5 V 5 — Series" },
  { v: "3v3", l: "3 V 3 — Single" },
  { v: "3v3-series", l: "3 V 3 — Series" },
];

export function GameSheet({
  mode,
  leagues,
  onClose,
  onSaved,
}: {
  mode: Mode;
  leagues: { id: string; name: string }[];
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
        ? await updateGame(editing.id, formData)
        : await createGame(formData);
      if (res.ok) {
        onSaved();
        return;
      }
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    });
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[var(--z-modal)] flex">
      <button type="button" aria-label="Close" onClick={onClose} className="flex-1 bg-black/60 backdrop-blur-[2px]" />
      <aside
        className="w-full max-w-[460px] bg-[color:var(--surface)] border-l border-[color:var(--hairline-2)] shadow-xl flex flex-col max-sm:max-w-none max-sm:rounded-t-[20px] max-sm:max-h-[92dvh] max-sm:self-end max-sm:w-full"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-[color:var(--hairline)]">
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            {editing ? "Edit Game" : "Schedule Game"}
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
          <Field label="League *" error={fieldErrors.leagueId?.[0]}>
            <select name="leagueId" defaultValue={editing?.leagueId ?? ""} required className={selectCx}>
              <option value="" disabled>
                Select a league…
              </option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Row>
            <Field label="Date *" error={fieldErrors.gameDate?.[0]}>
              <input
                name="gameDate"
                type="date"
                defaultValue={editing?.gameDate ?? new Date().toISOString().slice(0, 10)}
                required
                className={inputCx}
              />
            </Field>
            <Field label="Time">
              <input
                name="gameTime"
                type="time"
                defaultValue={editing?.gameTime ?? "19:00"}
                className={inputCx}
              />
            </Field>
          </Row>
          <Field label="Venue">
            <input name="venue" defaultValue={editing?.venue ?? ""} className={inputCx} />
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
              {pending ? "Saving…" : editing ? "Save changes" : "Schedule"}
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
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 flex-1 min-w-0">
      <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
        {label}
      </span>
      {children}
      {error && <span className="text-[11px] text-[color:var(--down)]">{error}</span>}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">{children}</div>;
}
