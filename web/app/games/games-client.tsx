"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { GameSheet } from "./game-sheet";

export function GamesPageClient({
  leagues,
  children,
}: {
  leagues: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-end -mt-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[#DC3D14] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] transition-colors"
        >
          <Plus size={14} strokeWidth={2.5} /> Schedule Game
        </button>
      </div>
      {children}
      <GameSheet
        mode={open ? { kind: "create" } : { kind: "closed" }}
        leagues={leagues}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
