"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus, X } from "lucide-react";
import {
  addLeagueSideRosterPlayer,
  createAndAddLeagueSideMember,
  removeLeagueSideRosterPlayer,
} from "@/lib/actions/league-teams";

type PlayerLite = { id: string; firstName: string; lastName: string };

/** Regular-roster management for a league side. Mirrors TeamRosterControls. */
export function LeagueSideRosterControls({
  leagueId,
  side,
  members,
  eligible,
}: {
  leagueId: string;
  side: string;
  members: PlayerLite[];
  eligible: PlayerLite[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onAdd = () => {
    if (!selected) return;
    start(async () => {
      const res = await addLeagueSideRosterPlayer(leagueId, side, selected);
      if (res.ok) {
        setSelected("");
        router.refresh();
      } else setError(res.error);
    });
  };

  const onCreate = () => {
    if (!first.trim() || !last.trim()) return;
    setError(null);
    const fd = new FormData();
    fd.set("firstName", first.trim());
    fd.set("lastName", last.trim());
    start(async () => {
      const res = await createAndAddLeagueSideMember(leagueId, side, fd);
      if (res.ok) {
        setFirst("");
        setLast("");
        setCreating(false);
        router.refresh();
      } else setError(res.error);
    });
  };

  const onRemove = (id: string) => {
    start(async () => {
      const res = await removeLeagueSideRosterPlayer(leagueId, side, id);
      if (res.ok) router.refresh();
    });
  };

  const input =
    "h-10 rounded-[var(--r-lg)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)] disabled:opacity-60";
  const ghost =
    "inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-[var(--r-lg)] bg-[color:var(--surface)] text-[12px] font-medium hover:bg-[color:var(--surface-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)]";
  const primary =
    "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] disabled:opacity-60";

  return (
    <div className="mt-3 flex flex-col gap-3">
      {!creating ? (
        <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={eligible.length === 0 || pending}
            className={`flex-1 cursor-pointer ${input}`}
            aria-label="Pick a player to add"
          >
            <option value="">
              {eligible.length === 0 ? "No eligible league members" : "Add a player…"}
            </option>
            {eligible.map((p) => (
              <option key={p.id} value={p.id}>
                {p.lastName}, {p.firstName}
              </option>
            ))}
          </select>
          <button type="button" onClick={onAdd} disabled={!selected || pending} className={primary}>
            <Plus size={14} strokeWidth={2.5} /> {pending ? "Adding…" : "Add player"}
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={ghost}
            title="Create a new player and add them"
          >
            <UserPlus size={14} /> New
          </button>
          {members.length > 0 && (
            <button type="button" onClick={() => setRemoving((r) => !r)} className={ghost}>
              {removing ? "Done" : "Remove…"}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
          <input
            type="text"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            placeholder="First name"
            disabled={pending}
            className={`flex-1 ${input}`}
            aria-label="First name"
            maxLength={60}
          />
          <input
            type="text"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            placeholder="Last name"
            disabled={pending}
            className={`flex-1 ${input}`}
            aria-label="Last name"
            maxLength={60}
          />
          <button type="button" onClick={onCreate} disabled={!first.trim() || !last.trim() || pending} className={primary}>
            <UserPlus size={14} strokeWidth={2.5} /> {pending ? "Creating…" : "Create + add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setError(null);
            }}
            disabled={pending}
            className={ghost}
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}

      {removing && members.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={pending}
              onClick={() => onRemove(m.id)}
              className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full bg-[color:var(--surface-2)] text-[11.5px] text-[color:var(--text-2)] hover:text-[color:var(--down)] hover:bg-[color:var(--down-soft)] transition-colors disabled:opacity-60"
              title={`Remove ${m.firstName} ${m.lastName}`}
            >
              {m.firstName} {m.lastName}
              <X size={12} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
