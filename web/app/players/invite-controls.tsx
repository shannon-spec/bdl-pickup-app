"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Send, UserPlus, X } from "lucide-react";
import { createInvite } from "@/lib/actions/invites";

type LeagueOpt = { id: string; name: string };

export function InviteControls({ leagues }: { leagues: LeagueOpt[] }) {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [leagueId, setLeagueId] = useState(leagues[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  if (leagues.length === 0) return null;

  const reset = () => {
    setFirst("");
    setLast("");
    setEmail("");
    setLeagueId(leagues[0]?.id ?? "");
    setError(null);
    setLink(null);
    setCopied(false);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const onSubmit = () => {
    setError(null);
    if (!first.trim() || !last.trim() || !email.trim() || !leagueId) {
      setError("First name, last name, email, and league are required.");
      return;
    }
    const fd = new FormData();
    fd.set("firstName", first.trim());
    fd.set("lastName", last.trim());
    fd.set("email", email.trim());
    fd.set("leagueId", leagueId);
    start(async () => {
      const res = await createInvite(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const url = `${window.location.origin}/invite/${res.data!.id}`;
      setLink(url);
    });
  };

  const onCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — fall through, the input is selectable
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)]"
      >
        <UserPlus size={14} strokeWidth={2.5} /> Invite Player
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
            className="w-full max-w-[460px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[18px] font-bold tracking-[-0.01em]">Invite a player</h3>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[color:var(--text-3)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)]"
              >
                <X size={16} />
              </button>
            </div>

            {!link ? (
              <>
                <p className="text-[12.5px] text-[color:var(--text-3)] -mt-2">
                  Creates a player record and a one-tap invite link. Share the
                  link directly — they accept on the page and join the league.
                </p>
                <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                  <Field label="First name">
                    <input
                      value={first}
                      onChange={(e) => setFirst(e.target.value)}
                      maxLength={60}
                      disabled={pending}
                      className={inputCx}
                    />
                  </Field>
                  <Field label="Last name">
                    <input
                      value={last}
                      onChange={(e) => setLast(e.target.value)}
                      maxLength={60}
                      disabled={pending}
                      className={inputCx}
                    />
                  </Field>
                  <Field label="Email" full>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={120}
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
                    <Send size={14} strokeWidth={2.5} />
                    {pending ? "Creating…" : "Create + get link"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[12.5px] text-[color:var(--text-3)] -mt-2">
                  Share this link with {first} {last}. It walks them through
                  finishing their profile and joins them to the league.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={link}
                    onFocus={(e) => e.currentTarget.select()}
                    className={`${inputCx} flex-1 font-[family-name:var(--mono)] text-[12px]`}
                  />
                  <button
                    type="button"
                    onClick={onCopy}
                    className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-[var(--r-lg)] bg-[color:var(--surface-2)] border border-[color:var(--hairline-2)] text-[12px] font-bold uppercase tracking-[0.06em] hover:bg-[color:var(--surface)]"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={reset}
                    className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
                  >
                    Invite another
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)]"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
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
