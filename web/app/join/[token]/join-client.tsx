"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { acceptInvite } from "@/lib/actions/organizer-invites";

export function JoinClient({
  token,
  roleLabel,
}: {
  token: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const accept = () =>
    start(async () => {
      setError(null);
      const res = await acceptInvite(token);
      if (!res.ok) return setError(res.error);
      router.push(res.data.redirect);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 w-full">
      <button
        type="button"
        onClick={accept}
        disabled={pending}
        className="h-12 rounded-[12px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.04em] uppercase inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
      >
        <Check size={16} />
        {pending ? "Joining…" : `Accept & join as ${roleLabel}`}
      </button>
      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2 text-center">
          {error}
        </div>
      )}
    </div>
  );
}
