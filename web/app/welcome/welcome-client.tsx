"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDefaultHomeAction } from "@/lib/cookies/default-home";

const PERSONAS = [
  { key: "play", emoji: "🏀", title: "Play", blurb: "Find runs, RSVP, track my stats" },
  { key: "coach", emoji: "📋", title: "Coach", blurb: "Manage a team — rosters & lineups" },
  { key: "organize", emoji: "🗂️", title: "Organize", blurb: "Run a league, tournament, or club" },
  { key: "watch", emoji: "👀", title: "Watch", blurb: "Follow players, teams & scores" },
] as const;

export function WelcomeClient({ preselect }: { preselect: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string | null>(
    preselect && PERSONAS.some((p) => p.key === preselect) ? preselect : null,
  );

  const choose = (key: string) => {
    setPicked(key);
    start(async () => {
      await setDefaultHomeAction(key);
      router.replace("/home");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {PERSONAS.map((p) => {
        const active = picked === p.key;
        return (
          <button
            key={p.key}
            type="button"
            disabled={pending}
            onClick={() => choose(p.key)}
            className={`flex items-center gap-3.5 rounded-[14px] px-4 py-3.5 text-left transition-colors disabled:opacity-70 ${
              active
                ? "bg-[color:var(--brand-soft)] shadow-[inset_0_0_0_1.5px_var(--brand)]"
                : "bg-[color:var(--surface)] shadow-[inset_0_0_0_1px_var(--hairline-2)] hover:bg-[color:var(--surface-2)]"
            }`}
          >
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-[12px] bg-[color:var(--surface-2)] text-[22px] shrink-0">
              {p.emoji}
            </span>
            <span className="flex flex-col min-w-0">
              <span className="font-bold text-[16px] tracking-[-0.01em]">{p.title}</span>
              <span className="text-[12.5px] text-[color:var(--text-3)]">{p.blurb}</span>
            </span>
          </button>
        );
      })}
      <p className="text-center text-[11.5px] text-[color:var(--text-4)] mt-1">
        You can switch anytime — roles follow your contexts, not your account.
      </p>
    </div>
  );
}
