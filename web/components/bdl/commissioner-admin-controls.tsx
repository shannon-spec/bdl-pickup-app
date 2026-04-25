"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { addCommissioner, removeCommissioner } from "@/lib/actions/leagues";

type PlayerLite = { id: string; firstName: string; lastName: string };

export function CommissionerAdminControls({
  leagueId,
  commissioners,
  eligible,
}: {
  leagueId: string;
  commissioners: PlayerLite[];
  eligible: PlayerLite[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [pending, start] = useTransition();

  const onAdd = () => {
    if (!selected) return;
    start(async () => {
      const res = await addCommissioner(leagueId, selected);
      if (res.ok) {
        setSelected("");
        router.refresh();
      }
    });
  };

  const onRemove = (id: string) => {
    start(async () => {
      const res = await removeCommissioner(leagueId, id);
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="mt-4 pt-4 border-t border-[color:var(--hairline)] flex flex-col gap-3">
      {commissioners.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {commissioners.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={pending}
              onClick={() => onRemove(c.id)}
              className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full bg-[color:var(--surface-2)] border border-[color:var(--hairline)] text-[11.5px] text-[color:var(--text-2)] hover:text-[color:var(--down)] hover:bg-[color:var(--down-soft)] hover:border-[color:var(--down)] transition-colors disabled:opacity-60"
              title={`Remove ${c.firstName} ${c.lastName}`}
            >
              {c.firstName} {c.lastName}
              <X size={12} />
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={eligible.length === 0 || pending}
          className="flex-1 h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none cursor-pointer disabled:opacity-60"
          aria-label="Pick a player to make commissioner"
        >
          <option value="">
            {eligible.length === 0 ? "No eligible players" : "Add a commissioner…"}
          </option>
          {eligible.map((p) => (
            <option key={p.id} value={p.id}>
              {p.lastName}, {p.firstName}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onAdd}
          disabled={!selected || pending}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
        >
          <Plus size={14} strokeWidth={2.5} /> {pending ? "Adding…" : "Add Commissioner"}
        </button>
      </div>
    </div>
  );
}
