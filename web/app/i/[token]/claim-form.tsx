"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptInviteByToken,
  declineInviteByToken,
} from "@/lib/actions/game-invites";

export function ClaimForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const accept = () => {
    setError(null);
    start(async () => {
      const res = await acceptInviteByToken(token);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };
  const decline = () => {
    setError(null);
    start(async () => {
      const res = await declineInviteByToken(token);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 max-sm:flex-col">
        <button
          type="button"
          onClick={accept}
          disabled={pending}
          className="flex-1 h-12 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60 transition-colors"
        >
          {pending ? "Saving…" : "Claim a seat"}
        </button>
        <button
          type="button"
          onClick={decline}
          disabled={pending}
          className="flex-1 h-12 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-2)] text-[12px] font-bold tracking-[0.06em] uppercase text-[color:var(--text-2)] disabled:opacity-60 transition-colors"
        >
          Pass
        </button>
      </div>
      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
