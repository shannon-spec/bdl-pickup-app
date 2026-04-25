"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { SessionLeague } from "@/lib/queries/session-context";

type View = "player" | "commissioner" | "admin";

const LABELS: Record<View, string> = {
  player: "Player",
  commissioner: "Commissioner",
  admin: "Admin",
};

export function RoleToggle({
  leagues,
  activeLeagueId,
  isSuperAdmin,
}: {
  leagues: SessionLeague[];
  activeLeagueId: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const activeLeague = leagues.find((l) => l.id === activeLeagueId);
  const isCommish =
    activeLeague?.role === "commissioner" || activeLeague?.role === "both";

  const options = useMemo<View[]>(() => {
    const out: View[] = ["player"];
    if (isCommish) out.push("commissioner");
    if (isSuperAdmin) out.push("admin");
    return out;
  }, [isCommish, isSuperAdmin]);

  if (options.length <= 1) return null;

  // Highlight derived from current pathname — wherever you actually are
  // wins, regardless of what was last clicked.
  const current: View = pathname.startsWith("/admin")
    ? "admin"
    : pathname.startsWith(`/leagues/${activeLeagueId}`)
      ? "commissioner"
      : "player";

  const onSelect = (v: View) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`bdl_view_${activeLeagueId}`, v);
    }
    // Each lens has a home — clicking a tab navigates there so admin
    // and commissioner functions are actually reachable.
    if (v === "admin") {
      router.push("/admin");
      return;
    }
    if (v === "commissioner") {
      router.push(`/leagues/${activeLeagueId}`);
      return;
    }
    router.push("/");
  };

  return (
    <div
      role="tablist"
      aria-label="View as"
      className={[
        "inline-flex items-center gap-1 p-1 rounded-full",
        "bg-[color:var(--surface)] border border-[color:var(--hairline-2)]",
        "shadow-sm",
        "max-sm:w-full",
      ].join(" ")}
    >
      {options.map((o) => {
        const selected = o === current;
        return (
          <button
            key={o}
            role="tab"
            aria-selected={selected}
            type="button"
            onClick={() => onSelect(o)}
            className={[
              "h-9 px-4 rounded-full",
              "font-semibold text-[12.5px] tracking-[0.04em]",
              "transition-colors",
              selected
                ? "bg-[color:var(--surface-2)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_var(--hairline),0_1px_2px_rgba(0,0,0,0.10)]"
                : "text-[color:var(--text-3)] hover:text-[color:var(--text)]",
              "max-sm:flex-1 max-sm:px-0",
            ].join(" ")}
          >
            {LABELS[o]}
          </button>
        );
      })}
    </div>
  );
}
