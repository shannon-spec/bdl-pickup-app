"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, RefreshCw, Search, Shuffle, X } from "lucide-react";
import { Pill } from "@/components/bdl/pill";
import {
  setPlayerCredentials,
  clearPlayerCredentials,
} from "@/lib/actions/credentials";

export type CredRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  username: string | null;
  hasPassword: boolean;
  isCommissioner: boolean;
  leagueNames: string[];
};

export function CredentialsTable({ rows }: { rows: CredRow[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "set" | "unset" | "commish">("all");
  const [editing, setEditing] = useState<CredRow | null>(null);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "set" && !r.hasPassword) return false;
      if (filter === "unset" && r.hasPassword) return false;
      if (filter === "commish" && !r.isCommissioner) return false;
      if (!ql) return true;
      return (
        r.firstName.toLowerCase().includes(ql) ||
        r.lastName.toLowerCase().includes(ql) ||
        (r.email ?? "").toLowerCase().includes(ql) ||
        (r.username ?? "").toLowerCase().includes(ql)
      );
    });
  }, [rows, q, filter]);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-4)]"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email, or username"
            className="w-full h-10 pl-9 pr-3 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[14px] outline-none"
          />
        </div>
        <Pillish active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Pillish>
        <Pillish active={filter === "set"} onClick={() => setFilter("set")}>
          Has login
        </Pillish>
        <Pillish active={filter === "unset"} onClick={() => setFilter("unset")}>
          No login
        </Pillish>
        <Pillish active={filter === "commish"} onClick={() => setFilter("commish")}>
          Commissioners
        </Pillish>
      </div>

      <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-8 text-center text-[color:var(--text-3)] text-[13px]">
            No players match.
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 border-t border-[color:var(--hairline)] first:border-t-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[14px]">
                    {r.firstName} {r.lastName}
                  </span>
                  {r.isCommissioner && (
                    <Pill tone="brand">Commissioner</Pill>
                  )}
                  {r.hasPassword ? (
                    <Pill tone="win" dot>
                      Login set
                    </Pill>
                  ) : (
                    <Pill tone="neutral">No login</Pill>
                  )}
                  {r.hasPassword && !r.email && (
                    /* Locked out of Forgot Password — flag it so the
                       admin can fix the email on this row. */
                    <Pill tone="loss">No email</Pill>
                  )}
                </div>
                <div className="text-[12px] text-[color:var(--text-3)] mt-0.5 truncate">
                  {r.username ? (
                    <>
                      <span className="font-[family-name:var(--mono)]">@{r.username}</span>
                      {r.email ? <span> · {r.email}</span> : null}
                    </>
                  ) : (
                    <>{r.email ?? "—"}</>
                  )}
                  {r.leagueNames.length > 0 && (
                    <span> · {r.leagueNames.join(", ")}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-bold uppercase tracking-[0.06em] hover:bg-[color:var(--surface-2)]"
                >
                  {r.hasPassword ? (
                    <>
                      <RefreshCw size={13} /> Reset
                    </>
                  ) : (
                    <>
                      <KeyRound size={13} /> Set login
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {editing && (
        <CredentialModal
          player={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function Pillish({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center h-8 px-3 rounded-full text-[12px] font-semibold tracking-[0.04em] uppercase transition-colors border ${
        active
          ? "bg-[color:var(--brand)] text-white border-transparent"
          : "bg-[color:var(--surface)] border-[color:var(--hairline-2)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

function suggestUsername(first: string, last: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${slug(first)}.${slug(last)}`.replace(/^\.|\.$/g, "");
}

function generatePassword(): string {
  // Reasonable temp password: 12 chars from a friendly alphabet —
  // skips look-alikes (0/O, 1/l) so people can read it back over
  // the phone. Crypto random for entropy.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < buf.length; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

function CredentialModal({
  player,
  onClose,
}: {
  player: CredRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(
    player.username ?? suggestUsername(player.firstName, player.lastName),
  );
  const [password, setPassword] = useState(generatePassword());
  // Email is required so the player can use Forgot Password. Pre-fill
  // from the player record when available; otherwise the admin must
  // enter one before the credentials can be saved.
  const [email, setEmail] = useState(player.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ username: string; password: string } | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<"u" | "p" | "both" | null>(null);

  const onSubmit = () => {
    setError(null);
    const fd = new FormData();
    fd.set("username", username);
    fd.set("password", password);
    fd.set("email", email);
    start(async () => {
      try {
        const res = await setPlayerCredentials(player.id, fd);
        if (res.ok) {
          setSaved({ username, password });
          router.refresh();
        } else {
          setError(res.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save credentials.");
      }
    });
  };

  const onClear = () => {
    if (!confirm(`Remove login for ${player.firstName} ${player.lastName}?`)) return;
    setError(null);
    start(async () => {
      try {
        const res = await clearPlayerCredentials(player.id);
        if (res.ok) {
          router.refresh();
          onClose();
        } else {
          setError(res.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not clear credentials.");
      }
    });
  };

  const copy = async (kind: "u" | "p" | "both", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard blocked — drop silently.
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center px-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
              {saved ? "Credentials saved" : player.hasPassword ? "Reset login" : "Set login"}
            </div>
            <h3 className="text-[18px] font-bold leading-tight mt-0.5">
              {player.firstName} {player.lastName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--r-md)] text-[color:var(--text-3)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)]"
          >
            <X size={16} />
          </button>
        </div>

        {saved ? (
          <SavedCard saved={saved} onCopy={copy} copied={copied} onDone={onClose} />
        ) : (
          <div className="flex flex-col gap-3 mt-1">
            {!player.email && (
              <div className="rounded-[var(--r-md)] border border-[color:var(--warn)] bg-[color:var(--warn-soft)] px-3 py-2 text-[12px] text-[color:var(--warn)] leading-snug">
                <span className="font-bold">Email is required.</span>{" "}
                This player has no email on file — without one they
                can&apos;t use Forgot Password to recover their account.
              </div>
            )}
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                spellCheck={false}
                autoCapitalize="none"
                placeholder="player@example.com"
                required
                className="w-full h-10 px-3 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[14px] outline-none"
              />
              <div className="text-[11.5px] text-[color:var(--text-3)] mt-1">
                Used for Forgot Password. Saved to the player record.
              </div>
            </Field>
            <Field label="Username">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                spellCheck={false}
                autoCapitalize="none"
                className="w-full h-10 px-3 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[14px] font-[family-name:var(--mono)] outline-none"
              />
            </Field>
            <Field label="Temporary password">
              <div className="flex items-center gap-2">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  spellCheck={false}
                  autoCapitalize="none"
                  className="flex-1 h-10 px-3 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[14px] font-[family-name:var(--mono)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  className="inline-flex items-center gap-1.5 h-10 px-3 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-bold uppercase tracking-[0.06em] hover:bg-[color:var(--surface-2)]"
                >
                  <Shuffle size={13} /> New
                </button>
              </div>
              <div className="text-[11.5px] text-[color:var(--text-3)] mt-1">
                Share with the user. They can change it later.
              </div>
            </Field>

            {error && (
              <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 mt-2">
              <div>
                {player.hasPassword && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={onClear}
                    className="h-10 px-3 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--down)] hover:bg-[color:var(--down-soft)] disabled:opacity-60"
                  >
                    Remove login
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 px-4 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={onSubmit}
                  className="h-10 px-5 rounded-[var(--r-md)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
                >
                  {pending ? "Saving…" : player.hasPassword ? "Reset login" : "Set login"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SavedCard({
  saved,
  onCopy,
  copied,
  onDone,
}: {
  saved: { username: string; password: string };
  onCopy: (kind: "u" | "p" | "both", value: string) => void;
  copied: "u" | "p" | "both" | null;
  onDone: () => void;
}) {
  const both = `Username: ${saved.username}\nPassword: ${saved.password}`;
  return (
    <div className="flex flex-col gap-3 mt-1">
      <div className="text-[12.5px] text-[color:var(--text-2)]">
        Copy these now — the password isn&apos;t shown again. Send it to the user via your channel of choice (text, email, in person).
      </div>
      <div className="rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] p-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5">
        <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
          User
        </span>
        <span className="font-[family-name:var(--mono)] text-[14px] truncate">
          {saved.username}
        </span>
        <CopyBtn
          ok={copied === "u"}
          onClick={() => onCopy("u", saved.username)}
        />
        <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
          Pass
        </span>
        <span className="font-[family-name:var(--mono)] text-[14px] truncate">
          {saved.password}
        </span>
        <CopyBtn
          ok={copied === "p"}
          onClick={() => onCopy("p", saved.password)}
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onCopy("both", both)}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-bold uppercase tracking-[0.06em] hover:bg-[color:var(--surface-2)]"
        >
          {copied === "both" ? <Check size={14} /> : <Copy size={14} />}
          Copy both
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-10 px-5 rounded-[var(--r-md)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)]"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function CopyBtn({ ok, onClick }: { ok: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center w-8 h-8 rounded-[var(--r-md)] text-[color:var(--text-3)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface)]"
      aria-label="Copy"
    >
      {ok ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
        {label}
      </span>
      {children}
    </label>
  );
}
