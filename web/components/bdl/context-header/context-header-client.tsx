"use client";

import Link from "next/link";
import { CircleUser } from "lucide-react";
import type { SessionContext } from "@/lib/queries/session-context";
import type { View } from "@/lib/cookies/active-view";
import { LeagueSwitcher } from "./league-switcher";
import { RoleToggle } from "./role-toggle";

export function ContextHeaderClient({
  ctx,
  view,
  options,
}: {
  ctx: SessionContext;
  view: View;
  options: View[];
}) {
  return (
    <div
      className="flex items-start justify-between gap-[18px] flex-wrap max-sm:flex-col max-sm:items-stretch"
    >
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="font-extrabold leading-none tracking-[-0.028em] text-[clamp(18px,2.6vw,26px)] text-[color:var(--text)] truncate">
            {ctx.user.displayName}
          </h1>
          {ctx.user.playerId && (
            <Link
              href={`/players/${ctx.user.playerId}`}
              aria-label="Open my player profile"
              title="My profile"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[color:var(--text-3)] hover:text-[color:var(--brand)] hover:bg-[color:var(--surface-2)] transition-colors flex-shrink-0"
            >
              <CircleUser size={20} strokeWidth={1.75} />
            </Link>
          )}
        </div>
        {ctx.leagues.length > 0 && ctx.activeLeagueId && (
          <LeagueSwitcher
            leagues={ctx.leagues}
            activeLeagueId={ctx.activeLeagueId}
          />
        )}
      </div>
      {options.length > 1 && (
        <RoleToggle view={view} options={options} />
      )}
    </div>
  );
}
