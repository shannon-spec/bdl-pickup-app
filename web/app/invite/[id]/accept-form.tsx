"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/lib/actions/invites";

const POSITIONS = ["", "PG", "SG", "SF", "PF", "C", "G", "F"];

export function AcceptForm({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    formData.set("inviteId", inviteId);
    start(async () => {
      const res = await acceptInvite(formData);
      if (res.ok) {
        // Redirect to the same invite URL with ?accepted=1 so the
        // server renders a celebratory welcome state. Refreshing
        // there stays put — no more "Already accepted" surprise.
        router.replace(`/invite/${inviteId}?accepted=1`);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <form action={onSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Field label="City">
          <input
            name="city"
            placeholder="Nashville"
            className="h-10 w-full rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none focus:border-[color:var(--brand)]"
          />
        </Field>
        <Field label="State" hint="2 letters">
          <input
            name="state"
            maxLength={2}
            placeholder="TN"
            className="h-10 w-full rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none focus:border-[color:var(--brand)] uppercase"
          />
        </Field>
      </div>
      <Field label="Position (optional)">
        <select
          name="position"
          defaultValue=""
          className="h-10 w-full rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none cursor-pointer"
        >
          {POSITIONS.map((p) => (
            <option key={p || "_"} value={p}>
              {p || "—"}
            </option>
          ))}
        </select>
      </Field>

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 h-11 rounded-[12px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[13px] tracking-[0.04em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
      >
        {pending ? "Joining…" : "Accept & Join"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 flex-1 min-w-0">
      <span className="flex items-center justify-between text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
        <span>{label}</span>
        {hint && (
          <span className="text-[color:var(--text-4)] tracking-normal lowercase font-medium normal-case">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
