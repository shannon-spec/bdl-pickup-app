"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();

  const activeLeague = leagues.find((l) => l.id === activeLeagueId);
  const isCommish =
    activeLeague?.role === "commissioner" || activeLeague?.role === "both";

  const options = useMemo<View[]>(() => {
    const out: View[] = ["player"];
    if (isCommish) out.push("commissioner");
    if (isSuperAdmin) out.push("admin");
    return out;
  }, [isCommish, isSuperAdmin]);

  const urlView = (searchParams.get("view") as View | null) ?? null;

  // On league change: rehydrate from per-league localStorage. If the
  // stored view isn't valid for this league, snap to player.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `bdl_view_${activeLeagueId}`;
    const stored = window.localStorage.getItem(key) as View | null;
    let next: View;
    if (stored && options.includes(stored)) {
      next = stored;
    } else if (urlView && options.includes(urlView)) {
      next = urlView;
    } else {
      next = "player";
    }
    if (next !== urlView) {
      const sp = new URLSearchParams(searchParams.toString());
      if (next === "player") sp.delete("view");
      else sp.set("view", next);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
    // We intentionally don't include searchParams or urlView in deps;
    // we re-run only when the active league changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeagueId]);

  if (options.length <= 1) return null;

  const onSelect = (v: View) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`bdl_view_${activeLeagueId}`, v);
    }
    const sp = new URLSearchParams(searchParams.toString());
    if (v === "player") sp.delete("view");
    else sp.set("view", v);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const current: View =
    urlView && options.includes(urlView) ? urlView : "player";

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
