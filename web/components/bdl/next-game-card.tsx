import Link from "next/link";
import { ChevronRight, Check, Pencil } from "lucide-react";
import { Pill } from "@/components/bdl/pill";
import { TeamBadge } from "@/components/bdl/team-badge";

type RosterPlayer = { id: string; firstName: string; lastName: string };

export type NextGameCardProps = {
  /** Link target for the whole card (the game detail page). */
  href: string;
  /** Header pill text. */
  label?: string;
  date: string | null;
  time?: string | null;
  venue?: string | null;
  /** Optional extra context chip (used on the Games tab). */
  leagueName?: string | null;
  teamAName: string;
  teamBName: string;
  /** Optional per-team records; the sub-line is omitted when absent. */
  teamARecord?: { w: number; l: number } | null;
  teamBRecord?: { w: number; l: number } | null;
  recordSuffix?: string;
  mySide?: "A" | "B" | null;
  /** Render the in / not-in status indicator. */
  showStatus?: boolean;
  canEdit?: boolean;
  /** Edit link target; defaults to `href`. */
  editHref?: string;
  /** When set, renders an "All games" link in the header. */
  allGamesHref?: string | null;
  probA?: number | null;
  probB?: number | null;
  predictedScore?: { a: number; b: number } | null;
  rosterA: RosterPlayer[];
  rosterB: RosterPlayer[];
  /** Per-player win % for sorting + pills in the roster lists. */
  winPcts?: Record<string, { pct: number | null }>;
  /** Current user's player id, highlighted in the rosters. */
  meId?: string | null;
};

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtWD(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${WD[d.getDay()]} · ${MO[d.getMonth()]} ${d.getDate()}`;
}
function fmtTime(timeStr: string | null | undefined) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hr = Number(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
}

export function NextGameCard({
  href,
  label = "Next Game",
  date,
  time,
  venue,
  leagueName,
  teamAName,
  teamBName,
  teamARecord,
  teamBRecord,
  recordSuffix = "last 5",
  mySide,
  showStatus = false,
  canEdit = false,
  editHref,
  allGamesHref,
  probA,
  probB,
  predictedScore: ps,
  rosterA,
  rosterB,
  winPcts,
  meId = null,
}: NextGameCardProps) {
  const spread = ps ? Math.abs(ps.a - ps.b) : null;
  const favorite =
    ps && ps.a !== ps.b ? (ps.a > ps.b ? teamAName : teamBName) : null;
  const meta = [
    fmtWD(date),
    time ? fmtTime(time) : "",
    venue ?? "",
    leagueName ?? "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="group relative rounded-[16px] bg-[color:var(--surface-2)] overflow-hidden">
      <Link
        href={href}
        aria-label={`Game details for ${teamAName} vs ${teamBName}`}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)] rounded-[16px]"
      />
      <div className="relative z-[1] p-4 flex flex-col gap-3 pointer-events-none">
        {/* Header — label · when/where, with status (and edit) on the right */}
        <div className="flex items-center gap-3 flex-wrap">
          <Pill tone="brand">{label}</Pill>
          {meta && (
            <span className="text-[16px] max-sm:text-[15px] font-bold tracking-[-0.01em] text-[color:var(--text)]">
              {meta}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2.5">
            {allGamesHref && (
              <Link
                href={allGamesHref}
                className="pointer-events-auto inline-flex items-center gap-1 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
              >
                All games <ChevronRight size={12} />
              </Link>
            )}
            {canEdit && (
              <Link
                href={editHref ?? href}
                className="pointer-events-auto inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[color:var(--surface)] hover:bg-[color:var(--brand-soft)] text-[10.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-2)] hover:text-[color:var(--brand-ink)]"
              >
                <Pencil size={10.5} /> Edit
              </Link>
            )}
            {showStatus &&
              (mySide ? (
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--up)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--up)]" />
                  You&apos;re in
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[color:var(--brand)] text-white text-[10.5px] font-bold uppercase tracking-[0.08em] shadow-[var(--cta-shadow)]">
                  <Check size={11} strokeWidth={3} /> I&apos;m In
                </span>
              ))}
          </div>
        </div>

        {/* Matchup — White (left) vs Dark (right) */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <TeamBadge team="white" size={52} className="shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[22px] max-sm:text-[18px] text-[color:var(--text)] truncate">
                  {teamAName}
                </span>
                {mySide === "A" && <YouTag />}
              </div>
              {teamARecord && (
                <div className="text-[12.5px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                  {teamARecord.w}–{teamARecord.l} {recordSuffix}
                </div>
              )}
            </div>
          </div>
          <span className="text-[color:var(--text-4)] text-[13px] font-semibold tracking-[0.08em]">
            VS
          </span>
          <div className="flex items-center gap-3 min-w-0 flex-row-reverse">
            <TeamBadge team="dark" size={52} className="shrink-0" />
            <div className="min-w-0 text-right">
              <div className="flex items-center justify-end gap-2">
                {mySide === "B" && <YouTag />}
                <span className="font-bold text-[22px] max-sm:text-[18px] text-[color:var(--text)] truncate">
                  {teamBName}
                </span>
              </div>
              {teamBRecord && (
                <div className="text-[12.5px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                  {teamBRecord.w}–{teamBRecord.l} {recordSuffix}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Win probability — with projected + spread folded in below */}
        {((probA != null && probB != null) || ps || spread != null) && (
          <div className="rounded-[12px] bg-[color:var(--surface)] px-4 py-3">
            {probA != null && probB != null && (
              <>
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="font-semibold num text-[color:var(--brand-ink)]">
                    {teamAName} {Math.round(probA)}%
                  </span>
                  <span className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[color:var(--text-3)]">
                    Win Probability
                  </span>
                  <span className="font-semibold num text-[color:var(--text-2)]">
                    {teamBName} {Math.round(probB)}%
                  </span>
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[color:var(--hairline)]">
                  <div style={{ width: `${probA}%` }} className="bg-[color:var(--brand)]" />
                  <div style={{ width: `${probB}%` }} className="bg-[color:var(--text-4)]" />
                </div>
              </>
            )}

            {(ps || spread != null) && (
              <div
                className={`flex items-center justify-between gap-6 ${
                  probA != null && probB != null ? "mt-3" : ""
                }`}
              >
                {ps && (
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.1em] font-semibold text-[color:var(--text-3)]">
                      Projected
                    </div>
                    <div className="font-bold num text-[14px] leading-none mt-0.5">
                      <span className="text-[color:var(--brand-ink)]">{ps.a}</span>
                      <span className="mx-1 text-[color:var(--text-4)]">—</span>
                      <span className="text-[color:var(--text)]">{ps.b}</span>
                    </div>
                  </div>
                )}
                {spread != null && (
                  <div className="text-right">
                    <div className="text-[9px] uppercase tracking-[0.1em] font-semibold text-[color:var(--text-3)]">
                      Spread
                    </div>
                    <div className="font-bold text-[14px] leading-none mt-0.5 text-[color:var(--text)]">
                      {favorite ? (
                        <>
                          {favorite}{" "}
                          <span className="num text-[color:var(--brand-ink)]">−{spread}</span>
                        </>
                      ) : (
                        "Pick"
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Rosters */}
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <RosterCard team="white" name={teamAName} players={rosterA} meId={meId} winPcts={winPcts} />
          <RosterCard team="dark" name={teamBName} players={rosterB} meId={meId} winPcts={winPcts} />
        </div>
      </div>
    </section>
  );
}

function YouTag() {
  return (
    <span className="shrink-0 text-[10px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
      You
    </span>
  );
}

function RosterCard({
  team,
  name,
  players,
  meId,
  winPcts,
}: {
  team: "white" | "dark";
  name: string;
  players: RosterPlayer[];
  meId: string | null;
  winPcts?: Record<string, { pct: number | null }>;
}) {
  // Sort by win % (highest first); unrated players sink to the bottom.
  const sorted = [...players].sort((a, b) => {
    const pa = winPcts?.[a.id]?.pct ?? null;
    const pb = winPcts?.[b.id]?.pct ?? null;
    if (pa === null && pb === null) return 0;
    if (pa === null) return 1;
    if (pb === null) return -1;
    return pb - pa;
  });
  return (
    <div className="rounded-[12px] bg-[color:var(--surface)] px-4 py-3">
      <div
        className={`text-[10.5px] uppercase tracking-[0.12em] font-bold mb-2 ${
          team === "white" ? "text-[color:var(--brand-ink)]" : "text-[color:var(--text-2)]"
        }`}
      >
        {name} · Roster
      </div>
      {players.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {sorted.map((p, i) => {
            const isMe = p.id === meId;
            const pct = winPcts?.[p.id]?.pct ?? null;
            return (
              <li key={p.id}>
                <Link
                  href={`/players/${p.id}`}
                  className={`pointer-events-auto flex items-center gap-2 -mx-1.5 px-1.5 py-0.5 rounded-[6px] text-[14px] leading-tight transition-colors hover:bg-[color:var(--brand-soft)] hover:text-[color:var(--brand-ink)] ${
                    isMe
                      ? "font-semibold text-[color:var(--brand-ink)]"
                      : "font-medium text-[color:var(--text)]"
                  }`}
                >
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-[6px] bg-[color:var(--surface-2)] text-[color:var(--text-3)] text-[11px] font-bold font-[family-name:var(--mono)] num">
                    {i + 1}
                  </span>
                  <span className="min-w-0 truncate">
                    {p.firstName} {p.lastName}
                  </span>
                  {pct !== null && (
                    <Pill tone={pct >= 50 ? "win" : "loss"} className="ml-auto">
                      {pct.toFixed(0)}%
                    </Pill>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-[color:var(--text-3)]">No players yet</p>
      )}
    </div>
  );
}
