"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { LeagueDetail } from "@/lib/queries/leagues";
import {
  addCommissioner,
  addLeaguePlayer,
  deleteLeague,
  removeCommissioner,
  removeLeaguePlayer,
} from "@/lib/actions/leagues";
import { LeagueSheet } from "../league-sheet";
import { Pill } from "@/components/bdl/pill";

type PlayerLite = { id: string; firstName: string; lastName: string };

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] transition-colors text-[14px]">
      {children}
    </div>
  );
}

export function LeagueDetailClient({ detail }: { detail: LeagueDetail }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onDelete = () => {
    setError(null);
    start(async () => {
      const res = await deleteLeague(detail.league.id);
      if (res.ok) router.push("/leagues");
      else setError(res.error);
    });
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2 -mt-2">
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-medium hover:bg-[color:var(--surface-2)]"
        >
          <Pencil size={14} /> Edit
        </button>
        <button
          type="button"
          onClick={() => setConfirmDel(true)}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-medium text-[color:var(--down)] hover:bg-[color:var(--down-soft)]"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      <LeagueSheet
        mode={editOpen ? { kind: "edit", row: detail.league } : { kind: "closed" }}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          router.refresh();
        }}
      />

      {confirmDel && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center px-4 bg-black/60"
          onClick={() => setConfirmDel(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[18px] font-bold mb-2">Delete this league?</h3>
            <p className="text-[13px] text-[color:var(--text-3)]">
              All games and roster assignments for {detail.league.name} will be deleted. This
              can&apos;t be undone.
            </p>
            {error && (
              <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2 mt-3">
                {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmDel(false)}
                className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--down)] text-white font-bold text-[12px] tracking-[0.06em] uppercase disabled:opacity-60"
              >
                {pending ? "Deleting…" : "Delete league"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

LeagueDetailClient.MemberRow = function MemberRow({
  leagueId,
  player,
}: {
  leagueId: string;
  player: LeagueDetail["members"][number];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Row>
      <div className="min-w-0">
        <div className="font-bold text-[color:var(--text)] truncate">
          {player.lastName}, {player.firstName}
        </div>
        <div className="text-[11.5px] text-[color:var(--text-3)] mt-0.5 flex items-center gap-2">
          <Pill tone={player.status === "Active" ? "win" : player.status === "IR" ? "loss" : "neutral"}>
            {player.status}
          </Pill>
          <span>{player.level}</span>
        </div>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await removeLeaguePlayer(leagueId, player.id);
            if (res.ok) router.refresh();
          })
        }
        aria-label={`Remove ${player.firstName} ${player.lastName}`}
        className="w-9 h-9 inline-flex items-center justify-center rounded-[var(--r-md)] text-[color:var(--text-3)] hover:text-[color:var(--down)] hover:bg-[color:var(--down-soft)] disabled:opacity-60"
      >
        <X size={16} />
      </button>
    </Row>
  );
};

LeagueDetailClient.CommissionerRow = function CommissionerRow({
  leagueId,
  player,
}: {
  leagueId: string;
  player: LeagueDetail["commissioners"][number];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Row>
      <div className="font-bold text-[color:var(--text)]">
        {player.firstName} {player.lastName}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await removeCommissioner(leagueId, player.id);
            if (res.ok) router.refresh();
          })
        }
        aria-label={`Remove ${player.firstName} ${player.lastName}`}
        className="w-9 h-9 inline-flex items-center justify-center rounded-[var(--r-md)] text-[color:var(--text-3)] hover:text-[color:var(--down)] hover:bg-[color:var(--down-soft)] disabled:opacity-60"
      >
        <X size={16} />
      </button>
    </Row>
  );
};

LeagueDetailClient.AddMember = function AddMember({
  leagueId,
  allPlayers,
  excludeIds,
}: {
  leagueId: string;
  allPlayers: PlayerLite[];
  excludeIds: string[];
}) {
  return (
    <PlayerAdder
      leagueId={leagueId}
      allPlayers={allPlayers}
      excludeIds={excludeIds}
      label="Add Member"
      onAction={addLeaguePlayer}
    />
  );
};

LeagueDetailClient.AddCommissioner = function AddCommish({
  leagueId,
  allPlayers,
  excludeIds,
}: {
  leagueId: string;
  allPlayers: PlayerLite[];
  excludeIds: string[];
}) {
  return (
    <PlayerAdder
      leagueId={leagueId}
      allPlayers={allPlayers}
      excludeIds={excludeIds}
      label="Add Commissioner"
      onAction={addCommissioner}
    />
  );
};

function PlayerAdder({
  leagueId,
  allPlayers,
  excludeIds,
  label,
  onAction,
}: {
  leagueId: string;
  allPlayers: PlayerLite[];
  excludeIds: string[];
  label: string;
  onAction: (leagueId: string, playerId: string) => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("");
  const [pending, start] = useTransition();
  const eligible = allPlayers.filter((p) => !excludeIds.includes(p.id));

  if (eligible.length === 0) return null;

  return (
    <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="flex-1 h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-3 text-[14px] outline-none cursor-pointer"
      >
        <option value="">Select a player…</option>
        {eligible.map((p) => (
          <option key={p.id} value={p.id}>
            {p.lastName}, {p.firstName}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selected || pending}
        onClick={() =>
          start(async () => {
            if (!selected) return;
            const res = await onAction(leagueId, selected);
            if (res.ok) {
              setSelected("");
              router.refresh();
            }
          })
        }
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[#DC3D14] text-white font-bold text-[12px] tracking-[0.06em] uppercase disabled:opacity-60"
      >
        <Plus size={14} strokeWidth={2.5} /> {pending ? "Adding…" : label}
      </button>
    </div>
  );
}

