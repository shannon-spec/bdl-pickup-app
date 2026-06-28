"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideSponsor } from "@/lib/actions/join";
import type { SponsorRequest } from "@/lib/queries/join";

const TYPE_LABEL: Record<string, string> = {
  LEAGUE: "league",
  TEAM: "team",
  TOURNAMENT: "tournament",
  COMMUNITY: "community",
};

export function SponsorList({ requests }: { requests: SponsorRequest[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {requests.map((r) => (
        <SponsorCard key={r.id} r={r} />
      ))}
    </div>
  );
}

function SponsorCard({ r }: { r: SponsorRequest }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decide = (accept: boolean) =>
    start(async () => {
      setError(null);
      const res = await decideSponsor(r.id, accept);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });

  return (
    <div className="rounded-[14px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] p-3.5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] text-[13px] font-extrabold shrink-0">
          {r.requesterInitials}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] tracking-[-0.01em] truncate">
            {r.requesterName}
          </div>
          <div className="text-[12.5px] text-[color:var(--text-3)] truncate">
            wants you to sponsor their request to join{" "}
            <span className="font-semibold text-[color:var(--text-2)]">
              {r.contextName}
            </span>{" "}
            ({TYPE_LABEL[r.contextType] ?? "context"})
          </div>
        </div>
      </div>

      {r.message && (
        <p className="text-[13px] text-[color:var(--text-2)] bg-[color:var(--surface-2)] rounded-[10px] px-3 py-2">
          “{r.message}”
        </p>
      )}

      {error && <div className="text-[12px] text-[color:var(--down)]">{error}</div>}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => decide(true)}
          disabled={pending}
          className="h-10 rounded-[var(--r-lg)] border border-[color:var(--up)] text-[color:var(--up)] bg-[color:var(--up-soft)] text-[12px] font-bold uppercase tracking-[0.04em] disabled:opacity-60"
        >
          Accept &amp; vouch
        </button>
        <button
          type="button"
          onClick={() => decide(false)}
          disabled={pending}
          className="h-10 rounded-[var(--r-lg)] border border-[color:var(--down)] text-[color:var(--down)] bg-[color:var(--down-soft)] text-[12px] font-bold uppercase tracking-[0.04em] disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
