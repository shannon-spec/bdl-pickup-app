"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createLeagueGames } from "@/lib/actions/games";

const FORMATS = [
  { v: "5v5", l: "5 V 5 — Single" },
  { v: "5v5-series", l: "5 V 5 — Series" },
  { v: "3v3", l: "3 V 3 — Single" },
  { v: "3v3-series", l: "3 V 3 — Series" },
];

const GAME_LENGTHS = ["20", "24", "30", "32", "36", "40", "44", "48"];

/** Normalize a Postgres `time` value ("05:30:00") to an <input type=time>
 *  value ("05:30"). Returns "" when unset so the field stays empty. */
const toInputTime = (t: string | null | undefined) =>
  t ? t.slice(0, 5) : "";
const DEFAULT_TIME = "19:00";
const today = () => new Date().toISOString().slice(0, 10);

type Slot = { date: string; time: string; venue: string };

export function NewGameClient({
  leagues,
}: {
  leagues: { id: string; name: string; startTime: string | null }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetLeagueId = searchParams.get("league") ?? "";

  const timeForLeague = (id: string) =>
    toInputTime(leagues.find((l) => l.id === id)?.startTime) || DEFAULT_TIME;

  const [mode, setMode] = useState<"single" | "multi">("single");
  const [leagueId, setLeagueId] = useState(presetLeagueId);
  const [format, setFormat] = useState("5v5");
  const [gameLength, setGameLength] = useState("");
  const [slots, setSlots] = useState<Slot[]>(() => [
    { date: today(), time: timeForLeague(presetLeagueId), venue: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onLeagueChange = (id: string) => {
    setLeagueId(id);
    const prevDefault = timeForLeague(leagueId);
    const nextDefault = timeForLeague(id);
    // Re-seed any slot still holding the old league's default time.
    setSlots((prev) =>
      prev.map((s) => (s.time === prevDefault ? { ...s, time: nextDefault } : s)),
    );
  };

  const updateSlot = (i: number, patch: Partial<Slot>) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addSlot = () =>
    setSlots((prev) => [
      ...prev,
      {
        date: prev[prev.length - 1]?.date ?? today(),
        time: timeForLeague(leagueId),
        venue: prev[prev.length - 1]?.venue ?? "",
      },
    ]);
  const removeSlot = (i: number) =>
    setSlots((prev) => prev.filter((_, idx) => idx !== i));

  const switchMode = (m: "single" | "multi") => {
    setMode(m);
    if (m === "single") setSlots((prev) => prev.slice(0, 1));
  };

  const submit = () => {
    setError(null);
    if (!leagueId) {
      setError("Pick a league.");
      return;
    }
    const used = mode === "single" ? slots.slice(0, 1) : slots;
    const cleaned = used.filter((s) => s.date);
    if (cleaned.length === 0) {
      setError("Add at least one game date.");
      return;
    }
    start(async () => {
      const res = await createLeagueGames({
        leagueId,
        format,
        gameLengthMinutes: gameLength,
        slots: cleaned.map((s) => ({
          gameDate: s.date,
          gameTime: s.time,
          venue: s.venue,
        })),
      });
      if (res.ok && res.data) {
        const ids = res.data.ids;
        router.push(ids.length === 1 ? `/games/${ids[0]}` : "/games");
        return;
      }
      setError(res.ok ? "Could not schedule games." : res.error);
    });
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Mode toggle */}
      <div className="inline-flex items-center gap-1 p-1 rounded-[var(--r-lg)] bg-[color:var(--surface-2)] self-start">
        {(["single", "multi"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`h-8 px-3.5 rounded-[8px] text-[12px] font-bold transition-colors ${
              mode === m
                ? "bg-[color:var(--surface)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_var(--hairline-2)]"
                : "text-[color:var(--text-3)] hover:text-[color:var(--text)]"
            }`}
          >
            {m === "single" ? "Single game" : "Multiple games"}
          </button>
        ))}
      </div>

      <Field label="League *">
        <select
          value={leagueId}
          required
          onChange={(e) => onLeagueChange(e.target.value)}
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
        <Field label="Format">
          <select
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
        <Field label="Game length">
          <select
            value={gameLength}
            onChange={(e) => setGameLength(e.target.value)}
            className={selectCx}
          >
            <option value="">—</option>
            {GAME_LENGTHS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </Field>
      </Row>

      {/* Game slots */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          {mode === "single" ? "Date & time" : `Games · ${slots.length}`}
        </span>
        {(mode === "single" ? slots.slice(0, 1) : slots).map((s, i) => (
          <div
            key={i}
            className="flex items-end gap-2 max-sm:flex-wrap rounded-[var(--r-lg)] bg-[color:var(--surface-2)] p-2"
          >
            <Field label="Date *">
              <input
                type="date"
                value={s.date}
                required
                onChange={(e) => updateSlot(i, { date: e.target.value })}
                className={inputCx}
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={s.time}
                onChange={(e) => updateSlot(i, { time: e.target.value })}
                className={inputCx}
              />
            </Field>
            <Field label="Venue">
              <input
                value={s.venue}
                placeholder="e.g. Fortis"
                onChange={(e) => updateSlot(i, { venue: e.target.value })}
                className={inputCx}
              />
            </Field>
            {mode === "multi" && slots.length > 1 && (
              <button
                type="button"
                onClick={() => removeSlot(i)}
                aria-label="Remove game"
                className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-[var(--r-lg)] text-[color:var(--text-3)] hover:text-[color:var(--down)] hover:bg-[color:var(--down-soft)] transition-colors"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        {mode === "multi" && (
          <button
            type="button"
            onClick={addSlot}
            className="self-start inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--r-lg)] text-[12px] font-semibold text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-soft)] transition-colors shadow-[inset_0_0_0_1px_var(--hairline-2)]"
          >
            <Plus size={14} strokeWidth={2.5} /> Add another date
          </button>
        )}
      </div>

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
          type="button"
          onClick={submit}
          disabled={pending}
          className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
        >
          {pending
            ? "Scheduling…"
            : mode === "multi"
              ? `Schedule ${slots.length} game${slots.length === 1 ? "" : "s"}`
              : "Schedule"}
        </button>
      </div>
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
