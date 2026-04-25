"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import type { RosterRow } from "@/lib/queries/roster";
import { createPlayer, updatePlayer } from "@/lib/actions/roster";

type Mode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; row: RosterRow };

const POSITIONS = ["", "PG", "SG", "SF", "PF", "C", "G", "F"];
const LEVELS = ["Not Rated", "Novice", "Intermediate", "Advanced", "Game Changer", "Pro"];
const STATUSES = ["Active", "Inactive", "IR"];

export function PlayerSheet({
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

  // Body scroll lock + Esc to close
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
      const result = editing
        ? await updatePlayer(editing.id, formData)
        : await createPlayer(formData);
      if (result.ok) {
        onSaved();
        return;
      }
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    });
  };

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "Edit player" : "Add player"}
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
              {editing ? "Edit Player" : "Add Player"}
            </div>
            {editing && (
              <div className="font-bold text-[16px] mt-0.5">
                {editing.firstName} {editing.lastName}
              </div>
            )}
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
          <Row>
            <Field label="First Name *" error={fieldErrors.firstName?.[0]}>
              <input
                name="firstName"
                defaultValue={editing?.firstName ?? ""}
                autoFocus
                required
                className={inputCx}
              />
            </Field>
            <Field label="Last Name *" error={fieldErrors.lastName?.[0]}>
              <input
                name="lastName"
                defaultValue={editing?.lastName ?? ""}
                required
                className={inputCx}
              />
            </Field>
          </Row>

          <Field label="Email" error={fieldErrors.email?.[0]}>
            <input
              name="email"
              type="email"
              defaultValue={editing?.email ?? ""}
              className={inputCx}
              placeholder="player@example.com"
            />
          </Field>

          <Field label="Cell" error={fieldErrors.cell?.[0]}>
            <input
              name="cell"
              defaultValue={editing?.cell ?? ""}
              className={inputCx}
              placeholder="555-555-5555"
            />
          </Field>

          <Row>
            <Field label="City" error={fieldErrors.city?.[0]}>
              <input name="city" defaultValue={editing?.city ?? ""} className={inputCx} />
            </Field>
            <Field label="State" error={fieldErrors.state?.[0]} hint="2 letters">
              <input
                name="state"
                defaultValue={editing?.state ?? ""}
                maxLength={2}
                className={inputCx}
                style={{ textTransform: "uppercase" }}
              />
            </Field>
          </Row>

          <Row>
            <Field label="Position" error={fieldErrors.position?.[0]}>
              <select
                name="position"
                defaultValue={editing?.position ?? ""}
                className={selectCx}
              >
                {POSITIONS.map((p) => (
                  <option key={p || "_"} value={p}>
                    {p || "—"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Level" error={fieldErrors.level?.[0]}>
              <select
                name="level"
                defaultValue={editing?.level ?? "Not Rated"}
                className={selectCx}
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </Row>

          <Field label="Status" error={fieldErrors.status?.[0]}>
            <select
              name="status"
              defaultValue={editing?.status ?? "Active"}
              className={selectCx}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
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
              className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium text-[color:var(--text)] hover:bg-[color:var(--surface-2)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pending ? "Saving…" : editing ? "Save changes" : "Add player"}
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
        {hint && <span className="text-[color:var(--text-4)] tracking-normal lowercase font-medium normal-case">{hint}</span>}
      </span>
      {children}
      {error && <span className="text-[11px] text-[color:var(--down)]">{error}</span>}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">{children}</div>;
}
