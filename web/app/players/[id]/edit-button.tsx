"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { Player } from "@/lib/db";
import { PlayerSheet } from "@/app/roster/player-sheet";
import { ConfirmDelete } from "@/app/roster/confirm-delete";

export function EditPlayerButton({ player }: { player: Player }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // Map the full Player to the RosterRow shape the sheet expects.
  const row = {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    email: player.email,
    cell: player.cell,
    city: player.city,
    state: player.state,
    position: player.position,
    level: player.level,
    status: player.status,
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-medium hover:bg-[color:var(--surface-2)]"
        >
          <Pencil size={14} /> Edit
        </button>
      </div>

      <PlayerSheet
        mode={open ? { kind: "edit", row } : { kind: "closed" }}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />

      {confirmDel && (
        <ConfirmDelete
          player={row}
          onClose={() => setConfirmDel(false)}
          onDeleted={() => {
            setConfirmDel(false);
            router.push("/roster");
          }}
        />
      )}
    </>
  );
}
