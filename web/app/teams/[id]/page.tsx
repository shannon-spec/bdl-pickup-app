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
import { TeamRosterControls } from "./team-detail-client";

const fmtDate = (d: string | null) => {
  if (!d) return "TBD";
  const dt = new Date(d + "T00:00:00");
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()]} · ${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getMonth()]
  } ${dt.getDate()}`;
};

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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getTeamDetail(id);
  if (!detail) notFound();

  const session = await readSession();
  const caps = await getViewCaps(session);
  const canManage = caps.canManage && (await canManageTeam(session, id));
  const eligible = canManage ? await getEligibleTeamMembers(id) : [];
  const teamGames = await getTeamGames(id);

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

        {/* Cumulative leaderboard lands here in Phase 3. */}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
