"use client";

import type { SessionContext } from "@/lib/queries/session-context";
import { LeagueSwitcher } from "./league-switcher";
import { RoleToggle } from "./role-toggle";

export function ContextHeaderClient({ ctx }: { ctx: SessionContext }) {
  return (
    <div
      className="flex items-start justify-between gap-[18px] flex-wrap mb-7 max-sm:flex-col max-sm:items-stretch"
    >
      <div className="flex flex-col gap-3 min-w-0 flex-1">
        <h1 className="font-extrabold leading-none tracking-[-0.028em] text-[clamp(30px,4.4vw,44px)] text-[color:var(--text)]">
          {ctx.user.displayName}
        </h1>
        {ctx.leagues.length > 0 && ctx.activeLeagueId && (
          <LeagueSwitcher
            leagues={ctx.leagues}
            activeLeagueId={ctx.activeLeagueId}
          />
        )}
      </div>
      {ctx.activeLeagueId && (
        <RoleToggle
          leagues={ctx.leagues}
          activeLeagueId={ctx.activeLeagueId}
          isSuperAdmin={ctx.user.isSuperAdmin}
        />
      )}
    </div>
  );
}
