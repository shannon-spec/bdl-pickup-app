"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, RefreshCw, Send, UserPlus, X } from "lucide-react";
import { createInvite } from "@/lib/actions/invites";
import { createPlayerWithCredentials } from "@/lib/actions/leagues";

type LeagueOpt = { id: string; name: string };
type Mode = "invite" | "credentials";
type LinkResult =
  | { kind: "invite"; url: string; firstName: string; lastName: string }
  | {
      kind: "credentials";
      url: string;
      username: string;
      password: string;
      firstName: string;
      lastName: string;
    };

const PASSWORD_ALPHA =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // skip 0/O/1/I/l for legibility
function genPassword(len = 12) {
  let out = "";
  const a = PASSWORD_ALPHA;
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const buf = new Uint32Array(len);
    window.crypto.getRandomValues(buf);
    for (let i = 0; i < len; i++) out += a[buf[i] % a.length];
  } else {
    for (let i = 0; i < len; i++) out += a[Math.floor(Math.random() * a.length)];
  }
  return out;
}

export function InviteControls({ leagues }: { leagues: LeagueOpt[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("invite");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [leagueId, setLeagueId] = useState(leagues[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LinkResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (leagues.length === 0) return null;

  const reset = () => {
    setFirst("");
    setLast("");
    setEmail("");
    setUsername("");
    setPassword("");
    setLeagueId(leagues[0]?.id ?? "");
    setError(null);
    setResult(null);
    setCopied(null);
  };
  const close = () => {
    setOpen(false);
    reset();
  };

  const onSubmitInvite = () => {
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
      if (!res.ok) return setError(res.error);
      setResult({
        kind: "invite",
        url: `${window.location.origin}/invite/${res.data!.id}`,
        firstName: first.trim(),
        lastName: last.trim(),
      });
    });
  };

  const onSubmitCredentials = () => {
    setError(null);
    if (
      !first.trim() ||
      !last.trim() ||
      !username.trim() ||
      !password ||
      !leagueId
    ) {
      setError("First name, last name, username, password, and league are required.");
      return;
    }
    const fd = new FormData();
    fd.set("firstName", first.trim());
    fd.set("lastName", last.trim());
    fd.set("email", email.trim());
    fd.set("username", username.trim());
    fd.set("password", password);
    fd.set("leagueId", leagueId);
    start(async () => {
      const res = await createPlayerWithCredentials(fd);
      if (!res.ok) {
        const fieldMsg =
          res.fieldErrors &&
          Object.values(res.fieldErrors).flat().filter(Boolean)[0];
        setError(fieldMsg ?? res.error);
        return;
      }
      setResult({
        kind: "credentials",
        url: `${window.location.origin}/login`,
        username: res.data!.username,
        password,
        firstName: first.trim(),
        lastName: last.trim(),
      });
    });
  };

  const onCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard blocked — input is selectable as a fallback
    }
  };

  const onCopyAll = () => {
    if (!result) return;
    const text =
      result.kind === "invite"
        ? `Hey ${result.firstName} — your BDL invite: ${result.url}`
        : `Hey ${result.firstName} — your BDL login:\n${result.url}\nUsername: ${result.username}\nPassword: ${result.password}`;
    onCopy("all", text);
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

            {!result && (
              <div className="inline-flex p-1 rounded-full border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] self-start">
                <ModeBtn
                  active={mode === "invite"}
                  onClick={() => {
                    setMode("invite");
                    setError(null);
                  }}
                >
                  <Send size={12} /> Invite link
                </ModeBtn>
                <ModeBtn
                  active={mode === "credentials"}
                  onClick={() => {
                    setMode("credentials");
                    setError(null);
                  }}
                >
                  <KeyRound size={12} /> Direct credentials
                </ModeBtn>
              </div>
            )}

            {!result ? (
              mode === "invite" ? (
                <>
                  <p className="text-[12.5px] text-[color:var(--text-3)] -mt-1">
                    Creates a player record and a one-tap invite link. They
                    accept on the page and join the league.
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
                  {error && <ErrorBlock>{error}</ErrorBlock>}
                  <Footer
                    onCancel={close}
                    onSubmit={onSubmitInvite}
                    pending={pending}
                    submitLabel="Create + get link"
                    SubmitIcon={Send}
                  />
                </>
              ) : (
                <>
                  <p className="text-[12.5px] text-[color:var(--text-3)] -mt-1">
                    Creates a player with a username and password. Send them
                    the login URL + creds and they can sign in immediately.
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
                    <Field label="Email (optional)" full>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        maxLength={120}
                        disabled={pending}
                        className={inputCx}
                      />
                    </Field>
                    <Field label="Username">
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        maxLength={32}
                        autoCapitalize="off"
                        autoCorrect="off"
                        disabled={pending}
                        className={`${inputCx} font-[family-name:var(--mono)]`}
                        placeholder="e.g. shannonterry"
                      />
                    </Field>
                    <Field label="Password">
                      <div className="flex items-center gap-2">
                        <input
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          maxLength={72}
                          disabled={pending}
                          className={`${inputCx} flex-1 font-[family-name:var(--mono)]`}
                          placeholder="min 8 chars"
                        />
                        <button
                          type="button"
                          onClick={() => setPassword(genPassword(12))}
                          disabled={pending}
                          aria-label="Generate password"
                          title="Generate password"
                          className="inline-flex items-center justify-center h-10 w-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] disabled:opacity-60"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
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
                  {error && <ErrorBlock>{error}</ErrorBlock>}
                  <Footer
                    onCancel={close}
                    onSubmit={onSubmitCredentials}
                    pending={pending}
                    submitLabel="Create account"
                    SubmitIcon={KeyRound}
                  />
                </>
              )
            ) : result.kind === "invite" ? (
              <>
                <p className="text-[12.5px] text-[color:var(--text-3)] -mt-2">
                  Share this link with {result.firstName} {result.lastName}.
                </p>
                <CopyRow
                  value={result.url}
                  copied={copied === "url"}
                  onCopy={() => onCopy("url", result.url)}
                />
                <ResultFooter
                  onAnother={reset}
                  onClose={close}
                  onCopyAll={onCopyAll}
                  copiedAll={copied === "all"}
                />
              </>
            ) : (
              <>
                <p className="text-[12.5px] text-[color:var(--text-3)] -mt-2">
                  Account is live. Send {result.firstName} {result.lastName}{" "}
                  these creds — they can sign in right away.
                </p>
                <CopyRow
                  label="Login URL"
                  value={result.url}
                  copied={copied === "url"}
                  onCopy={() => onCopy("url", result.url)}
                />
                <CopyRow
                  label="Username"
                  value={result.username}
                  copied={copied === "u"}
                  onCopy={() => onCopy("u", result.username)}
                />
                <CopyRow
                  label="Password"
                  value={result.password}
                  copied={copied === "p"}
                  onCopy={() => onCopy("p", result.password)}
                />
                <ResultFooter
                  onAnother={reset}
                  onClose={close}
                  onCopyAll={onCopyAll}
                  copiedAll={copied === "all"}
                />
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

function ErrorBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
      {children}
    </div>
  );
}

function ModeBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-bold tracking-[0.06em] uppercase transition-colors ${
        active
          ? "bg-[color:var(--brand)] text-white"
          : "text-[color:var(--text-3)] hover:text-[color:var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

function Footer({
  onCancel,
  onSubmit,
  pending,
  submitLabel,
  SubmitIcon,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  pending: boolean;
  submitLabel: string;
  SubmitIcon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}) {
  return (
    <div className="flex items-center justify-end gap-2 mt-1">
      <button
        type="button"
        onClick={onCancel}
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
        <SubmitIcon size={14} strokeWidth={2.5} />
        {pending ? "Working…" : submitLabel}
      </button>
    </div>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label?: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
          {label}
        </span>
      )}
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
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
    </div>
  );
}

function ResultFooter({
  onAnother,
  onClose,
  onCopyAll,
  copiedAll,
}: {
  onAnother: () => void;
  onClose: () => void;
  onCopyAll: () => void;
  copiedAll: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
      <button
        type="button"
        onClick={onCopyAll}
        className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-bold uppercase tracking-[0.06em] hover:bg-[color:var(--surface-2)]"
      >
        {copiedAll ? <Check size={14} /> : <Copy size={14} />}
        {copiedAll ? "Copied" : "Copy all"}
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAnother}
          className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
        >
          Add another
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
