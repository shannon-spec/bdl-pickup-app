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
    <section
      className="rounded-[16px] border border-[color:var(--hairline-2)] px-5 py-4 flex items-start justify-between gap-[18px] flex-wrap max-sm:flex-col max-sm:items-stretch overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top left, var(--next-game-tint), transparent 60%), var(--surface)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <PlayerAvatar
          url={ctx.user.avatarUrl}
          initials={ctx.user.initials}
          size={48}
          className="shadow-[0_1px_0_rgba(0,0,0,0.06)]"
        />
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <h1 className="font-extrabold leading-none tracking-[-0.028em] text-[clamp(18px,2.6vw,26px)] text-[color:var(--text)] truncate">
              {ctx.user.displayName}
            </h1>
            <RoleToggle view={view} options={options} />
          </div>
          {(ctx.user.position ||
            ctx.user.hometown ||
            ctx.user.height ||
            ctx.user.weightLbs !== null) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {ctx.user.position && (
                <span className="inline-flex items-center h-5 px-2 rounded-full text-[10.5px] font-bold tracking-[0.05em] uppercase bg-[color:var(--surface-2)] text-[color:var(--text-2)] border border-[color:var(--hairline)]">
                  {ctx.user.position}
                </span>
              )}
              {ctx.user.hometown && (
                <span className="text-[12px] text-[color:var(--text-3)]">
                  {ctx.user.hometown}
                </span>
              )}
              {ctx.user.height && (
                <>
                  <span className="text-[color:var(--text-4)] text-[11px]">
                    ·
                  </span>
                  <span className="text-[12px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                    {ctx.user.height}
                  </span>
                </>
              )}
              {ctx.user.weightLbs !== null && (
                <>
                  <span className="text-[color:var(--text-4)] text-[11px]">
                    ·
                  </span>
                  <span className="text-[12px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                    {ctx.user.weightLbs} lbs
                  </span>
                </>
              )}
            </div>
          )}
          {ctx.leagues.length > 0 && ctx.activeLeagueId && (
            <LeagueSwitcher
              leagues={ctx.leagues}
              activeLeagueId={ctx.activeLeagueId}
              view={view}
            />
          )}
        </div>
      </div>

      {hasPlayer && (
        <div className="inline-flex items-center gap-2 flex-shrink-0 max-sm:w-full">
          <Link
            href={`/players/${ctx.user.playerId}`}
            aria-label="My profile"
            title="My profile"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-[color:var(--hairline-2)] bg-transparent text-[11.5px] font-bold tracking-[0.04em] uppercase text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors max-sm:flex-1 max-sm:justify-center"
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
            className={`relative inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-white text-[11.5px] font-bold tracking-[0.04em] uppercase shadow-[var(--cta-shadow)] transition-colors max-sm:flex-1 max-sm:justify-center ${
              unreadMessages > 0
                ? "bg-[color:var(--warn)] hover:opacity-90 border border-[color:var(--warn)]"
                : "bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)]"
            }`}
          >
            <MessageSquare size={13} strokeWidth={2} /> Message
            {unreadMessages > 0 && (
              <span
                aria-hidden
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[color:var(--warn)] text-[10px] font-extrabold leading-[18px] -mr-1"
              >
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            )}
          </Link>
        </div>
      )}
    </section>
  );
}
