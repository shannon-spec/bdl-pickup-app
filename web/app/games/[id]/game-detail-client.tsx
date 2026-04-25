"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { GameDetail } from "@/lib/queries/games";
import { deleteGame, setGameRosterPlayer, setGameScore } from "@/lib/actions/games";

export function GameScore({ detail }: { detail: GameDetail }) {
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
};

export function RosterRow({
  gameId,
  playerId,
  name,
  currentSide,
}: {
  gameId: string;
  playerId: string;
  name: string;
  currentSide: "A" | "B" | "invited";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] text-[14px]">
      <Link
        href={`/players/${playerId}`}
        className="font-bold hover:text-[color:var(--brand)]"
      >
        {name}
      </Link>
      <div className="flex items-center gap-1.5">
        {(["A", "B", "invited"] as const).map((s) =>
          s === currentSide ? null : (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await setGameRosterPlayer(gameId, playerId, s);
                  if (res.ok) router.refresh();
                })
              }
              className="text-[10.5px] font-semibold uppercase tracking-[0.06em] px-2.5 py-1 rounded-full border border-[color:var(--hairline-2)] text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] disabled:opacity-60"
            >
              → {s === "invited" ? "Invited" : s === "A" ? "Team A" : "Team B"}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await setGameRosterPlayer(gameId, playerId, null);
              if (res.ok) router.refresh();
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
}: {
  gameId: string;
  eligible: { id: string; firstName: string; lastName: string }[];
  allLeagues: { id: string; name: string }[];
  currentLeagueId: string | null;
}) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [side, setSide] = useState<"A" | "B" | "invited">("A");
  const [pending, start] = useTransition();

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
    <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
      <select
        value={playerId}
        onChange={(e) => setPlayerId(e.target.value)}
        className="flex-1 h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-3 text-[14px] outline-none cursor-pointer"
      >
        <option value="">Select a league member…</option>
        {eligible.map((p) => (
          <option key={p.id} value={p.id}>
            {p.lastName}, {p.firstName}
          </option>
        ))}
      </select>
      <select
        value={side}
        onChange={(e) => setSide(e.target.value as typeof side)}
        className="h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-3 text-[14px] outline-none cursor-pointer"
      >
        <option value="A">Team A</option>
        <option value="B">Team B</option>
        <option value="invited">Invited</option>
      </select>
      <button
        type="button"
        disabled={!playerId || pending}
        onClick={() =>
          start(async () => {
            if (!playerId) return;
            const res = await setGameRosterPlayer(gameId, playerId, side);
            if (res.ok) {
              setPlayerId("");
              router.refresh();
            }
          })
        }
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase disabled:opacity-60"
      >
        <Plus size={14} strokeWidth={2.5} /> {pending ? "Adding…" : "Add"}
      </button>
    </div>
  );
};

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
