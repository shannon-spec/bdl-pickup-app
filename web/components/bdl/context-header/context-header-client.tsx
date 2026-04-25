"use client";

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
        <h1 className="font-extrabold leading-none tracking-[-0.028em] text-[clamp(18px,2.6vw,26px)] text-[color:var(--text)]">
          {ctx.user.displayName}
        </h1>
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
