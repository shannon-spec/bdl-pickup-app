import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { canManageTeam } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { LeagueAvatar } from "@/components/bdl/league-avatar";
import { Pill } from "@/components/bdl/pill";
import { formatLabel } from "@/lib/format";
import {
  getTeamDetail,
  getEligibleTeamMembers,
  getTeamGames,
  type TeamGameRow,
} from "@/lib/queries/teams";
import { getTeamLeaderboard } from "@/lib/queries/leaderboard";
import { TeamRosterControls, DeleteTeamButton } from "./team-detail-client";

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

function TeamGameCard({ g, teamId }: { g: TeamGameRow; teamId: string }) {
  const isA = g.teamAId === teamId;
  const oppName = isA ? g.teamBName : g.teamAName;
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

  return (
    <a
      href={`/games/${g.id}`}
      className="flex items-center justify-between gap-3 rounded-[12px] bg-[color:var(--surface)] px-4 py-3 shadow-[inset_0_0_0_1px_var(--hairline-2)] hover:shadow-[inset_0_0_0_1.5px_var(--text-4)] transition-shadow"
    >
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-[14px] truncate">vs {oppName}</span>
          {g.gameType === "tournament" && g.tournamentName && (
            <Pill tone="brand">{g.tournamentName}</Pill>
          )}
          {g.gameType === "exhibition" && <Pill tone="neutral">Exhibition</Pill>}
        </div>
        <span className="text-[11.5px] text-[color:var(--text-3)] mt-0.5">
          {fmtDate(g.gameDate)}
          {g.venue ? ` · ${g.venue}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {completed ? (
          <>
            <span className="font-[family-name:var(--mono)] num font-extrabold text-[15px]">
              {myScore}–{oppScore}
            </span>
            {result && (
              <Pill tone={result === "Won" ? "win" : result === "Lost" ? "loss" : "neutral"}>
                {result}
              </Pill>
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

export const dynamic = "force-dynamic";

export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tournament?: string; season?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const detail = await getTeamDetail(id);
  if (!detail) notFound();

  const session = await readSession();
  const caps = await getViewCaps(session);
  const canManage = caps.canManage && (await canManageTeam(session, id));
  const eligible = canManage ? await getEligibleTeamMembers(id) : [];
  const teamGames = await getTeamGames(id);
  const leaderboard = await getTeamLeaderboard(id, {
    tournamentName: sp.tournament ?? null,
    year: sp.season ?? null,
  });
  const activeTournament = sp.tournament ?? "all";
  const activeSeason = sp.season ?? "all";
  const chipHref = (next: { tournament?: string; season?: string }) => {
    const t = next.tournament ?? activeTournament;
    const s = next.season ?? activeSeason;
    const qs = new URLSearchParams();
    if (t !== "all") qs.set("tournament", t);
    if (s !== "all") qs.set("season", s);
    const str = qs.toString();
    return str ? `/teams/${id}?${str}` : `/teams/${id}`;
  };

  const { team, roster } = detail;
  const place = [team.city, team.state].filter(Boolean).join(", ");
  const abbr = (team.name.trim()[0] ?? "?").toUpperCase();

  return (
    <>
      <TopBar active="/players" />
      <PageFrame>
        <ContextHeader />
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Back
        </Link>

        {/* Header */}
        <section className="rounded-[16px] bg-[color:var(--surface)] px-5 py-4 shadow-[inset_0_0_0_1px_var(--hairline-2)] flex items-center gap-4 flex-wrap">
          <LeagueAvatar
            kind={team.avatarKind}
            color={team.avatarColor}
            emoji={team.avatarEmoji}
            abbr={abbr}
            size={56}
          />
          <div className="flex flex-col min-w-0 flex-1">
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
              Team · {formatLabel(team.defaultFormat)}
            </div>
            <h1 className="text-[24px] font-extrabold tracking-[-0.03em] leading-tight truncate">
              {team.name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {place && (
                <span className="text-[12.5px] text-[color:var(--text-3)]">{place}</span>
              )}
              <Pill tone="neutral">{roster.length} players</Pill>
            </div>
          </div>
          {canManage && (
            <Link
              href={`/teams/${id}/edit`}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[var(--r-lg)] bg-[color:var(--surface)] text-[12px] font-bold text-[color:var(--text-2)] hover:text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-soft)] transition-colors shadow-[inset_0_0_0_1px_var(--hairline-2)]"
            >
              <Pencil size={13} /> Edit team
            </Link>
          )}
        </section>

        {team.description && (
          <p className="text-[13.5px] leading-relaxed text-[color:var(--text-2)] -mt-1">
            {team.description}
          </p>
        )}

        {/* Roster */}
        <section className="rounded-[16px] bg-[color:var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--hairline-2)]">
          <SectionHead title="Roster" count={<span>{roster.length}</span>} />
          {roster.length === 0 ? (
            <div className="mt-3 text-[13px] text-[color:var(--text-3)]">
              No players yet.{canManage ? " Add players below." : ""}
            </div>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-0.5 max-sm:grid-cols-1">
              {roster.map((p, i) => (
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
                      <span className="ml-auto text-[12px] font-[family-name:var(--mono)] text-[color:var(--text-4)]">
                        {p.position}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <TeamRosterControls teamId={id} members={roster} eligible={eligible} />
          )}
        </section>

        {/* Games */}
        <section className="rounded-[16px] bg-[color:var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--hairline-2)]">
          <SectionHead
            title="Games"
            count={<span>{teamGames.length}</span>}
            right={
              canManage ? (
                <Link
                  href={`/teams/${id}/games/new`}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[color:var(--brand-ink)] hover:text-[color:var(--brand)]"
                >
                  <Plus size={13} strokeWidth={2.5} /> Schedule game
                </Link>
              ) : undefined
            }
          />
          {teamGames.length === 0 ? (
            <div className="mt-3 text-[13px] text-[color:var(--text-3)]">
              No games scheduled yet.
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {teamGames.map((g) => (
                <TeamGameCard key={g.id} g={g} teamId={id} />
              ))}
            </div>
          )}
        </section>

        {/* Cumulative leaderboard */}
        <section className="rounded-[16px] bg-[color:var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--hairline-2)]">
          <SectionHead
            title="Leaderboard"
            count={
              <span>
                {leaderboard.totalGames} game{leaderboard.totalGames === 1 ? "" : "s"}
              </span>
            }
          />

          {(leaderboard.tournamentOptions.length > 0 ||
            leaderboard.yearOptions.length > 0) && (
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
            <div className="mt-3 rounded-[12px] bg-[color:var(--surface)] shadow-[inset_0_0_0_1px_var(--hairline)] overflow-hidden">
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
        </section>

        {/* Danger zone */}
        {canManage && (
          <section className="rounded-[16px] bg-[color:var(--surface)] px-5 py-4 shadow-[inset_0_0_0_1px_var(--hairline-2)] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
                Danger Zone
              </span>
              <span className="text-[12.5px] text-[color:var(--text-3)]">
                Permanently delete this team, its roster links, and unlink its games.
              </span>
            </div>
            <DeleteTeamButton teamId={id} teamName={team.name} />
          </section>
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
