"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { League } from "@/lib/db";
import { LeagueForm } from "./league-form";

type Mode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; row: League };

/**
 * Right-side sheet for the create flow. The edit flow has been promoted
 * to its own full page at /leagues/[id]/edit; this sheet now only
 * handles "Add League" but remains capable of edit mode for callers
 * that haven't migrated.
 */
export function LeagueSheet({
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

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "Edit league" : "Add league"}
      className="fixed inset-0 z-[var(--z-modal)] flex"
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
              {editing ? "Edit League" : "Add League"}
            </div>
            {editing && <div className="font-bold text-[16px] mt-0.5">{editing.name}</div>}
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <LeagueForm editing={editing} onCancel={onClose} onSaved={onSaved} />
        </div>
      </aside>
    </div>
  );
}
