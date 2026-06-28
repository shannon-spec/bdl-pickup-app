"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, CalendarDays, Trophy } from "lucide-react";
import { LeagueAvatar } from "@/components/bdl/league-avatar";
import { InvitePanel } from "@/components/bdl/invite-panel";
import type { ManageCommunity } from "@/lib/queries/organize";

const TABS = ["Events", "People", "Settings"] as const;
type Tab = (typeof TABS)[number];

function initials(name: string) {
  return (
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() ||
    "•"
  );
}

export function CommunityConsole({ c }: { c: ManageCommunity }) {
  const [tab, setTab] = useState<Tab>("Events");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <LeagueAvatar
          kind={c.avatarKind}
          color={c.avatarColor}
          emoji={c.avatarEmoji}
          abbr={initials(c.name)}
          size={44}
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-[-0.02em] truncate">
            {c.name}
          </h1>
          <div className="text-[12.5px] text-[color:var(--text-3)] capitalize">
            {c.kind ?? "community"} · {c.events.length} events ·{" "}
            {c.members.length} members
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-[color:var(--hairline)] -mb-px overflow-x-auto">
        {TABS.map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setTab(x)}
            className={`px-3.5 py-2.5 text-[13px] font-bold whitespace-nowrap border-b-2 transition-colors ${
              tab === x
                ? "border-[color:var(--brand)] text-[color:var(--text)]"
                : "border-transparent text-[color:var(--text-3)] hover:text-[color:var(--text)]"
            }`}
          >
            {x}
          </button>
        ))}
      </div>

      {tab === "Events" && <Events c={c} />}
      {tab === "People" && <People c={c} />}
      {tab === "Settings" && <Settings c={c} />}
    </div>
  );
}

function Events({ c }: { c: ManageCommunity }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Link
          href={`/manage/new?type=LEAGUE&community=${c.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white text-[12px] font-bold uppercase tracking-[0.04em]"
        >
          <Plus size={15} /> League
        </Link>
        <Link
          href={`/manage/new?type=TOURNAMENT&community=${c.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-[var(--r-lg)] bg-[color:var(--surface)] text-[12px] font-bold uppercase tracking-[0.04em] text-[color:var(--text-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)]"
        >
          <Plus size={15} /> Tournament
        </Link>
      </div>

      {c.events.length === 0 ? (
        <p className="text-[13px] text-[color:var(--text-3)]">
          No events yet. Create a league or tournament owned by this community.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {c.events.map((e) => (
            <Link
              key={`${e.type}:${e.id}`}
              href={
                e.type === "LEAGUE"
                  ? `/manage/league/${e.id}`
                  : `/manage/tournament/${e.id}`
              }
              className="group flex items-center gap-3 rounded-[12px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] px-3.5 py-3 hover:bg-[color:var(--surface-2)] transition-colors"
            >
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[color:var(--surface-2)] text-[color:var(--text-2)] shrink-0">
                {e.type === "LEAGUE" ? (
                  <CalendarDays size={16} />
                ) : (
                  <Trophy size={16} />
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-[14.5px] truncate">
                  {e.name}
                </span>
                <span className="block text-[11.5px] text-[color:var(--text-3)] capitalize">
                  {e.type.toLowerCase()} · {e.published ? "Published" : "Draft"}
                </span>
              </span>
              <ChevronRight
                size={18}
                className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)] shrink-0"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function People({ c }: { c: ManageCommunity }) {
  const organizers = c.members.filter(
    (m) => m.role === "DIRECTOR" || m.role === "COMMISSIONER",
  );
  const others = c.members.filter(
    (m) => m.role !== "DIRECTOR" && m.role !== "COMMISSIONER",
  );
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-3)]">
          Invite organizers
        </p>
        <InvitePanel
          contextType="COMMUNITY"
          contextId={c.id}
          existingTokens={c.pendingInviteTokens}
        />
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-3)] mb-2">
          Organizers ({organizers.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {organizers.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center h-7 px-3 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] text-[12.5px] font-semibold"
            >
              {m.name}
            </span>
          ))}
          {organizers.length === 0 && (
            <span className="text-[13px] text-[color:var(--text-3)]">None</span>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-3)] mb-2">
            Members ({others.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {others.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center h-7 px-3 rounded-full bg-[color:var(--surface-2)] text-[12.5px] font-medium"
              >
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Settings({ c }: { c: ManageCommunity }) {
  return (
    <div className="rounded-[12px] bg-[color:var(--surface-2)] p-4 flex flex-col gap-1.5 text-[13.5px]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[color:var(--text-3)]">Kind</span>
        <span className="font-semibold capitalize">{c.kind ?? "—"}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[color:var(--text-3)]">Events owned</span>
        <span className="font-semibold">{c.events.length}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[color:var(--text-3)]">Members</span>
        <span className="font-semibold">{c.members.length}</span>
      </div>
    </div>
  );
}
