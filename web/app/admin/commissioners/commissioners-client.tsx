"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Trophy, X } from "lucide-react";
import { addCommissioner, removeCommissioner } from "@/lib/actions/leagues";

type PlayerLite = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
};

type LeagueRow = {
  id: string;
  name: string;
  season: string | null;
  commissioners: PlayerLite[];
};

export function CommissionersAdminClient({
  leagues,
  allPlayers,
}: {
  leagues: LeagueRow[];
  allPlayers: PlayerLite[];
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return leagues;
    return leagues.filter(
      (l) =>
        l.name.toLowerCase().includes(ql) ||
        (l.season ?? "").toLowerCase().includes(ql) ||
        l.commissioners.some(
          (c) =>
            c.firstName.toLowerCase().includes(ql) ||
            c.lastName.toLowerCase().includes(ql) ||
            (c.email ?? "").toLowerCase().includes(ql),
        ),
    );
  }, [leagues, q]);

  return (
    <>
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-4)]"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search leagues, seasons, or commissioner names"
          className="w-full h-10 pl-9 pr-3 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[14px] outline-none"
        />
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-8 text-center text-[color:var(--text-3)] text-[13px]">
            No matches.
          </div>
        ) : (
          filtered.map((l) => (
            <LeagueCard key={l.id} league={l} allPlayers={allPlayers} />
          ))
        )}
      </div>
    </>
  );
}

function LeagueCard({
  league,
  allPlayers,
}: {
  league: LeagueRow;
  allPlayers: PlayerLite[];
}) {
  const router = useRouter();
  const onIds = new Set(league.commissioners.map((c) => c.id));
  const eligible = allPlayers.filter((p) => !onIds.has(p.id));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");

  const matches = useMemo(() => {
    const ql = pickerQ.trim().toLowerCase();
    const list = ql
      ? eligible.filter(
          (p) =>
            p.firstName.toLowerCase().includes(ql) ||
            p.lastName.toLowerCase().includes(ql) ||
            (p.email ?? "").toLowerCase().includes(ql),
        )
      : eligible;
    return list.slice(0, 8);
  }, [pickerQ, eligible]);

  const onAdd = (playerId: string) => {
    setError(null);
    start(async () => {
      try {
        const res = await addCommissioner(league.id, playerId);
        if (res.ok) {
          setPickerQ("");
          setPickerOpen(false);
          router.refresh();
        } else {
          setError(res.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add commissioner.");
      }
    });
  };
  const onRemove = (player: PlayerLite) => {
    if (
      !confirm(
        `Remove ${player.firstName} ${player.lastName} as commissioner of ${league.name}?`,
      )
    ) {
      return;
    }
    setError(null);
    start(async () => {
      try {
        const res = await removeCommissioner(league.id, player.id);
        if (res.ok) router.refresh();
        else setError(res.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not remove commissioner.");
      }
    });
  };

  return (
    <section className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-[10px] bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
            <Trophy size={16} />
          </span>
          <div className="flex flex-col leading-tight min-w-0">
            <Link
              href={`/leagues/${league.id}`}
              className="font-extrabold text-[15px] text-[color:var(--text)] truncate hover:underline"
            >
              {league.name}
            </Link>
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)] truncate">
              {league.season ? `${league.season} · ` : ""}
              {league.commissioners.length} commissioner
              {league.commissioners.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      {league.commissioners.length === 0 ? (
        <div className="text-[12.5px] text-[color:var(--text-3)]">
          No commissioners assigned.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {league.commissioners.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-2 h-8 pl-3 pr-1 rounded-full border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] text-[12.5px]"
            >
              <span className="font-bold">
                {c.firstName} {c.lastName}
              </span>
              {c.email && (
                <span className="text-[color:var(--text-3)] hidden sm:inline">
                  · {c.email}
                </span>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => onRemove(c)}
                aria-label={`Remove ${c.firstName} ${c.lastName}`}
                className="w-6 h-6 inline-flex items-center justify-center rounded-full text-[color:var(--text-3)] hover:text-[color:var(--down)] hover:bg-[color:var(--down-soft)] disabled:opacity-60"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="border-t border-dashed border-[color:var(--hairline)] pt-3">
        {pickerOpen ? (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-4)]"
              />
              <input
                autoFocus
                value={pickerQ}
                onChange={(e) => setPickerQ(e.target.value)}
                placeholder="Find a player to add as commissioner"
                className="w-full h-10 pl-9 pr-3 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[14px] outline-none"
              />
            </div>
            {matches.length === 0 ? (
              <div className="text-[12px] text-[color:var(--text-3)] px-2 py-1.5">
                No matches — every player is already a commissioner here.
              </div>
            ) : (
              <ul className="flex flex-col rounded-[var(--r-md)] border border-[color:var(--hairline-2)] overflow-hidden">
                {matches.map((p) => (
                  <li
                    key={p.id}
                    className="border-t border-[color:var(--hairline)] first:border-t-0"
                  >
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onAdd(p.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[color:var(--surface-2)] disabled:opacity-60"
                    >
                      <span className="text-[13.5px] font-medium">
                        {p.firstName} {p.lastName}
                        {p.email && (
                          <span className="text-[color:var(--text-3)] font-normal"> · {p.email}</span>
                        )}
                      </span>
                      <Plus size={14} className="text-[color:var(--text-3)]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  setPickerQ("");
                }}
                className="h-9 px-3 text-[12px] font-semibold tracking-[0.04em] uppercase text-[color:var(--text-3)] hover:text-[color:var(--text)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-bold uppercase tracking-[0.06em] hover:bg-[color:var(--surface-2)]"
          >
            <Plus size={13} /> Add commissioner
          </button>
        )}
      </div>

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}
    </section>
  );
}
