"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import type { GameDetail } from "@/lib/queries/games";
import {
  deleteGame,
  setGameRosterPlayer,
  setGameScore,
  setSeriesScore,
  updateGame,
} from "@/lib/actions/games";
import { PctPill } from "@/components/bdl/pct-pill";

const isSeriesFormat = (f: string | null | undefined) =>
  f === "series" || f === "5v5-series" || f === "3v3-series";

export function GameScore({ detail }: { detail: GameDetail }) {
  const isSeries = isSeriesFormat(detail.league?.format);
  if (isSeries) return <SeriesScore detail={detail} />;
  return <SingleScore detail={detail} />;
}

function SingleScore({ detail }: { detail: GameDetail }) {
  const router = useRouter();
  const { game } = detail;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Eligible game-winners: anyone on the roster of either team
  const eligible = [...detail.rosterA, ...detail.rosterB].sort((a, b) =>
    a.lastName.localeCompare(b.lastName),
  );

  const onSubmit = (formData: FormData) => {
    setError(null);
    start(async () => {
      const res = await setGameScore(game.id, formData);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  return (
    <form action={onSubmit} className="grid grid-cols-[auto_auto_auto_1fr_auto] items-end gap-3 max-sm:grid-cols-2 max-sm:gap-y-3">
      <Field label={`${game.teamAName ?? "White"} score`}>
        <input
          name="scoreA"
          type="number"
          inputMode="numeric"
          defaultValue={game.scoreA ?? ""}
          className={inputCx + " w-[100px] num font-[family-name:var(--mono)]"}
        />
      </Field>
      <Field label={`${game.teamBName ?? "Dark"} score`}>
        <input
          name="scoreB"
          type="number"
          inputMode="numeric"
          defaultValue={game.scoreB ?? ""}
          className={inputCx + " w-[100px] num font-[family-name:var(--mono)]"}
        />
      </Field>
      <Field label="Game Winner">
        <select
          name="gameWinnerId"
          defaultValue={game.gameWinner ?? ""}
          className={selectCx + " min-w-[180px]"}
        >
          <option value="">— None —</option>
          {eligible.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </Field>
      <label className="inline-flex items-center gap-2 self-end pb-2 cursor-pointer">
        <input
          type="checkbox"
          name="locked"
          defaultChecked={game.locked}
          className="w-4 h-4 accent-[color:var(--brand)]"
        />
        <span className="text-[13px] text-[color:var(--text-2)]">Lock as final</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save score"}
      </button>
      {error && (
        <div className="col-span-full text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}
    </form>
  );
}

function SeriesScore({ detail }: { detail: GameDetail }) {
  const router = useRouter();
  const { game, league, subgames } = detail;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const teamA = game.teamAName ?? league?.teamAName ?? "White";
  const teamB = game.teamBName ?? league?.teamBName ?? "Dark";
  const eligible = [...detail.rosterA, ...detail.rosterB].sort((a, b) =>
    a.lastName.localeCompare(b.lastName),
  );
  const targetCount = Math.max(
    league?.seriesGameCount ?? 5,
    subgames.length || 0,
  );
  const pointTarget = league?.seriesPointTarget ?? null;

  const subByIndex = new Map(subgames.map((s) => [s.gameIndex, s]));
  const [rows, setRows] = useState<{ a: string; b: string }[]>(() =>
    Array.from({ length: targetCount }, (_, i) => {
      const s = subByIndex.get(i);
      return {
        a: s?.scoreA != null ? String(s.scoreA) : "",
        b: s?.scoreB != null ? String(s.scoreB) : "",
      };
    }),
  );

  const winsA = rows.reduce((n, r) => {
    const a = parseInt(r.a, 10);
    const b = parseInt(r.b, 10);
    return Number.isFinite(a) && Number.isFinite(b) && a > b ? n + 1 : n;
  }, 0);
  const winsB = rows.reduce((n, r) => {
    const a = parseInt(r.a, 10);
    const b = parseInt(r.b, 10);
    return Number.isFinite(a) && Number.isFinite(b) && b > a ? n + 1 : n;
  }, 0);

  const updateRow = (idx: number, side: "a" | "b", v: string) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [side]: v } : r)),
    );
  };
  const addRow = () => setRows((prev) => [...prev, { a: "", b: "" }]);

  const onSubmit = (formData: FormData) => {
    setError(null);
    start(async () => {
      const res = await setSeriesScore(game.id, formData);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3 flex-wrap">
        <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
          Series Score
        </div>
        <div className="font-[family-name:var(--mono)] num font-extrabold text-[18px]">
          <span className={winsA > winsB ? "text-[color:var(--text)]" : "text-[color:var(--text-3)]"}>
            {teamA} {winsA}
          </span>
          <span className="text-[color:var(--text-4)] mx-2">—</span>
          <span className={winsB > winsA ? "text-[color:var(--text)]" : "text-[color:var(--text-3)]"}>
            {teamB} {winsB}
          </span>
        </div>
        {pointTarget && (
          <span className="text-[11.5px] text-[color:var(--text-3)]">
            Played to {pointTarget}
          </span>
        )}
      </div>

      <div className="rounded-[12px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_1fr_60px] items-center gap-3 px-4 py-2 text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)] border-b border-[color:var(--hairline)]">
          <span>Game</span>
          <span>{teamA}</span>
          <span>{teamB}</span>
          <span className="text-right">Won</span>
        </div>
        {rows.map((r, i) => {
          const a = parseInt(r.a, 10);
          const b = parseInt(r.b, 10);
          const won =
            Number.isFinite(a) && Number.isFinite(b)
              ? a > b
                ? "A"
                : b > a
                  ? "B"
                  : "Tie"
              : null;
          return (
            <div
              key={i}
              className="grid grid-cols-[60px_1fr_1fr_60px] items-center gap-3 px-4 py-2.5 border-t border-[color:var(--hairline)] first:border-t-0"
            >
              <span className="font-bold text-[13px] text-[color:var(--text-2)]">
                {i + 1}
              </span>
              <input
                name={`scoreA_${i}`}
                type="number"
                inputMode="numeric"
                value={r.a}
                onChange={(e) => updateRow(i, "a", e.target.value)}
                placeholder="—"
                className={inputCx + " num font-[family-name:var(--mono)] w-full"}
              />
              <input
                name={`scoreB_${i}`}
                type="number"
                inputMode="numeric"
                value={r.b}
                onChange={(e) => updateRow(i, "b", e.target.value)}
                placeholder="—"
                className={inputCx + " num font-[family-name:var(--mono)] w-full"}
              />
              <span
                className={`text-right font-bold text-[12px] tracking-[0.08em] uppercase ${
                  won === "A"
                    ? "text-[color:var(--up)]"
                    : won === "B"
                      ? "text-[color:var(--down)]"
                      : "text-[color:var(--text-4)]"
                }`}
              >
                {won === "A" ? teamA : won === "B" ? teamB : won === "Tie" ? "Tie" : ""}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={addRow}
          className="h-9 px-3 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-2)] text-[12px] font-bold tracking-[0.06em] uppercase"
        >
          + Add game
        </button>
        <Field label="Series MVP">
          <select
            name="gameWinnerId"
            defaultValue={game.gameWinner ?? ""}
            className={selectCx + " min-w-[180px]"}
          >
            <option value="">— None —</option>
            {eligible.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </Field>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="locked"
            defaultChecked={game.locked}
            className="w-4 h-4 accent-[color:var(--brand)]"
          />
          <span className="text-[13px] text-[color:var(--text-2)]">Lock as final</span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60 ml-auto"
        >
          {pending ? "Saving…" : "Save series"}
        </button>
      </div>

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}
    </form>
  );
}

export function RosterRow({
  gameId,
  playerId,
  name,
  pct,
  record,
}: {
  gameId: string;
  playerId: string;
  name: string;
  currentSide: "A" | "B" | "invited";
  teamAName: string;
  teamBName: string;
  pct?: number | null;
  record?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] text-[14px]">
      <Link
        href={`/players/${playerId}`}
        className="font-bold hover:text-[color:var(--brand)] truncate"
      >
        {name}
      </Link>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {pct !== null && pct !== undefined && (
          <span className="flex items-center gap-1.5">
            <PctPill pct={pct} />
            {record && (
              <span className="font-[family-name:var(--mono)] num text-[11.5px] text-[color:var(--text-4)]">
                {record}
              </span>
            )}
          </span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                const res = await setGameRosterPlayer(gameId, playerId, null);
                if (res.ok) router.refresh();
              } catch {
                // Swallow — perm/view rejections shouldn't blow up the
                // page. The next render of the parent will reflect the
                // truth either way.
              }
            })
          }
          aria-label={`Remove ${name}`}
          className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--r-md)] text-[color:var(--text-3)] hover:text-[color:var(--down)] hover:bg-[color:var(--down-soft)] disabled:opacity-60"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export function AddRoster({
  gameId,
  eligible,
  allLeagues,
  currentLeagueId,
  teamAName,
  teamBName,
}: {
  gameId: string;
  eligible: { id: string; firstName: string; lastName: string }[];
  allLeagues: { id: string; name: string }[];
  currentLeagueId: string | null;
  teamAName: string;
  teamBName: string;
}) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [side, setSide] = useState<"A" | "B" | "invited">("A");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  void allLeagues;
  void currentLeagueId;

  if (eligible.length === 0) {
    return (
      <div className="text-[12px] text-[color:var(--text-3)]">
        Everyone in this league is already on the roster.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="flex-1 h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-3 text-[14px] outline-none cursor-pointer"
        >
          <option value="">Select a league member…</option>
          {eligible.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as typeof side)}
          className="h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-3 text-[14px] outline-none cursor-pointer"
        >
          <option value="A">{teamAName}</option>
          <option value="B">{teamBName}</option>
          <option value="invited">Invited</option>
        </select>
        <button
          type="button"
          disabled={!playerId || pending}
          onClick={() =>
            start(async () => {
              if (!playerId) return;
              setError(null);
              try {
                const res = await setGameRosterPlayer(gameId, playerId, side);
                if (res.ok) {
                  setPlayerId("");
                  router.refresh();
                } else {
                  setError(res.error);
                }
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not add player.");
              }
            })
          }
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase disabled:opacity-60"
        >
          <Plus size={14} strokeWidth={2.5} /> {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
};

export function GameMetaEditor({ detail }: { detail: GameDetail }) {
  const router = useRouter();
  const { game } = detail;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    if (game.leagueId) formData.set("leagueId", game.leagueId);
    start(async () => {
      const res = await updateGame(game.id, formData);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  };

  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="inline-flex items-center gap-2">
          <Pencil size={13} className="text-[color:var(--text-3)]" />
          <span className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            Edit Game Details
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`text-[color:var(--text-3)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <form
          action={onSubmit}
          className="grid grid-cols-2 gap-3 px-5 pb-5 max-sm:grid-cols-1"
        >
          <Field label="Date">
            <input
              name="gameDate"
              type="date"
              required
              defaultValue={game.gameDate ?? ""}
              className={inputCx}
            />
          </Field>
          <Field label="Time">
            <input
              name="gameTime"
              type="time"
              defaultValue={game.gameTime ?? ""}
              className={inputCx}
            />
          </Field>
          <Field label="Venue / Location">
            <input
              name="venue"
              type="text"
              defaultValue={game.venue ?? ""}
              maxLength={120}
              placeholder="e.g. Fortis"
              className={inputCx}
            />
          </Field>
          <Field label="Format">
            <select
              name="format"
              defaultValue={game.format}
              className={selectCx}
            >
              <option value="5v5">5 v 5</option>
              <option value="5v5-series">5 v 5 — series</option>
              <option value="3v3">3 v 3</option>
              <option value="3v3-series">3 v 3 — series</option>
            </select>
          </Field>
          <Field label="Team A name">
            <input
              name="teamAName"
              type="text"
              defaultValue={game.teamAName ?? "White"}
              maxLength={40}
              required
              className={inputCx}
            />
          </Field>
          <Field label="Team B name">
            <input
              name="teamBName"
              type="text"
              defaultValue={game.teamBName ?? "Dark"}
              maxLength={40}
              required
              className={inputCx}
            />
          </Field>
          {error && (
            <div className="col-span-full text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
              {error}
            </div>
          )}
          <div className="col-span-full flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function DangerZone({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <div className="mt-4 rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            Danger Zone
          </div>
          <div className="text-[13px] text-[color:var(--text-2)] mt-1">
            Delete this game and all of its roster entries.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--down)] hover:bg-[color:var(--down-soft)]"
        >
          Delete Game
        </button>
      </div>
      {confirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center px-4 bg-black/60"
          onClick={() => setConfirm(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[18px] font-bold mb-2">Delete this game?</h3>
            <p className="text-[13px] text-[color:var(--text-3)]">
              All scores and roster assignments are removed. This can&apos;t be undone.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteGame(gameId);
                    if (res.ok) router.push("/games");
                  })
                }
                className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--down)] text-white font-bold text-[12px] tracking-[0.06em] uppercase disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Delete game"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const inputCx =
  "h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] transition-colors";
const selectCx = inputCx + " pr-8 cursor-pointer";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
        {label}
      </span>
      {children}
    </label>
  );
}
