"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import type { GameDetail } from "@/lib/queries/games";
import {
  clearGameRoster,
  deleteGame,
  loadPreviousGameRoster,
  setGameRosterPlayer,
  setGameScore,
  setSeriesScore,
  updateGame,
} from "@/lib/actions/games";
import { PctPill } from "@/components/bdl/pct-pill";
import { TeamBadge } from "@/components/bdl/team-badge";

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
  const [scoreA, setScoreA] = useState<string>(
    game.scoreA != null ? String(game.scoreA) : "",
  );
  const [scoreB, setScoreB] = useState<string>(
    game.scoreB != null ? String(game.scoreB) : "",
  );
  const [gameWinnerId, setGameWinnerId] = useState<string>(game.gameWinner ?? "");
  const [locked, setLocked] = useState<boolean>(game.locked);

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
          value={scoreA}
          onChange={(e) => setScoreA(e.target.value)}
          className={inputCx + " w-[100px] num font-[family-name:var(--mono)]"}
        />
      </Field>
      <Field label={`${game.teamBName ?? "Dark"} score`}>
        <input
          name="scoreB"
          type="number"
          inputMode="numeric"
          value={scoreB}
          onChange={(e) => setScoreB(e.target.value)}
          className={inputCx + " w-[100px] num font-[family-name:var(--mono)]"}
        />
      </Field>
      <Field label="Game Winner">
        <select
          name="gameWinnerId"
          value={gameWinnerId}
          onChange={(e) => setGameWinnerId(e.target.value)}
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
          checked={locked}
          onChange={(e) => setLocked(e.target.checked)}
          className="w-4 h-4 accent-[color:var(--brand)]"
        />
        <span className="text-[13px] text-[color:var(--text-2)]">Lock as final</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] disabled:opacity-60"
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
          className="h-9 px-3 rounded-[var(--r-md)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-2)] text-[12px] font-semibold text-[color:var(--text-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)]"
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
          className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] disabled:opacity-60 ml-auto"
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

type WinRec = { wins: number; losses: number; pct: number | null };

function teamAvg(
  list: { id: string }[],
  winPcts: Record<string, WinRec>,
): number | null {
  const vals = list
    .map((p) => winPcts[p.id]?.pct)
    .filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Per-player win-rate pill — green ≥50%, coral below. */
function WinPill({ pct }: { pct: number }) {
  const up = pct >= 50;
  return (
    <span
      className="inline-flex items-center justify-center min-w-[54px] h-6 px-2 rounded-full font-[family-name:var(--mono)] num text-[11.5px] font-extrabold"
      style={{
        background: up ? "var(--up-soft)" : "var(--down-soft)",
        color: up ? "var(--up)" : "var(--down)",
      }}
    >
      {pct.toFixed(1)}%
    </span>
  );
}

function BuilderRow({
  gameId,
  index,
  player,
  rec,
}: {
  gameId: string;
  index: number;
  player: { id: string; firstName: string; lastName: string };
  rec?: WinRec;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2.5 py-1">
      <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-[6px] bg-[color:var(--surface-2)] text-[color:var(--text-3)] text-[11px] font-bold font-[family-name:var(--mono)] num">
        {index}
      </span>
      <Link
        href={`/players/${player.id}`}
        className="flex-1 min-w-0 font-medium text-[14px] truncate hover:text-[color:var(--brand)]"
      >
        {player.firstName} {player.lastName}
      </Link>
      {rec && (
        <span className="font-[family-name:var(--mono)] num text-[12px] text-[color:var(--text-4)]">
          {rec.wins}–{rec.losses}
        </span>
      )}
      {rec?.pct != null && <WinPill pct={rec.pct} />}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              const res = await setGameRosterPlayer(gameId, player.id, null);
              if (res.ok) router.refresh();
            } catch {
              /* ignore — next render reflects the truth */
            }
          })
        }
        aria-label={`Remove ${player.firstName} ${player.lastName}`}
        className="w-7 h-7 inline-flex items-center justify-center rounded-[var(--r-md)] text-[color:var(--text-4)] hover:text-[color:var(--down)] hover:bg-[color:var(--down-soft)] disabled:opacity-60 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function TeamColumn({
  gameId,
  team,
  name,
  list,
  avg,
  perSide,
  winPcts,
  divider,
}: {
  gameId: string;
  team: "white" | "dark";
  name: string;
  list: { id: string; firstName: string; lastName: string }[];
  avg: number | null;
  perSide: number;
  winPcts: Record<string, WinRec>;
  divider: boolean;
}) {
  const remaining = Math.max(0, perSide - list.length);
  return (
    <div
      className="p-4 flex flex-col gap-0.5"
      style={divider ? { boxShadow: "inset -1px 0 0 0 var(--hairline)" } : undefined}
    >
      <div className="flex items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <TeamBadge team={team} size={32} className="shrink-0" />
          <div className="flex flex-col leading-tight min-w-0">
            <span className="font-bold text-[15px] text-[color:var(--text)] truncate">
              {name}
            </span>
            <span className="text-[11px] text-[color:var(--text-3)]">
              {list.length} {list.length === 1 ? "player" : "players"}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-extrabold num text-[16px] text-[color:var(--text)]">
            {avg !== null ? `${avg.toFixed(1)}%` : "—"}
          </div>
          <div className="text-[9.5px] uppercase tracking-[0.12em] font-semibold text-[color:var(--text-3)]">
            Avg Win
          </div>
        </div>
      </div>

      {list.map((p, i) => (
        <BuilderRow
          key={p.id}
          gameId={gameId}
          index={i + 1}
          player={p}
          rec={winPcts[p.id]}
        />
      ))}

      {remaining > 0 && (
        <div
          className="mt-1 rounded-[10px] px-3 py-2.5 text-center text-[12px] text-[color:var(--text-3)]"
          style={{ outline: "1px dashed var(--hairline-2)", outlineOffset: "-1px" }}
        >
          Add {remaining} more to fill the {perSide}-on-{perSide} roster
        </div>
      )}
    </div>
  );
}

