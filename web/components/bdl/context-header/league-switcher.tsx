"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus } from "lucide-react";
import type { SessionLeague } from "@/lib/queries/session-context";
import type { View } from "@/lib/cookies/active-view";
import { setActiveLeagueAction } from "@/lib/cookies/active-league";
import { LeagueAvatar } from "@/components/bdl/league-avatar";

export type SwitcherTeam = {
  id: string;
  name: string;
  avatarKind: string;
  avatarColor: string;
  avatarEmoji: string | null;
  /** Optional explicit destination (league sides link to their league). */
  href?: string;
};

export function LeagueSwitcher({
  leagues,
  activeLeagueId,
  view,
  teams = [],
  activeTeam = null,
}: {
  leagues: SessionLeague[];
  activeLeagueId: string;
  view: View;
  /** Teams the viewer is part of (member or commissioner). */
  teams?: SwitcherTeam[];
  /** When viewing a team page, the team to surface as the active context. */
  activeTeam?: SwitcherTeam | null;
}) {
  const canCreate = view === "commissioner" || view === "admin";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        menuRef.current?.contains(t) ||
        triggerRef.current?.contains(t)
      ) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onSelect = (id: string) => {
    if (id === activeLeagueId) {
      setOpen(false);
      return;
    }
    start(async () => {
      await setActiveLeagueAction(id);
      setOpen(false);
      router.refresh();
    });
  };

  const activeLeague = leagues.find((l) => l.id === activeLeagueId) ?? leagues[0];
  const showingTeam = !!activeTeam;
  if (!activeTeam && !activeLeague) return null;

  // When viewing a team, make sure it's listed in the Teams section even if
  // the viewer isn't on its roster.
  const teamList =
    activeTeam && !teams.some((t) => t.id === activeTeam.id)
      ? [activeTeam, ...teams]
      : teams;

  const triggerMeta = showingTeam
    ? "Team"
    : [activeLeague.season, activeLeague.cadence].filter(Boolean).join(" · ");
  const triggerName = showingTeam ? activeTeam!.name : activeLeague.name;

  return (
    <div className="relative inline-flex max-sm:w-full">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Switch context. Current: ${triggerName}.`}
        onClick={() => setOpen((o) => !o)}
        data-open={open || undefined}
        disabled={pending}
        className={[
          "inline-flex items-center gap-2.5 rounded-full",
          "h-10 pl-1 pr-3.5",
          "bg-[color:var(--ctx-surface)]",
          "text-[14px] font-medium text-[color:var(--text)]",
          "hover:opacity-90",
          "transition-opacity",
          "max-sm:w-full max-sm:justify-start",
        ].join(" ")}
    >
        {showingTeam ? (
          <LeagueAvatar
            kind={activeTeam!.avatarKind}
            color={activeTeam!.avatarColor}
            emoji={activeTeam!.avatarEmoji}
            abbr={(activeTeam!.name[0] ?? "?").toUpperCase()}
            size={32}
          />
        ) : (
          <LeagueAvatar
            kind={activeLeague.avatarKind}
            color={activeLeague.avatarColor}
            emoji={activeLeague.avatarEmoji}
            abbr={activeLeague.abbr}
            size={32}
          />
        )}
        <span className="font-bold whitespace-nowrap">{triggerName}</span>
        {triggerMeta && (
          <span
            className={`text-[12px] text-[color:var(--text-3)] whitespace-nowrap ${
              showingTeam
                ? "uppercase tracking-[0.12em] font-semibold"
                : "font-[family-name:var(--mono)] num"
            }`}
          >
            {triggerMeta}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`text-[color:var(--text-3)] transition-transform duration-150 ${open ? "rotate-180 text-[color:var(--text)]" : ""}`}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="listbox"
          aria-label="Switch league"
          className={[
            "absolute z-[var(--z-popover)] left-0 top-[calc(100%+6px)]",
            "min-w-[280px] max-w-[420px]",
            "max-sm:left-0 max-sm:right-0 max-sm:max-w-none",
            "rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)]",
            "shadow-[0_12px_32px_rgba(0,0,0,0.28),0_2px_6px_rgba(0,0,0,0.18)]",
            "overflow-hidden",
            "origin-top-left",
            "animate-[switcher-in_140ms_var(--ease)_both]",
          ].join(" ")}
          style={{
            // Inline keyframe so we don't have to add to globals.
            // Tailwind v4 animate utilities aren't yet wired here.
            animation: "switcher-in 140ms cubic-bezier(.2,.7,.2,1) both",
          }}
        >
          <style>{`
            @keyframes switcher-in {
              from { opacity: 0; transform: translateY(-4px) scale(.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          {!showingTeam && leagues.map((l) => {
            const selected = !showingTeam && l.id === activeLeagueId;
            const longMeta = [l.season, l.cadence, l.timeOfDay].filter(Boolean).join(" · ");
            return (
              <button
                key={l.id}
                role="option"
                type="button"
                aria-selected={selected}
                onClick={() => onSelect(l.id)}
                className={[
                  "w-full flex items-center gap-3 px-4 py-3 text-left",
                  "hover:bg-[color:var(--surface-2)]",
                  selected ? "bg-[color:var(--surface-2)]" : "",
                  "transition-colors",
                ].join(" ")}
              >
                <LeagueAvatar
                  kind={l.avatarKind}
                  color={l.avatarColor}
                  emoji={l.avatarEmoji}
                  abbr={l.abbr}
                  size={32}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[14px] truncate">{l.name}</div>
                  {longMeta && (
                    <div className="font-[family-name:var(--mono)] text-[11.5px] text-[color:var(--text-3)] num truncate">
                      {longMeta}
                    </div>
                  )}
                </div>
                {selected && (
                  <Check size={16} className="text-[color:var(--brand)] flex-shrink-0" />
                )}
              </button>
            );
          })}

          {showingTeam && teamList.length > 0 && (
            <div className="shadow-[inset_0_1px_0_0_var(--hairline)]">
              <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-4)]">
                Teams
              </div>
              {teamList.map((t) => {
                const selected = activeTeam?.id === t.id;
                return (
                  <Link
                    key={t.id}
                    href={t.href ?? `/teams/${t.id}`}
                    onClick={() => setOpen(false)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[color:var(--surface-2)] transition-colors ${
                      selected ? "bg-[color:var(--surface-2)]" : ""
                    }`}
                  >
                    <LeagueAvatar
                      kind={t.avatarKind}
                      color={t.avatarColor}
                      emoji={t.avatarEmoji}
                      abbr={(t.name[0] ?? "?").toUpperCase()}
                      size={28}
                    />
                    <span className="flex-1 min-w-0 font-bold text-[14px] truncate">
                      {t.name}
                    </span>
                    {selected && (
                      <Check
                        size={16}
                        className="text-[color:var(--brand)] flex-shrink-0"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="shadow-[inset_0_1px_0_0_var(--hairline)]">
            <Link
              href={
                showingTeam
                  ? canCreate
                    ? "/teams/new"
                    : "/teams"
                  : canCreate
                    ? "/leagues/new"
                    : "/discover"
              }
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[color:var(--surface-2)] transition-colors"
            >
              <span
                aria-hidden
                className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-dashed border-[color:var(--hairline-2)] text-[color:var(--text-3)] hover:border-[color:var(--brand)] hover:text-[color:var(--brand)] transition-colors flex-shrink-0"
              >
                <Plus size={14} />
              </span>
              <span className="text-[13.5px] font-medium text-[color:var(--text-2)]">
                {showingTeam
                  ? canCreate
                    ? "Create another team"
                    : "All teams"
                  : canCreate
                    ? "Create another league"
                    : "Join another league"}
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

