"use client";

import { useState, useTransition } from "react";
import type { League } from "@/lib/db";
import { createLeague, updateLeague } from "@/lib/actions/leagues";

const FORMATS = [
  { v: "5v5", l: "5 V 5" },
  { v: "3v3", l: "3 V 3" },
  { v: "series", l: "Series" },
];

// Map any legacy format value to one of the three currently-selectable
// options so opening an old league in edit mode still shows a chosen
// format rather than a blank dropdown.
const normalizeFormat = (f: string | null | undefined): string => {
  if (f === "5v5-series") return "5v5";
  if (f === "3v3-series") return "3v3";
  return f && ["5v5", "3v3", "series"].includes(f) ? f : "5v5";
};
const LEVELS = [
  "Not Rated",
  "Novice",
  "Intermediate",
  "Advanced",
  "Game Changer",
  "Pro",
] as const;

/**
 * Shared league create/edit form body. Used by both the legacy sheet
 * (Add League) and the dedicated /leagues/[id]/edit full page.
 */
export function LeagueForm({
  editing,
  onCancel,
  onSaved,
  saveLabel,
}: {
  editing: League | null;
  onCancel: () => void;
  onSaved: (id: string) => void;
  saveLabel?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const [format, setFormat] = useState<string>(normalizeFormat(editing?.format));
  const isSeries = format === "series";

  const onSubmit = (formData: FormData) => {
    setError(null);
    setFieldErrors({});
    start(async () => {
      const res = editing
        ? await updateLeague(editing.id, formData)
        : await createLeague(formData);
      if (res.ok) {
        onSaved(res.data?.id ?? editing?.id ?? "");
        return;
      }
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    });
  };

  return (
    <form action={onSubmit} className="flex flex-col gap-3.5">
      <Field label="Name *" error={fieldErrors.name?.[0]}>
        <input
          name="name"
          defaultValue={editing?.name ?? ""}
          required
          autoFocus
          className={inputCx}
        />
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
          <select
            name="format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={selectCx}
          >
            {FORMATS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.l}
              </option>
            ))}
          </select>
        </Field>
      </Row>
      {isSeries && (
        <Row>
          <Field label="Number of Games">
            <input
              name="seriesGameCount"
              type="number"
              min={1}
              defaultValue={editing?.seriesGameCount ?? 5}
              className={inputCx}
              placeholder="5"
            />
          </Field>
          <Field label="Played to" hint="point total">
            <input
              name="seriesPointTarget"
              type="number"
              min={1}
              defaultValue={editing?.seriesPointTarget ?? 11}
              className={inputCx}
              placeholder="11"
            />
          </Field>
        </Row>
      )}
      <Field label="Schedule">
        <input
          name="schedule"
          defaultValue={editing?.schedule ?? ""}
          className={inputCx}
          placeholder="Tuesdays & Thursdays · 7:00 PM"
        />
      </Field>
      <Field label="Location">
        <input
          name="location"
          defaultValue={editing?.location ?? ""}
          className={inputCx}
        />
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
      {!isSeries && (
        <Field label="Play To" hint="winning score (e.g. 150)">
          <input
            name="playToScore"
            type="number"
            min={1}
            defaultValue={editing?.playToScore ?? ""}
            className={inputCx}
            placeholder="150"
          />
        </Field>
      )}
      <Field label="Grade" hint="skill target">
        <select
          name="level"
          defaultValue={editing?.level ?? "Not Rated"}
          className={selectCx}
        >
          {LEVELS.map((lv) => (
            <option key={lv} value={lv}>
              {lv}
            </option>
          ))}
        </select>
      </Field>
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

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-[color:var(--hairline)]">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : saveLabel ?? (editing ? "Save changes" : "Add league")}
        </button>
      </div>
    </form>
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
