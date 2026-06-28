"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus, ChevronDown, CalendarDays, Trophy, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreateCaps } from "@/lib/queries/organize";

type Opt = { key: string; href: string; label: string; sub: string; icon: React.ReactNode };

/** "+ Create" with the organize options inline (skips the type-picker step). */
export function CreateMenu({ caps }: { caps: CreateCaps }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const opts: Opt[] = [
    caps.league && {
      key: "LEAGUE",
      href: "/manage/new?type=LEAGUE",
      label: "League",
      sub: "Recurring play · seasons",
      icon: <CalendarDays size={16} />,
    },
    caps.tournament && {
      key: "TOURNAMENT",
      href: "/manage/new?type=TOURNAMENT",
      label: "Tournament",
      sub: "Divisions · brackets",
      icon: <Trophy size={16} />,
    },
    caps.community && {
      key: "COMMUNITY",
      href: "/manage/new?type=COMMUNITY",
      label: "Community",
      sub: "Owns many events",
      icon: <Users2 size={16} />,
    },
  ].filter(Boolean) as Opt[];

  if (opts.length === 0) return null;

  const btn =
    "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white text-[12px] font-bold tracking-[0.03em] uppercase hover:bg-[color:var(--brand-hover)]";

  // Single option → go straight there, no menu.
  if (opts.length === 1) {
    return (
      <Link href={opts[0].href} className={btn}>
        <Plus size={15} /> Create
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={btn} aria-expanded={open}>
        <Plus size={15} /> Create
        <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-[230px] rounded-[12px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] shadow-[0_12px_30px_rgba(0,0,0,.18)] p-1 z-[var(--z-popover)]">
          {opts.map((o) => (
            <Link
              key={o.key}
              href={o.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-2.5 py-2 rounded-[8px] hover:bg-[color:var(--surface-2)] transition-colors"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] shrink-0">
                {o.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-bold leading-tight">{o.label}</span>
                <span className="block text-[11.5px] text-[color:var(--text-3)]">{o.sub}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
