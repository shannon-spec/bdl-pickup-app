"use client";

import { useState, useTransition } from "react";
import { UserPlus, Copy, Check, X } from "lucide-react";
import {
  createOrganizerInvite,
  revokeInvite,
} from "@/lib/actions/organizer-invites";

/** Create + share co-organizer invite links for a context. */
export function InvitePanel({
  contextType,
  contextId,
  existingTokens = [],
}: {
  contextType: "LEAGUE" | "TOURNAMENT" | "COMMUNITY";
  contextId: string;
  existingTokens?: string[];
}) {
  const [pending, start] = useTransition();
  const [tokens, setTokens] = useState<string[]>(existingTokens);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linkFor = (t: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${t}`
      : `/join/${t}`;

  const create = () =>
    start(async () => {
      setError(null);
      const res = await createOrganizerInvite(contextType, contextId);
      if (!res.ok) return setError(res.error);
      setTokens((t) => [res.data.token, ...t]);
    });

  const copy = (t: string) => {
    navigator.clipboard?.writeText(linkFor(t));
    setCopied(t);
    setTimeout(() => setCopied((c) => (c === t ? null : c)), 1500);
  };

  const revoke = (t: string) =>
    start(async () => {
      await revokeInvite(t);
      setTokens((cur) => cur.filter((x) => x !== t));
    });

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={create}
        disabled={pending}
        className="inline-flex items-center gap-1.5 self-start h-9 px-3.5 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white text-[12px] font-bold uppercase tracking-[0.04em] disabled:opacity-60"
      >
        <UserPlus size={15} /> Invite co-organizer
      </button>
      {error && <div className="text-[12px] text-[color:var(--down)]">{error}</div>}
      {tokens.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {tokens.map((t) => (
            <div
              key={t}
              className="flex items-center gap-2 rounded-[10px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-3 py-2"
            >
              <span className="flex-1 min-w-0 truncate text-[12px] text-[color:var(--text-2)] font-[family-name:var(--mono)]">
                {linkFor(t)}
              </span>
              <button
                type="button"
                onClick={() => copy(t)}
                className="shrink-0 inline-flex items-center gap-1 text-[12px] font-bold text-[color:var(--brand)]"
              >
                {copied === t ? <Check size={14} /> : <Copy size={14} />}
                {copied === t ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => revoke(t)}
                disabled={pending}
                className="shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-full text-[color:var(--text-3)] hover:text-[color:var(--down)]"
                aria-label="Revoke"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11.5px] text-[color:var(--text-3)]">
        Anyone who opens the link and signs in becomes a co-organizer.
      </p>
    </div>
  );
}
