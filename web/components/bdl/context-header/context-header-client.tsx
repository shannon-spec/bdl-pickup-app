"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
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
  const hasPlayer = !!ctx.user.playerId;
  const hasChips =
    !!ctx.user.hometown ||
    !!ctx.user.height ||
    ctx.user.weightLbs !== null ||
    !!ctx.user.position;

  return (
    <section
      className="relative rounded-[16px] bg-[color:var(--ctx-bg)] px-5 py-3.5 max-sm:px-4 flex items-center justify-between gap-5 flex-wrap max-sm:flex-col max-sm:items-stretch"
      style={{ boxShadow: "inset 4px 0 0 0 var(--brand)" }}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1 pl-1.5">
        {/* Avatar */}
        <div className="relative shrink-0" style={{ width: 72, height: 72 }}>
          {ctx.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ctx.user.avatarUrl}
              alt=""
              width={72}
              height={72}
              className="w-[72px] h-[72px] rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex items-center justify-center w-[72px] h-[72px] rounded-full bg-[color:var(--ctx-surface)] text-[color:var(--text)] font-extrabold text-[24px]"
            >
              {ctx.user.initials}
            </span>
          )}
        </div>

        {/* Identity column */}
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="font-extrabold leading-none tracking-[-0.028em] text-[clamp(20px,3vw,30px)] text-[color:var(--text)] truncate">
              {ctx.user.displayName}
            </h1>
            {hasPlayer && (
              <Link
                href={`/players/${ctx.user.playerId}`}
                aria-label="View profile"
                title="View profile"
                className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-soft)] transition-colors"
                style={{ boxShadow: "inset 0 0 0 1.5px var(--brand)" }}
              >
                <UserRound size={14} strokeWidth={2.5} />
              </Link>
            )}
          </div>

          <RoleToggle view={view} options={options} />

          {hasChips && (
            <div className="flex items-center gap-2 flex-wrap">
              {ctx.user.hometown && <InfoChip>{ctx.user.hometown}</InfoChip>}
              {ctx.user.height && <InfoChip mono>{ctx.user.height}</InfoChip>}
              {ctx.user.weightLbs !== null && (
                <InfoChip mono>{ctx.user.weightLbs} lbs</InfoChip>
              )}
              {ctx.user.position && <InfoChip>{ctx.user.position}</InfoChip>}
            </div>
          )}
        </div>
      </div>

      {ctx.leagues.length > 0 && ctx.activeLeagueId && (
        <div className="flex-shrink-0 max-sm:w-full">
          <LeagueSwitcher
            leagues={ctx.leagues}
            activeLeagueId={ctx.activeLeagueId}
            view={view}
          />
        </div>
      )}
    </section>
  );
}

function InfoChip({
  children,
  mono,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center h-8 px-3 rounded-[10px] bg-[color:var(--ctx-surface)] text-[13px] font-semibold text-[color:var(--text)] ${
        mono ? "font-[family-name:var(--mono)] num" : ""
      }`}
    >
      {children}
    </span>
  );
}
