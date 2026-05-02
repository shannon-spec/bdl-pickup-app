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
              <div className="inline-flex items-center gap-2 ml-2 max-sm:ml-0 max-sm:mt-1 max-sm:w-full">
                <Link
                  href={`/players/${ctx.user.playerId}`}
                  aria-label="My profile"
                  title="My profile"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[11.5px] font-bold tracking-[0.04em] uppercase text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors flex-shrink-0"
                >
                  <UserRound size={13} strokeWidth={2} /> Profile
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
                  className={`relative inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11.5px] font-bold tracking-[0.04em] uppercase transition-colors flex-shrink-0 ${
                    unreadMessages > 0
                      ? "bg-[color:var(--brand)] text-white border border-[color:var(--brand)] hover:bg-[color:var(--brand-hover)]"
                      : "border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)]"
                  }`}
                >
                  <MessageSquare size={13} strokeWidth={2} /> Message
                  {unreadMessages > 0 && (
                    <span
                      aria-hidden
                      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[color:var(--brand)] text-[10px] font-extrabold leading-[18px] -mr-1"
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
