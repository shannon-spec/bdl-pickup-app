"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createGame } from "@/lib/actions/games";

const FORMATS = [
  { v: "5v5", l: "5 V 5 — Single" },
  { v: "5v5-series", l: "5 V 5 — Series" },
  { v: "3v3", l: "3 V 3 — Single" },
  { v: "3v3-series", l: "3 V 3 — Series" },
];

export function NewGameClient({
  leagues,
}: {
  leagues: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetLeagueId = searchParams.get("league") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    setFieldErrors({});
    // The button that submitted the form sets `intent` so we can
    // route to the Invite Manager only when the user explicitly
    // chose to continue into invites.
    const intent = formData.get("intent");
    start(async () => {
      const res = await createGame(formData);
      if (res.ok && res.data?.id) {
        router.push(
          intent === "invite"
            ? `/games/${res.data.id}/invites`
            : `/games/${res.data.id}`,
        );
        return;
      }
      setError(res.ok ? "Could not schedule game." : res.error);
      setFieldErrors(res.ok ? {} : res.fieldErrors ?? {});
    });
  };

  return (
    <form action={onSubmit} className="flex flex-col gap-3.5">
      <Field label="League *" error={fieldErrors.leagueId?.[0]}>
        <select
          name="leagueId"
          defaultValue={presetLeagueId}
          required
          className={selectCx}
        >
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
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
            className={inputCx}
          />
        </Field>
        <Field label="Time">
          <input
            name="gameTime"
            type="time"
            defaultValue="19:00"
            className={inputCx}
          />
        </Field>
      </Row>
      <Field label="Venue">
        <input name="venue" className={inputCx} />
      </Field>
      <Field label="Format">
        <select name="format" defaultValue="5v5" className={selectCx}>
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

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-[color:var(--hairline)] flex-wrap">
        <button
          type="button"
          onClick={() => router.push("/games")}
          className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          name="intent"
          value="schedule"
          disabled={pending}
          className="h-10 px-5 rounded-[var(--r-lg)] border border-[color:var(--brand)] bg-[color:var(--surface)] text-[color:var(--brand)] hover:bg-[color:var(--brand-soft)] font-bold text-[12px] tracking-[0.06em] uppercase disabled:opacity-60"
        >
          {pending ? "Scheduling…" : "Schedule"}
        </button>
        <button
          type="submit"
          name="intent"
          value="invite"
          disabled={pending}
          className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
        >
          {pending ? "Scheduling…" : "Schedule & invite"}
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
