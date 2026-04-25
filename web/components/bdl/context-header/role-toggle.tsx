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

export function RoleToggle({
  view,
  options,
}: {
  view: View;
  options: View[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (options.length <= 1) return null;

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
      className={[
        "inline-flex items-center gap-1 p-1 rounded-full",
        "bg-[color:var(--surface)] border border-[color:var(--hairline-2)]",
        "shadow-sm",
        "max-sm:w-full",
      ].join(" ")}
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
              "h-9 px-4 rounded-full",
              "font-semibold text-[12.5px] tracking-[0.04em]",
              "transition-colors",
              selected
                ? "bg-[color:var(--surface-2)] text-[color:var(--text)] shadow-[inset_0_0_0_1px_var(--hairline),0_1px_2px_rgba(0,0,0,0.10)]"
                : "text-[color:var(--text-3)] hover:text-[color:var(--text)]",
              "disabled:opacity-60",
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
