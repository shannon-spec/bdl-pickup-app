"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideJoinRequest } from "@/lib/actions/join";
import type { ManagerRequest } from "@/lib/queries/join";

const TYPE_LABEL: Record<string, string> = {
  LEAGUE: "League",
  TEAM: "Team",
  TOURNAMENT: "Tournament",
  COMMUNITY: "Community",
};

function descriptor(p: ManagerRequest["player"]) {
  const ht = p.heightFt != null ? `${p.heightFt}'${p.heightIn ?? 0}"` : "";
  return [
    ht,
    p.position,
    p.college,
    p.level && p.level !== "Not Rated" ? `self-grade ${p.level}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function RequestQueue({ requests }: { requests: ManagerRequest[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {requests.map((r) => (
        <RequestCard key={r.id} r={r} />
      ))}
    </div>
  );
}

function RequestCard({ r }: { r: ManagerRequest }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: "accept" | "hold" | "deny") =>
    start(async () => {
      setError(null);
      const res = await decideJoinRequest(r.id, decision);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });

  return (
    <div className="rounded-[14px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] p-3.5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] text-[13px] font-extrabold shrink-0 overflow-hidden">
          {r.player.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.player.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            r.player.initials
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[15px] tracking-[-0.01em] truncate">
            {r.player.name}
          </div>
          <div className="text-[12px] text-[color:var(--text-3)] truncate">
            {descriptor(r.player) || "Player"}
          </div>
        </div>
        <span className="shrink-0 text-[11px] text-[color:var(--text-3)] text-right">
          {TYPE_LABEL[r.contextType] ?? r.contextType}
          <br />
          <span className="font-semibold text-[color:var(--text-2)]">
            {r.contextName}
          </span>
        </span>
      </div>

      {r.message && (
        <p className="text-[13px] text-[color:var(--text-2)] bg-[color:var(--surface-2)] rounded-[10px] px-3 py-2">
          “{r.message}”
        </p>
      )}

      {r.status === "hold" && (
        <span className="self-start text-[11px] font-bold uppercase tracking-[0.06em] text-[color:var(--warn)]">
          On hold
        </span>
      )}

      {error && <div className="text-[12px] text-[color:var(--down)]">{error}</div>}

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => decide("accept")}
          disabled={pending}
          className="h-10 rounded-[var(--r-lg)] border border-[color:var(--up)] text-[color:var(--up)] bg-[color:var(--up-soft)] text-[12px] font-bold uppercase tracking-[0.04em] disabled:opacity-60"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => decide("hold")}
          disabled={pending}
          className="h-10 rounded-[var(--r-lg)] border border-[color:var(--warn)] text-[color:var(--warn)] bg-[color:var(--warn-soft)] text-[12px] font-bold uppercase tracking-[0.04em] disabled:opacity-60"
        >
          Hold
        </button>
        <button
          type="button"
          onClick={() => decide("deny")}
          disabled={pending}
          className="h-10 rounded-[var(--r-lg)] border border-[color:var(--down)] text-[color:var(--down)] bg-[color:var(--down-soft)] text-[12px] font-bold uppercase tracking-[0.04em] disabled:opacity-60"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
