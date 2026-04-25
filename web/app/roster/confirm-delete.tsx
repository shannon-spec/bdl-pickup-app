"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import type { RosterRow } from "@/lib/queries/roster";
import { deletePlayer } from "@/lib/actions/roster";

export function ConfirmDelete({
  player,
  onClose,
  onDeleted,
}: {
  player: RosterRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onConfirm = () => {
    setError(null);
    start(async () => {
      const result = await deletePlayer(player.id);
      if (result.ok) onDeleted();
      else setError(result.error);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm delete"
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center px-4 bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <span className="w-12 h-12 inline-flex items-center justify-center rounded-full bg-[color:var(--down-soft)] text-[color:var(--down)]">
            <AlertTriangle size={22} />
          </span>
          <h3 className="text-[18px] font-bold tracking-[-0.02em]">
            Remove {player.firstName} {player.lastName}?
          </h3>
          <p className="text-[13px] text-[color:var(--text-3)]">
            This removes the player from the roster, all leagues, and all game rosters.
            This action can&apos;t be undone.
          </p>
          {error && (
            <div className="w-full text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2 text-left">
              {error}
            </div>
          )}
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--down)] hover:opacity-90 text-white font-bold text-[12px] tracking-[0.06em] uppercase disabled:opacity-60"
          >
            {pending ? "Removing…" : "Remove player"}
          </button>
        </div>
      </div>
    </div>
  );
}
