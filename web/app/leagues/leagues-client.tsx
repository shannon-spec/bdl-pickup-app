"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { LeagueSheet } from "./league-sheet";

export function LeaguesPageClient({
  canCreate,
  children,
}: {
  canCreate: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      {canCreate && (
        <div className="flex items-center justify-end -mt-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] transition-colors"
          >
            <Plus size={14} strokeWidth={2.5} /> Add League
          </button>
        </div>
      )}
      {children}
      {canCreate && (
        <LeagueSheet
          mode={open ? { kind: "create" } : { kind: "closed" }}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
