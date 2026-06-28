"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { label: string; href: string; badge?: string };

/** "More ▾" overflow menu for the top bar (desktop only). */
export function MoreMenu({ items, active }: { items: Item[]; active?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!items.length) return null;
  const anyActive = items.some((i) => i.href === active);

  return (
    <div ref={ref} className="relative max-sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1 px-3 py-2 rounded-[10px] text-[12px] font-bold uppercase tracking-[0.07em] transition-colors",
          "hover:bg-[rgba(120,185,255,0.38)] hover:text-white",
          open || anyActive
            ? "bg-[rgba(120,185,255,0.44)] text-white"
            : "text-white/55",
        )}
      >
        More
        <ChevronDown
          size={13}
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 min-w-[180px] rounded-[12px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] shadow-[0_12px_30px_rgba(0,0,0,.18)] p-1 z-[var(--z-popover)]">
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2 rounded-[8px] text-[13px] font-semibold transition-colors",
                i.href === active
                  ? "bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]"
                  : "text-[color:var(--text-2)] hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]",
              )}
            >
              {i.label}
              {i.badge && (
                <span className="inline-flex items-center h-[15px] px-1.5 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] text-[8.5px] font-bold uppercase tracking-[0.06em]">
                  {i.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
