"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveViewAction } from "@/lib/actions/active-view";
import type { View } from "@/lib/cookies/active-view";

const LABELS: Record<View, string> = {
  player: "Player",
  commissioner: "Commissioner",
  admin: "Admin",
};

/**
 * Inline persona/role pills shown next to the user's name. Active role
 * is a solid brand-filled pill; the rest are ghost pills with a hairline
 * border. Single-option case (player-only) renders as a plain label
 * since there's nothing to switch.
 */
export function RoleToggle({
  view,
  options,
}: {
  view: View;
  options: View[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (options.length === 1) {
    return (
      <span className="inline-flex items-center h-7 px-1 text-[10.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-3)] flex-shrink-0">
        {LABELS[options[0]]}
      </span>
    );
  }

  const onSelect = (next: View) => {
    if (next === view) return;
    start(async () => {
      await setActiveViewAction(next);
      router.refresh();
    });
  };

  return (
    <div
      role="tablist"
      aria-label="View as"
      aria-busy={pending}
      className="inline-flex items-center gap-1.5 flex-wrap"
    >
      {options.map((o) => {
        const selected = o === view;
        return (
          <button
            key={o}
            role="tab"
            aria-selected={selected}
            type="button"
            onClick={() => onSelect(o)}
            disabled={pending}
            className={[
              "h-7 px-3 rounded-full",
              "text-[10.5px] font-bold tracking-[0.06em] uppercase",
              "transition-colors",
              selected
                ? "bg-[color:var(--brand)] text-white border border-[color:var(--brand)]"
                : "bg-transparent border border-[color:var(--hairline-2)] text-[color:var(--text-3)] hover:text-[color:var(--text)] hover:border-[color:var(--hairline)]",
              "disabled:opacity-60",
            ].join(" ")}
          >
            {LABELS[o]}
          </button>
        );
      })}
    </div>
  );
}
