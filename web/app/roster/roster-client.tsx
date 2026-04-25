"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, X, MoreVertical, Pencil, Trash2 } from "lucide-react";
import type { RosterRow } from "@/lib/queries/roster";
import { Pill } from "@/components/bdl/pill";
import { PlayerSheet } from "./player-sheet";
import { ConfirmDelete } from "./confirm-delete";

type Mode = { kind: "closed" } | { kind: "create" } | { kind: "edit"; row: RosterRow };

export function RosterClient({
  initialRows,
  initialQuery,
}: {
  initialRows: RosterRow[];
  initialQuery: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<Mode>({ kind: "closed" });
  const [confirm, setConfirm] = useState<RosterRow | null>(null);
  const [pending, start] = useTransition();

  // Debounced URL sync — pushes ?q=… and lets the server re-render.
  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query) next.set("q", query);
      else next.delete("q");
      const qs = next.toString();
      start(() => {
        router.replace(qs ? `/roster?${qs}` : "/roster", { scroll: false });
      });
    }, 250);
    return () => clearTimeout(id);
    // We deliberately don't include router/params/start to avoid loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const rows = useMemo(() => initialRows, [initialRows]);

  return (
    <>
      <div className="flex items-center gap-3 max-sm:flex-col max-sm:items-stretch">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-3)]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, city…"
            className="w-full h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] pl-9 pr-9 text-[14px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] transition-colors"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-3)] hover:text-[color:var(--text)]"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMode({ kind: "create" })}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[#DC3D14] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] transition-colors"
        >
          <Plus size={14} strokeWidth={2.5} /> Add Player
        </button>
      </div>

      {/* Desktop table */}
      <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden max-sm:hidden">
        <div
          aria-busy={pending}
          className={`grid grid-cols-[2fr_2fr_1fr_1fr_1fr_72px] px-5 py-3 border-b border-[color:var(--hairline)] text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] ${
            pending ? "opacity-60" : ""
          }`}
        >
          <span>Name</span>
          <span>Contact</span>
          <span>City</span>
          <span>Pos</span>
          <span>Status</span>
          <span></span>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-[color:var(--text-3)] text-[14px]">
            No players found.
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_72px] items-center px-5 py-3 border-t border-[color:var(--hairline)] hover:bg-[color:var(--surface-2)] transition-colors text-[14px]"
            >
              <Link
                href={`/players/${r.id}`}
                className="font-bold text-[color:var(--text)] hover:text-[color:var(--brand)] truncate"
              >
                {r.lastName}, {r.firstName}
              </Link>
              <span className="text-[color:var(--text-3)] text-[12.5px] truncate">
                {r.email || r.cell || "—"}
              </span>
              <span className="text-[color:var(--text-2)] text-[12.5px]">
                {r.city ? `${r.city}${r.state ? `, ${r.state}` : ""}` : "—"}
              </span>
              <span className="text-[color:var(--text-2)] text-[12.5px]">{r.position || "—"}</span>
              <span>
                <StatusPill status={r.status} />
              </span>
              <span className="flex items-center justify-end gap-1">
                <RowAction onEdit={() => setMode({ kind: "edit", row: r })} onDelete={() => setConfirm(r)} />
              </span>
            </div>
          ))
        )}
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden flex flex-col gap-2">
        {rows.length === 0 ? (
          <div className="rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-4 py-10 text-center text-[14px] text-[color:var(--text-3)]">
            No players found.
          </div>
        ) : (
          rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setMode({ kind: "edit", row: r })}
              className="text-left rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-4 py-3 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[15px]">
                  {r.lastName}, {r.firstName}
                </span>
                <StatusPill status={r.status} />
              </div>
              <div className="text-[12.5px] text-[color:var(--text-3)] flex flex-wrap gap-x-3 gap-y-0.5">
                {r.position && <span>{r.position}</span>}
                {r.city && (
                  <span>
                    {r.city}
                    {r.state ? `, ${r.state}` : ""}
                  </span>
                )}
                {r.email && <span>{r.email}</span>}
              </div>
            </button>
          ))
        )}
      </div>

      <PlayerSheet
        mode={mode}
        onClose={() => setMode({ kind: "closed" })}
        onSaved={() => {
          setMode({ kind: "closed" });
          router.refresh();
        }}
      />

      {confirm && (
        <ConfirmDelete
          player={confirm}
          onClose={() => setConfirm(null)}
          onDeleted={() => {
            setConfirm(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function StatusPill({ status }: { status: RosterRow["status"] }) {
  switch (status) {
    case "Active":
      return <Pill tone="win" dot>Active</Pill>;
    case "Inactive":
      return <Pill tone="neutral">Inactive</Pill>;
    case "IR":
      return <Pill tone="loss">IR</Pill>;
  }
}

function RowAction({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);
  return (
    <span className="relative">
      <button
        type="button"
        aria-label="Row actions"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--r-md)] text-[color:var(--text-3)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)]"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <span
          className="absolute right-0 mt-1 z-[var(--z-popover)] flex flex-col min-w-[140px] rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] shadow-md py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[color:var(--surface-2)]"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex items-center gap-2 px-3 py-2 text-left text-[13px] text-[color:var(--down)] hover:bg-[color:var(--surface-2)]"
          >
            <Trash2 size={14} /> Delete
          </button>
        </span>
      )}
    </span>
  );
}
