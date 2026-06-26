"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ChevronDown,
  CirclePlus,
  Download,
  KeyRound,
  Lock,
  Settings2,
  SlidersHorizontal,
  Users,
  UserPlus,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { SessionContext } from "@/lib/queries/session-context";
import type { View } from "@/lib/cookies/active-view";
import { LeagueSwitcher } from "./league-switcher";
import { RoleToggle } from "./role-toggle";
import type { SwitcherTeam } from "./league-switcher";

export function ContextHeaderClient({
  ctx,
  view,
  options,
  canManage,
  teams = [],
  tournaments = [],
  communities = [],
  activeTeam = null,
}: {
  ctx: SessionContext;
  view: View;
  options: View[];
  /** Commissioner or admin — gates the docked Commissioner Tools bar. */
  canManage: boolean;
  /** Teams the viewer is part of — listed in the context switcher. */
  teams?: SwitcherTeam[];
  tournaments?: SwitcherTeam[];
  communities?: SwitcherTeam[];
  /** When on a team page, the team to surface as the active context. */
  activeTeam?: SwitcherTeam | null;
}) {
  const hasPlayer = !!ctx.user.playerId;
  const hasChips =
    !!ctx.user.hometown ||
    !!ctx.user.height ||
    ctx.user.weightLbs !== null ||
    !!ctx.user.position;

  return (
    <section>
      {/* Identity — slate panel */}
      <div
        className={`relative bg-[color:var(--ctx-bg)] px-5 py-3.5 max-sm:px-4 flex items-center justify-between gap-5 flex-wrap max-sm:flex-col max-sm:items-stretch ${
          canManage ? "rounded-t-[16px]" : "rounded-[16px]"
        }`}
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

      {((ctx.leagues.length > 0 && ctx.activeLeagueId) ||
        activeTeam ||
        teams.length > 0 ||
        tournaments.length > 0 ||
        communities.length > 0) && (
        <div className="flex-shrink-0 max-sm:w-full">
          <LeagueSwitcher
            leagues={ctx.leagues}
            activeLeagueId={ctx.activeLeagueId ?? ""}
            view={view}
            teams={teams}
            tournaments={tournaments}
            communities={communities}
            activeTeam={activeTeam}
          />
        </div>
      )}
      </div>

      {/* Commissioner Tools — docked to the bottom of the header on every
          tab, role-gated to commissioners/admins. */}
      {canManage && (
        <div
          className="relative bg-[color:var(--surface)] rounded-b-[16px] px-5 py-2 max-sm:px-4 flex flex-col gap-1.5"
          style={{ boxShadow: "inset 4px 0 0 0 var(--brand)" }}
        >
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.12em] uppercase text-[color:var(--brand-ink)]">
            <Lock size={12} strokeWidth={2.5} /> Commissioner Tools
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/games/new"
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-[10px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white text-[12px] font-bold transition-colors"
            >
              Schedule game
            </Link>
            <Link
              href="/players"
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-[10px] text-[12px] font-semibold text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors shadow-[inset_0_0_0_1px_var(--hairline-2)]"
            >
              <UserPlus size={14} strokeWidth={2.25} /> Invite player
            </Link>
            <Link
              href="/leagues/new"
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-[10px] text-[12px] font-semibold text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors shadow-[inset_0_0_0_1px_var(--hairline-2)]"
            >
              <CirclePlus size={14} strokeWidth={2.25} /> Add league
            </Link>
            <Link
              href="/teams/new"
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-[10px] text-[12px] font-semibold text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors shadow-[inset_0_0_0_1px_var(--hairline-2)]"
            >
              <UsersRound size={14} strokeWidth={2.25} /> Create team
            </Link>
            <CommissionerMore leagueId={ctx.activeLeagueId} />
          </div>
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
      className={`inline-flex items-center h-8 px-3 rounded-[10px] bg-[color:var(--ctx-surface)] text-[12px] font-semibold text-[color:var(--text)] ${
        mono ? "font-[family-name:var(--mono)] num" : ""
      }`}
    >
      {children}
    </span>
  );
}

function SoonTag() {
  return (
    <span className="ml-auto inline-flex items-center h-4 px-1.5 rounded-full bg-[color:var(--surface-2)] text-[9px] font-bold uppercase tracking-[0.06em] text-[color:var(--text-4)]">
      Soon
    </span>
  );
}

/** Overflow menu of lower-frequency commissioner actions. */
function CommissionerMore({ leagueId }: { leagueId: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const row =
    "flex items-center gap-2.5 w-full px-3 py-2 text-left text-[13px] font-medium transition-colors";
  const live = `${row} text-[color:var(--text-2)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-[10px] text-[12px] font-semibold text-[color:var(--text-2)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors shadow-[inset_0_0_0_1px_var(--hairline-2)]"
      >
        More
        <ChevronDown
          size={14}
          strokeWidth={2.25}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-[var(--z-popover)] min-w-[212px] rounded-[12px] bg-[color:var(--surface)] py-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.12),inset_0_0_0_1px_var(--hairline-2)]"
        >
          {leagueId && (
            <Link
              href={`/leagues/${leagueId}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={live}
            >
              <Settings2 size={15} strokeWidth={2} /> Manage league
            </Link>
          )}
          {leagueId && (
            <Link
              href={`/leagues/${leagueId}/edit`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={live}
            >
              <SlidersHorizontal size={15} strokeWidth={2} /> League settings
            </Link>
          )}
          <Link
            href="/admin/commissioners"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={live}
          >
            <UsersRound size={15} strokeWidth={2} /> Manage roles
          </Link>
          <Link
            href="/admin/credentials"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={live}
          >
            <KeyRound size={15} strokeWidth={2} /> Manage logins
          </Link>
          <Link
            href="/teams/new"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={live}
          >
            <UsersRound size={15} strokeWidth={2} /> Create team
          </Link>
          <Link
            href="/teams"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={live}
          >
            <Users size={15} strokeWidth={2} /> Teams
          </Link>
          <button
            type="button"
            disabled
            title="Coming soon"
            className={`${row} text-[color:var(--text-4)] cursor-not-allowed`}
          >
            <Download size={15} strokeWidth={2} /> Export data
            <SoonTag />
          </button>

          <div className="my-1.5 mx-2 h-px bg-[color:var(--hairline)]" />

          <button
            type="button"
            disabled
            title="Coming soon"
            className={`${row} text-[color:var(--down)] opacity-70 cursor-not-allowed`}
          >
            <Archive size={15} strokeWidth={2} /> Archive league
            <SoonTag />
          </button>
        </div>
      )}
    </div>
  );
}
