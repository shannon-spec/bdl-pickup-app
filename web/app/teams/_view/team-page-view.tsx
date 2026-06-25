import Link from "next/link";
import { ArrowLeft, ChevronRight, Medal, Pencil, Plus } from "lucide-react";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { LeagueAvatar } from "@/components/bdl/league-avatar";
import { Pill } from "@/components/bdl/pill";
import type { TeamGameRow } from "@/lib/queries/teams";

const fmtDate = (d: string | null) => {
  if (!d) return "TBD";
  const dt = new Date(d + "T00:00:00");
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()]} · ${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getMonth()]
  } ${dt.getDate()}`;
};

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center h-7 px-3 rounded-full text-[11.5px] font-bold tracking-[0.02em] transition-colors ${
        active
          ? "bg-[color:var(--brand)] text-white"
          : "bg-[color:var(--surface-2)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
      }`}
    >
      {children}
    </Link>
  );
}

function StatTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] bg-[color:var(--surface)] px-4 py-3 flex flex-col items-center justify-center gap-0.5 text-center">
      <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
        {label}
      </span>
      <span className="font-extrabold text-[20px] tracking-[-0.02em] num font-[family-name:var(--mono)]">
        {children}
      </span>
    </div>
  );
}

function TeamGameCard({ g, teamId }: { g: TeamGameRow; teamId: string }) {
  const isA = g.teamAId === teamId;
  const oppName = isA ? g.teamBName : g.teamAName;
  const oppPlace = [
    isA ? g.teamBCity : g.teamACity,
    isA ? g.teamBState : g.teamAState,
  ]
    .filter(Boolean)
    .join(", ");
  const myScore = isA ? g.scoreA : g.scoreB;
  const oppScore = isA ? g.scoreB : g.scoreA;
  const decided =
    g.winTeam ??
    (g.scoreA !== null && g.scoreB !== null
      ? g.scoreA > g.scoreB
        ? "A"
        : g.scoreB > g.scoreA
          ? "B"
          : "Tie"
      : null);
  const completed = decided !== null;
  const result = !completed
    ? null
    : decided === "Tie"
      ? "Tie"
      : (decided === "A") === isA
        ? "Won"
        : "Lost";
  const ppm =
    myScore !== null && g.gameLengthMinutes && g.gameLengthMinutes > 0
      ? (myScore / g.gameLengthMinutes).toFixed(2)
      : null;

  return (
    <a
      href={`/games/${g.id}`}
      className="flex items-center justify-between gap-3 rounded-[12px] bg-[color:var(--surface)] px-4 py-3 hover:shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <div className="flex flex-col min-w-0">
        {g.gameType === "tournament" && g.tournamentName && (
          <div className="mb-1">
            <Pill tone="brand">
              {g.tournamentName}
              {g.tournamentRound ? ` · ${g.tournamentRound}` : ""}
            </Pill>
          </div>
        )}
        {g.gameType === "exhibition" && (
          <div className="mb-1">
            <Pill tone="neutral">Exhibition</Pill>
          </div>
        )}
        <span className="font-bold text-[14px] truncate">vs {oppName}</span>
        {oppPlace && (
          <span className="text-[11.5px] text-[color:var(--text-3)] mt-0.5 truncate">
            {oppPlace}
          </span>
        )}
        <span className="text-[11.5px] text-[color:var(--text-3)] mt-0.5">
          {fmtDate(g.gameDate)}
          {g.venue ? ` · ${g.venue}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {completed ? (
          <>
            <span className="font-[family-name:var(--mono)] num font-extrabold text-[18px]">
              {myScore}–{oppScore}
            </span>
            {result === "Won" &&
              g.gameType === "tournament" &&
              g.tournamentRound === "Championship" && (
                <Medal
                  size={20}
                  strokeWidth={2.25}
                  className="flex-shrink-0"
                  style={{ color: "#E0A100" }}
                  aria-label="Tournament champion"
                />
              )}
            {result && (
              <Pill
                tone={result === "Won" ? "win" : result === "Lost" ? "loss" : "neutral"}
                className="text-[13px] px-3 py-1.5"
              >
                {result}
              </Pill>
            )}
            {ppm && (
              <span className="font-[family-name:var(--mono)] num text-[11px] text-[color:var(--text-3)] whitespace-nowrap">
                {ppm} PPM
              </span>
            )}
          </>
        ) : (
          <Pill tone="brand">Scheduled</Pill>
        )}
        <ChevronRight size={15} className="text-[color:var(--text-4)]" />
      </div>
    </a>
  );
}

export type TeamRosterMember = {
  id: string;
  firstName: string;
  lastName: string;
  position?: string | null;
};

export type TeamLeaderboardRow = {
  id: string;
  firstName: string;
  lastName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pct: number;
};

export type TeamHeroStats = {
  wins: number;
  losses: number;
  winPct: number | null;
  avgMargin: number | null;
  ppm: number | null;
  hasStats: boolean;
};

export type TeamPageViewProps = {
  /** Powers the context-header switcher's "active team" pill. */
  contextTeam: {
    id: string;
    name: string;
    avatarKind: string;
    avatarColor: string;
    avatarEmoji: string | null;
  };
  backHref: string;
  /** Slate kicker above the name, e.g. "Team · 3 v 3" or "League team · CPA". */
  kicker: string;
  name: string;
  avatarKind: string;
  avatarColor: string;
  avatarEmoji: string | null;
  place?: string | null;
  description?: string | null;
  editHref?: string | null;
  hero: TeamHeroStats;
  games: TeamGameRow[];
  /** The team-id perspective used to render each game card. */
  gamesTeamId: string;
  scheduleHref?: string | null;
  rosterTitle?: string;
  roster: TeamRosterMember[];
  rosterEmptyNote?: string;
  leaderboard: {
    players: TeamLeaderboardRow[];
    totalGames: number;
    tournamentOptions: string[];
    yearOptions: string[];
  };
  activeTournament: string;
  activeSeason: string;
  chipHref: (next: { tournament?: string; season?: string }) => string;
  /** Slot under the leaderboard for roster admin controls (travel teams). */
  rosterAdmin?: React.ReactNode;
  /** Danger-zone slot at the bottom (travel teams). */
  danger?: React.ReactNode;
};

export function TeamPageView(props: TeamPageViewProps) {
  const {
    contextTeam,
    backHref,
    kicker,
    name,
    avatarKind,
    avatarColor,
    avatarEmoji,
    place,
    description,
    editHref,
    hero,
    games,
    gamesTeamId,
    scheduleHref,
    rosterTitle = "Roster",
    roster,
    rosterEmptyNote = "No players yet.",
    leaderboard,
    activeTournament,
    activeSeason,
    chipHref,
    rosterAdmin,
    danger,
  } = props;
  const abbr = (name.trim()[0] ?? "?").toUpperCase();
  // Per-player stats for the roster, sourced from the leaderboard.
  const statByPlayer = new Map(leaderboard.players.map((p) => [p.id, p]));
  const totalGames = leaderboard.totalGames;
  const pctPlayed = (id: string) =>
    totalGames > 0
      ? ((statByPlayer.get(id)?.gamesPlayed ?? 0) / totalGames) * 100
      : 0;
  // Sort by % played, then games won, then name.
  const sortedRoster = [...roster].sort((a, b) => {
    const pa = pctPlayed(a.id);
    const pb = pctPlayed(b.id);
    const wa = statByPlayer.get(a.id)?.wins ?? 0;
    const wb = statByPlayer.get(b.id)?.wins ?? 0;
    return pb - pa || wb - wa || a.lastName.localeCompare(b.lastName);
  });

  return (
    <>
      <TopBar active="/teams" />
      <PageFrame>
        <ContextHeader activeTeam={contextTeam} />
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Back
        </Link>

        {/* Header */}
        <section className="rounded-[16px] bg-[color:var(--surface-2)] px-5 py-4 flex items-center gap-4 flex-wrap">
          <LeagueAvatar
            kind={avatarKind}
            color={avatarColor}
            emoji={avatarEmoji}
            abbr={abbr}
            size={56}
          />
          <div className="flex flex-col min-w-0 flex-1">
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
              {kicker}
            </div>
            <h1 className="text-[24px] font-extrabold tracking-[-0.03em] leading-tight truncate">
              {name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {place && (
                <span className="text-[12.5px] text-[color:var(--text-3)]">{place}</span>
              )}
              <Pill tone="neutral">{roster.length} players</Pill>
            </div>
          </div>
          {editHref && (
            <Link
              href={editHref}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[var(--r-lg)] bg-[color:var(--surface)] text-[12px] font-bold text-[color:var(--text-2)] hover:text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-soft)] transition-colors"
            >
              <Pencil size={13} /> Edit team
            </Link>
          )}
        </section>

        {/* Hero console — team-wide stat strip */}
        {hero.hasStats && (
          <section className="rounded-[16px] bg-[color:var(--surface-2)] p-2 grid grid-cols-4 gap-2 max-sm:grid-cols-2">
            <StatTile label="Record">
              {hero.wins}–{hero.losses}
            </StatTile>
            <StatTile label="Win %">
              {hero.winPct !== null ? `${hero.winPct.toFixed(1)}%` : "—"}
            </StatTile>
            <StatTile label="Avg Margin">
              {hero.avgMargin !== null
                ? `${hero.avgMargin > 0 ? "+" : ""}${hero.avgMargin.toFixed(1)}`
                : "—"}
            </StatTile>
            <StatTile label="PPM">
              {hero.ppm !== null ? hero.ppm.toFixed(2) : "—"}
            </StatTile>
          </section>
        )}

        {description && (
          <p className="text-[13.5px] leading-relaxed text-[color:var(--text-2)] -mt-1">
            {description}
          </p>
        )}

        {/* Roster */}
        <section className="rounded-[16px] bg-[color:var(--surface-2)] p-4">
          <SectionHead title={rosterTitle} count={<span>{roster.length}</span>} />
          {roster.length === 0 ? (
            <div className="mt-3 text-[13px] text-[color:var(--text-3)]">
              {rosterEmptyNote}
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-y-0.5 rounded-[12px] bg-[color:var(--surface)] p-3">
              {sortedRoster.map((p, i) => {
                const st = statByPlayer.get(p.id);
                const played = pctPlayed(p.id);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/players/${p.id}`}
                      className="flex items-center gap-2.5 py-1 rounded-[6px] -mx-1.5 px-1.5 hover:bg-[color:var(--surface-2)] transition-colors"
                    >
                      <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-[6px] bg-[color:var(--surface-2)] text-[color:var(--text-3)] text-[11px] font-bold font-[family-name:var(--mono)] num">
                        {i + 1}
                      </span>
                      <span className="font-medium text-[14px] truncate hover:text-[color:var(--brand)]">
                        {p.firstName} {p.lastName}
                      </span>
                      {p.position && (
                        <span className="flex-shrink-0 text-[11px] font-[family-name:var(--mono)] text-[color:var(--text-4)]">
                          {p.position}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-6 flex-shrink-0">
                        <span className="w-[104px] flex justify-end text-[12px] text-[color:var(--text-2)]">
                          {st && (
                            <span>
                              {st.gamesPlayed} GP · {st.wins} W
                            </span>
                          )}
                        </span>
                        <span className="w-[44px] flex justify-end">
                          {st && (
                            <span
                              title={`${played.toFixed(0)}% of games played`}
                              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap"
                              style={{
                                background: "linear-gradient(180deg, #F6F7F9, #E2E5EA)",
                                color: "#6B7280",
                              }}
                            >
                              {played.toFixed(0)}%
                            </span>
                          )}
                        </span>
                        <span className="w-[44px] flex justify-end">
                          {st && (
                            <Pill tone={st.pct >= 50 ? "win" : "loss"}>
                              {st.pct.toFixed(0)}%
                            </Pill>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Games */}
        <section className="rounded-[16px] bg-[color:var(--surface-2)] p-4">
          <SectionHead
            title="Games"
            count={<span>{games.length}</span>}
            right={
              scheduleHref ? (
                <Link
                  href={scheduleHref}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[color:var(--brand-ink)] hover:text-[color:var(--brand)]"
                >
                  <Plus size={13} strokeWidth={2.5} /> Schedule game
                </Link>
              ) : undefined
            }
          />
          {games.length === 0 ? (
            <div className="mt-3 text-[13px] text-[color:var(--text-3)]">
              No games scheduled yet.
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {games.map((g) => (
                <TeamGameCard key={g.id} g={g} teamId={gamesTeamId} />
              ))}
            </div>
          )}
        </section>

        {/* Roster game data */}
        <section className="rounded-[16px] bg-[color:var(--surface-2)] p-4">
          <SectionHead
            title="Roster Game Data"
            count={
              <span>
                {leaderboard.totalGames} game{leaderboard.totalGames === 1 ? "" : "s"}
              </span>
            }
          />

          {(leaderboard.tournamentOptions.length > 0 ||
            leaderboard.yearOptions.length > 1) && (
            <div className="mt-3 flex flex-col gap-2">
              {leaderboard.tournamentOptions.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Chip href={chipHref({ tournament: "all" })} active={activeTournament === "all"}>
                    All games
                  </Chip>
                  {leaderboard.tournamentOptions.map((t) => (
                    <Chip key={t} href={chipHref({ tournament: t })} active={activeTournament === t}>
                      {t}
                    </Chip>
                  ))}
                </div>
              )}
              {leaderboard.yearOptions.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Chip href={chipHref({ season: "all" })} active={activeSeason === "all"}>
                    All seasons
                  </Chip>
                  {leaderboard.yearOptions.map((y) => (
                    <Chip key={y} href={chipHref({ season: y })} active={activeSeason === y}>
                      {y}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          )}

          {leaderboard.players.length === 0 ? (
            <div className="mt-3 text-[13px] text-[color:var(--text-3)]">
              No completed games yet — play a game and enter a score.
            </div>
          ) : (
            <div className="mt-3 rounded-[12px] bg-[color:var(--surface)] overflow-hidden">
              <div className="grid grid-cols-[28px_1fr_64px_64px_72px] max-sm:grid-cols-[28px_1fr_64px_72px] items-center gap-3 px-4 py-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)] shadow-[inset_0_-1px_0_0_var(--hairline)]">
                <span>#</span>
                <span>Player</span>
                <span className="text-right max-sm:hidden">GP</span>
                <span className="text-right">W–L</span>
                <span className="text-right">Win %</span>
              </div>
              {leaderboard.players.map((p, i) => {
                const pctTone =
                  p.pct >= 50 ? "text-[color:var(--up)]" : "text-[color:var(--down)]";
                const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
                return (
                  <Link
                    key={p.id}
                    href={`/players/${p.id}`}
                    className="grid grid-cols-[28px_1fr_64px_64px_72px] max-sm:grid-cols-[28px_1fr_64px_72px] items-center gap-3 px-4 py-1.5 hover:bg-[color:var(--surface-2)] transition-colors"
                  >
                    <span
                      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-[6px] text-[11px] font-bold font-[family-name:var(--mono)] num ${
                        i === 0
                          ? "bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]"
                          : "bg-[color:var(--surface-2)] text-[color:var(--text-3)]"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[color:var(--brand)] text-white font-bold text-[10px] flex-shrink-0">
                        {initials}
                      </span>
                      <span className="font-medium text-[14px] truncate">
                        {p.firstName} {p.lastName}
                      </span>
                    </span>
                    <span className="text-right text-[12px] font-[family-name:var(--mono)] num text-[color:var(--text-3)] max-sm:hidden">
                      {p.gamesPlayed}
                    </span>
                    <span className="text-right text-[12px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                      {p.wins}–{p.losses}
                    </span>
                    <span className={`text-right font-extrabold text-[13.5px] num ${pctTone}`}>
                      {p.pct.toFixed(1)}%
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          {rosterAdmin && (
            <div className="mt-4 pt-4 shadow-[inset_0_1px_0_0_var(--hairline)]">
              <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
                Roster Admin
              </span>
              {rosterAdmin}
            </div>
          )}
        </section>

        {danger}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