export function RosterBuilder({
  gameId,
  teamAName,
  teamBName,
  format,
  eligible,
  rosterA,
  rosterB,
  winPcts,
  previousGame,
}: {
  gameId: string;
  teamAName: string;
  teamBName: string;
  format: string;
  eligible: { id: string; firstName: string; lastName: string }[];
  rosterA: { id: string; firstName: string; lastName: string }[];
  rosterB: { id: string; firstName: string; lastName: string }[];
  winPcts: Record<string, WinRec>;
  previousGame?: { id: string; date: string | null; rosterCount: number } | null;
}) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [side, setSide] = useState<"A" | "B">("A");
  const [adding, startAdd] = useTransition();
  const [loadingPrev, startLoad] = useTransition();
  const [clearing, startClear] = useTransition();
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const perSide = format.startsWith("3v3") ? 3 : 5;
  const whiteAvg = teamAvg(rosterA, winPcts);
  const darkAvg = teamAvg(rosterB, winPcts);
  const total = (whiteAvg ?? 0) + (darkAvg ?? 0);
  const whiteShare = total > 0 ? ((whiteAvg ?? 0) / total) * 100 : 50;
  const hasRoster = rosterA.length + rosterB.length > 0;

  const add = () =>
    startAdd(async () => {
      if (!playerId) return;
      setError(null);
      try {
        const res = await setGameRosterPlayer(gameId, playerId, side);
        if (res.ok) {
          setPlayerId("");
          router.refresh();
        } else setError(res.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add player.");
      }
    });

  const loadPrev = () =>
    startLoad(async () => {
      setError(null);
      setConfirmClear(false);
      try {
        const res = await loadPreviousGameRoster(gameId);
        if (res.ok) router.refresh();
        else setError(res.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load teams.");
      }
    });

  const clearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    startClear(async () => {
      setError(null);
      try {
        const res = await clearGameRoster(gameId);
        setConfirmClear(false);
        if (res.ok) router.refresh();
        else setError(res.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not clear roster.");
      }
    });
  };

  return (
    <div className="rounded-[16px] bg-[color:var(--surface)] overflow-hidden shadow-[inset_0_0_0_1px_var(--hairline-2)]">
      {/* Header band */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 flex-wrap shadow-[inset_0_-1px_0_0_var(--hairline)]">
        <span className="font-extrabold text-[16px] text-[color:var(--text)]">
          Build game rosters
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          {previousGame && (
            <button
              type="button"
              onClick={loadPrev}
              disabled={loadingPrev}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--r-md)] text-[12px] font-semibold text-[color:var(--text-2)] hover:text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-soft)] transition-colors disabled:opacity-60 shadow-[inset_0_0_0_1px_var(--hairline-2)]"
            >
              <Copy size={13} strokeWidth={2.25} />
              {loadingPrev ? "Loading…" : `Load previous teams · ${previousGame.rosterCount}`}
            </button>
          )}
          {hasRoster && (
            <button
              type="button"
              onClick={clearAll}
              disabled={clearing}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--r-md)] text-[12px] font-semibold transition-colors disabled:opacity-60 ${
                confirmClear
                  ? "bg-[color:var(--down-soft)] text-[color:var(--down)]"
                  : "text-[color:var(--text-2)] hover:text-[color:var(--down)] shadow-[inset_0_0_0_1px_var(--hairline-2)]"
              }`}
            >
              <Trash2 size={13} strokeWidth={2.25} />
              {clearing ? "Clearing…" : confirmClear ? "Confirm clear all?" : "Clear all"}
            </button>
          )}
        </div>
      </div>

      {/* Add controls band */}
      <div className="flex items-center gap-2 px-5 py-3 bg-[color:var(--surface-2)] flex-wrap max-sm:flex-col max-sm:items-stretch shadow-[inset_0_-1px_0_0_var(--hairline)]">
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="flex-1 min-w-[180px] h-10 rounded-[var(--r-lg)] bg-[color:var(--surface)] px-3 text-[14px] outline-none cursor-pointer shadow-[inset_0_0_0_1px_var(--hairline-2)]"
        >
          <option value="">Select a league member…</option>
          {eligible.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
        <div className="inline-flex items-center gap-1 p-1 rounded-[var(--r-lg)] bg-[color:var(--surface)] shadow-[inset_0_0_0_1px_var(--hairline-2)]">
          <button
            type="button"
            onClick={() => setSide("A")}
            className={`h-8 px-3.5 rounded-[8px] text-[12px] font-bold transition-colors ${
              side === "A"
                ? "bg-[color:var(--surface-2)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_var(--hairline-2)]"
                : "text-[color:var(--text-3)] hover:text-[color:var(--text)]"
            }`}
          >
            {teamAName}
          </button>
          <button
            type="button"
            onClick={() => setSide("B")}
            className={`h-8 px-3.5 rounded-[8px] text-[12px] font-bold transition-colors ${
              side === "B"
                ? "text-[color:var(--tb-dark-fg)]"
                : "text-[color:var(--text-3)] hover:text-[color:var(--text)]"
            }`}
            style={side === "B" ? { background: "var(--tb-dark-bg)" } : undefined}
          >
            {teamBName}
          </button>
        </div>
        <button
          type="button"
          disabled={!playerId || adding}
          onClick={add}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] disabled:opacity-60"
        >
          <Plus size={14} strokeWidth={2.5} /> {adding ? "Adding…" : "Add player"}
        </button>
      </div>

      {/* Team strength bar */}
      <div className="px-5 py-3 shadow-[inset_0_-1px_0_0_var(--hairline)]">
        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className="font-semibold num text-[color:var(--brand-ink)]">
            {teamAName} · {whiteAvg !== null ? `${whiteAvg.toFixed(1)}%` : "—"} avg
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[color:var(--text-3)]">
            Team Strength
          </span>
          <span className="num font-semibold text-[color:var(--text-2)]">
            {teamBName} · {darkAvg !== null ? `${darkAvg.toFixed(1)}%` : "—"} avg
          </span>
        </div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[color:var(--hairline)]">
          <div style={{ width: `${whiteShare}%` }} className="bg-[color:var(--brand)]" />
          <div style={{ width: `${100 - whiteShare}%`, background: "var(--tb-dark-bg)" }} />
        </div>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 max-md:grid-cols-1">
        <TeamColumn
          gameId={gameId}
          team="white"
          name={teamAName}
          list={rosterA}
          avg={whiteAvg}
          perSide={perSide}
          winPcts={winPcts}
          divider
        />
        <TeamColumn
          gameId={gameId}
          team="dark"
          name={teamBName}
          list={rosterB}
          avg={darkAvg}
          perSide={perSide}
          winPcts={winPcts}
          divider={false}
        />
      </div>

      {error && (
        <div className="mx-5 mb-4 text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}

export function GameMetaEditor({ detail }: { detail: GameDetail }) {
  const router = useRouter();
  const { game } = detail;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isTeamGame = !game.leagueId && !!(game.teamAId || game.teamBId);
  const [gameType, setGameType] = useState<"exhibition" | "tournament">(
    game.gameType === "tournament" ? "tournament" : "exhibition",
  );

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
          {isTeamGame && (
            <Field label="Game type">
              <select
                name="gameType"
                value={gameType}
                onChange={(e) =>
                  setGameType(e.target.value as "exhibition" | "tournament")
                }
                className={selectCx}
              >
                <option value="exhibition">Exhibition</option>
                <option value="tournament">Tournament</option>
              </select>
            </Field>
          )}
          {isTeamGame && gameType === "tournament" && (
            <>
              <Field label="Tournament name">
                <input
                  name="tournamentName"
                  type="text"
                  defaultValue={game.tournamentName ?? ""}
                  maxLength={120}
                  placeholder="e.g. Tennessee Senior Olympics"
                  className={inputCx}
                />
              </Field>
              <Field label="Round">
                <select
                  name="tournamentRound"
                  defaultValue={game.tournamentRound ?? ""}
                  className={selectCx}
                >
                  <option value="">Select round…</option>
                  <option value="Seeding Game">Seeding Game</option>
                  <option value="Quarterfinals">Quarterfinals</option>
                  <option value="Semifinals">Semifinals</option>
                  <option value="Championship">Championship</option>
                </select>
              </Field>
            </>
          )}
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
              className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] disabled:opacity-60"
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
                className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--down)] text-white font-bold text-[13px] disabled:opacity-60"
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
