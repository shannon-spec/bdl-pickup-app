"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { LeagueAvatar } from "@/components/bdl/league-avatar";

export type DiscoverItem = {
  type: "league" | "team";
  id: string;
  name: string;
  location: string;
  avatarKind: string;
  avatarColor: string;
  avatarEmoji: string | null;
  href: string;
  role?: string;
};

function initials(name: string) {
  return (
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() ||
    "•"
  );
}

export function DiscoverRow({ item }: { item: DiscoverItem }) {
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3.5 rounded-[14px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] px-3.5 py-3 hover:bg-[color:var(--surface-2)] transition-colors"
    >
      <LeagueAvatar
        kind={item.avatarKind}
        color={item.avatarColor}
        emoji={item.avatarEmoji}
        abbr={initials(item.name)}
        size={40}
      />
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-[15px] tracking-[-0.01em] truncate">
          {item.name}
        </span>
        <span className="block text-[12px] text-[color:var(--text-3)] truncate mt-0.5">
          {item.location || (item.type === "league" ? "League" : "Team")}
        </span>
      </span>
      {item.role ? (
        <span className="shrink-0 inline-flex items-center h-6 px-2.5 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] text-[10.5px] font-bold uppercase tracking-[0.06em]">
          {item.role}
        </span>
      ) : (
        <span className="shrink-0 inline-flex items-center h-6 px-2.5 rounded-full bg-[color:var(--surface-2)] text-[color:var(--text-3)] text-[10.5px] font-bold uppercase tracking-[0.06em]">
          {item.type}
        </span>
      )}
      <ChevronRight
        size={18}
        className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)] shrink-0"
      />
    </Link>
  );
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "league", label: "Leagues" },
  { key: "team", label: "Teams" },
] as const;

export function DiscoverSearch({ items }: { items: DiscoverItem[] }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "league" | "team">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (tab === "all" || i.type === tab) &&
        (needle === "" ||
          i.name.toLowerCase().includes(needle) ||
          i.location.toLowerCase().includes(needle)),
    );
  }, [items, q, tab]);

  const shown = filtered.slice(0, 60);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-3)]"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search leagues & teams by name or location"
          className="h-11 w-full rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] pl-9 pr-3 text-[15px] outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand-soft)]"
        />
      </div>

      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setTab(f.key)}
            className={`h-8 px-3.5 rounded-full text-[12px] font-semibold transition-colors ${
              tab === f.key
                ? "bg-[color:var(--brand)] text-white"
                : "bg-[color:var(--surface-2)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[14px] bg-[color:var(--surface-2)] p-8 text-center text-[13px] text-[color:var(--text-3)]">
          {q ? `No matches for “${q}”.` : "Nothing to browse yet."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((i) => (
            <DiscoverRow key={`${i.type}:${i.id}`} item={i} />
          ))}
        </div>
      )}
      {filtered.length > shown.length && (
        <p className="text-[12px] text-[color:var(--text-3)] text-center">
          Showing {shown.length} of {filtered.length} — refine your search.
        </p>
      )}
    </div>
  );
}
