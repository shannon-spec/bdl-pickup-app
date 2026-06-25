"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTeamGame } from "@/lib/actions/games";

type Opponent = { id: string; name: string };

export function NewTeamGameClient({
  teamId,
  teamName,
  defaultFormat,
  opponents,
}: {
  teamId: string;
  teamName: string;
  defaultFormat: string;
  opponents: Opponent[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [type, setType] = useState<"exhibition" | "tournament">("exhibition");

  const onSubmit = (formData: FormData) => {
    setError(null);
    setFieldErrors({});
    start(async () => {
      const res = await createTeamGame(formData);
      if (res.ok) {
        router.push(`/games/${res.data?.id}`);
        router.refresh();
        return;
      }
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    });
  };

  return (
    <form action={onSubmit} className="flex flex-col gap-3.5">
      <input type="hidden" name="teamAId" value={teamId} />

      <Field label="Opponent *" error={fieldErrors.teamBId?.[0]}>
        <select name="teamBId" required className={selectCx} defaultValue="">
          <option value="" disabled>
            {opponents.length === 0 ? "No other teams yet" : "Pick a team…"}
          </option>
          {opponents.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>

      <Row>
        <Field label="Date *" error={fieldErrors.gameDate?.[0]}>
          <input name="gameDate" type="date" required className={inputCx} />
        </Field>
        <Field label="Time">
          <input name="gameTime" type="time" defaultValue="19:00" className={inputCx} />
        </Field>
      </Row>

      <Row>
        <Field label="Format">
          <select
            name="format"
            defaultValue={defaultFormat === "3v3" ? "3v3" : "5v5"}
            className={selectCx}
          >
            <option value="5v5">5 V 5</option>
            <option value="3v3">3 V 3</option>
          </select>
        </Field>
        <Field label="Type">
          <select
            name="gameType"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className={selectCx}
          >
            <option value="exhibition">Exhibition</option>
            <option value="tournament">Tournament</option>
          </select>
        </Field>
      </Row>

      {type === "tournament" && (
        <Field label="Tournament name *" error={fieldErrors.tournamentName?.[0]}>
          <input
            name="tournamentName"
            className={inputCx}
            placeholder="Summer Slam 2026"
          />
        </Field>
      )}

      <Field label="Venue">
        <input name="venue" className={inputCx} placeholder="Gym name" />
      </Field>

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-4 shadow-[inset_0_1px_0_0_var(--hairline)]">
        <button
          type="button"
          onClick={() => router.push(`/teams/${teamId}`)}
          className="h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || opponents.length === 0}
          className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] disabled:opacity-60"
        >
          {pending ? "Scheduling…" : `Schedule for ${teamName}`}
        </button>
      </div>
    </form>
  );
}

const inputCx =
  "w-full h-10 rounded-[var(--r-lg)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)] transition-shadow placeholder:text-[color:var(--text-4)]";
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
