"use client";

import Link from "next/link";
import { MessageSquare, UserRound } from "lucide-react";
import type { SessionContext } from "@/lib/queries/session-context";
import type { View } from "@/lib/cookies/active-view";
import { PlayerAvatar } from "@/components/bdl/player-avatar";
import { LeagueSwitcher } from "./league-switcher";
import { RoleToggle } from "./role-toggle";

export function ContextHeaderClient({
  ctx,
  view,
  options,
  unreadMessages,
}: {
  ctx: SessionContext;
  view: View;
  options: View[];
  unreadMessages: number;
}) {
  const hasPlayer = !!ctx.user.playerId;
  return (
    <div className="flex items-start justify-between gap-[18px] flex-wrap max-sm:flex-col max-sm:items-stretch">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <PlayerAvatar
          url={ctx.user.avatarUrl}
          initials={ctx.user.initials}
          size={48}
          className="shadow-[0_1px_0_rgba(0,0,0,0.06)]"
        />
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <h1 className="font-extrabold leading-none tracking-[-0.028em] text-[clamp(18px,2.6vw,26px)] text-[color:var(--text)] truncate">
              {ctx.user.displayName}
            </h1>
            {hasPlayer && (
              <div className="inline-flex items-center gap-1 ml-1">
                <Link
                  href={`/players/${ctx.user.playerId}`}
                  aria-label="My profile"
                  title="My profile"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[color:var(--text-3)] hover:text-[color:var(--brand)] hover:bg-[color:var(--surface-2)] transition-colors flex-shrink-0"
                >
                  <UserRound size={17} strokeWidth={1.75} />
                </Link>
                <Link
                  href="/messages"
                  aria-label={
                    unreadMessages > 0
                      ? `Messages · ${unreadMessages} unread`
                      : "Messages"
                  }
                  title={
                    unreadMessages > 0
                      ? `Messages · ${unreadMessages} unread`
                      : "Messages"
                  }
                  className="relative inline-flex items-center justify-center w-8 h-8 rounded-full text-[color:var(--text-3)] hover:text-[color:var(--brand)] hover:bg-[color:var(--surface-2)] transition-colors flex-shrink-0"
                >
                  <MessageSquare size={17} strokeWidth={1.75} />
                  {unreadMessages > 0 && (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[color:var(--brand)] text-white text-[9.5px] font-extrabold leading-[16px] text-center"
                      style={{ boxShadow: "0 0 0 2px var(--badge-dot-border)" }}
                    >
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </Link>
              </div>
            )}
          </div>
          {ctx.leagues.length > 0 && ctx.activeLeagueId && (
            <LeagueSwitcher
              leagues={ctx.leagues}
              activeLeagueId={ctx.activeLeagueId}
              view={view}
            />
          )}
        </div>
      </div>
      {options.length > 1 && <RoleToggle view={view} options={options} />}
    </div>
  );
}
