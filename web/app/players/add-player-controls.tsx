"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createPlayerInDirectory } from "@/lib/actions/roster";

type LeagueOpt = { id: string; name: string };

export function AddPlayerControls({ leagues }: { leagues: LeagueOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [cell, setCell] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setFirst("");
    setLast("");
    setEmail("");
    setCell("");
    setLeagueId("");
    setError(null);
  };
  const close = () => {
    setOpen(false);
    reset();
  };

  const onSubmit = () => {
    setError(null);
    if (!first.trim() || !last.trim()) {
      setError("First and last name are required.");
      return;
    }
    const fd = new FormData();
    fd.set("firstName", first.trim());
    fd.set("lastName", last.trim());
    if (email.trim()) fd.set("email", email.trim());
    if (cell.trim()) fd.set("cell", cell.trim());
    if (leagueId) fd.set("leagueId", leagueId);
    start(async () => {
      const res = await createPlayerInDirectory(fd);
      if (!res.ok) {
        const fieldMsg =
          res.fieldErrors &&
          Object.values(res.fieldErrors).flat().filter(Boolean)[0];
        setError(fieldMsg ?? res.error);
        return;
      }
      close();
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)]"
      >
        <Plus size={14} strokeWidth={2.5} /> Add Player
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center px-4"
          style={{ background: "var(--overlay)" }}
          onClick={close}
        >
          <div
            className="w-full max-w-[480px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[18px] font-bold tracking-[-0.01em]">Add a player</h3>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[color:var(--text-3)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)]"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-[12.5px] text-[color:var(--text-3)] -mt-1">
              Creates a player in the BDL Universe directly. Pick a league
              to assign them, or leave it on{" "}
              <strong className="text-[color:var(--text-2)]">No league</strong>{" "}
              and they&apos;ll be added later.
            </p>

            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <Field label="First name *">
                <input
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                  maxLength={60}
                  disabled={pending}
                  autoFocus
                  className={inputCx}
                />
              </Field>
              <Field label="Last name *">
                <input
                  value={last}
                  onChange={(e) => setLast(e.target.value)}
                  maxLength={60}
                  disabled={pending}
                  className={inputCx}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={120}
                  disabled={pending}
                  className={inputCx}
                />
              </Field>
              <Field label="Cell">
                <input
                  value={cell}
                  onChange={(e) => setCell(e.target.value)}
                  maxLength={40}
                  disabled={pending}
                  className={inputCx}
                />
              </Field>
              <Field label="League" full>
                <select
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  disabled={pending}
                  className={`${inputCx} cursor-pointer`}
                >
                  <option value="">No league — BDL Universe only</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {error && (
              <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={pending}
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
              >
                <Plus size={14} strokeWidth={2.5} />
                {pending ? "Adding…" : "Add player"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputCx =
  "h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] disabled:opacity-60";

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "col-span-2 max-sm:col-span-1" : ""}`}>
      <span className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
        {label}
      </span>
      {children}
    </label>
  );
}
