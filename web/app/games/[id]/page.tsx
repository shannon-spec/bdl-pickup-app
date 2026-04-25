import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { canManageGame } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { TeamBadge } from "@/components/bdl/team-badge";
import { Pill } from "@/components/bdl/pill";
import { getGameDetail } from "@/lib/queries/games";
import {
  GameScore,
  GameMetaEditor,
  RosterRow,
  AddRoster,
  DangerZone,
} from "./game-detail-client";

export const dynamic = "force-dynamic";

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()]} · ${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getMonth()]
  } ${dt.getDate()}, ${dt.getFullYear()}`;
};
const fmtTime = (t: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = Number(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
};

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const allowed = await canManageGame(session, id);
  if (!allowed) redirect("/games");
  const caps = await getViewCaps(session);
  if (!caps.canManage) redirect("/");

  const detail = await getGameDetail(id);
  if (!detail) notFound();

  const { game } = detail;
  const completed =
    (game.scoreA !== null && game.scoreB !== null) || game.winTeam !== null;

  return (
    <>
      <TopBar active="/games" userInitials={session.username.slice(0, 2).toUpperCase()} />
      <PageFrame>
        <ContextHeader />
        <Link
          href="/games"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Games
        </Link>

        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-6 py-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div>
              <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
                {game.leagueName ?? "—"} · {game.format.replace("v", " V ").toUpperCase()}
              </div>
              <h1 className="text-[22px] font-extrabold tracking-[-0.03em] mt-0.5">
                {fmtDate(game.gameDate)}
                {game.gameTime ? ` · ${fmtTime(game.gameTime)}` : ""}
              </h1>
              {game.venue && (
                <div className="text-[13px] text-[color:var(--text-3)] mt-0.5">{game.venue}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {completed ? (
                game.locked ? (
                  <Pill tone="win" dot>
                    Final
                  </Pill>
                ) : (
                  <Pill tone="warn">Open</Pill>
                )
              ) : (
                <Pill tone="neutral">Upcoming</Pill>
              )}
            </div>
          </div>

          {/* Big score */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 my-6 max-sm:grid-cols-1 max-sm:gap-3">
            <div className="flex items-center gap-3 max-sm:justify-center">
              <TeamBadge team="white" size={56} />
              <div className="flex flex-col">
                <div className="font-extrabold text-[18px]">{game.teamAName ?? "White"}</div>
                <div className="text-[11px] text-[color:var(--text-3)] uppercase tracking-[0.12em] font-semibold">
                  Team A
                </div>
              </div>
            </div>
            <div className="font-[family-name:var(--mono)] font-extrabold tracking-[-0.03em] num text-center text-[clamp(40px,8vw,72px)] leading-none">
              <span className={game.winTeam === "A" ? "" : "text-[color:var(--text-3)]"}>
                {game.scoreA ?? "—"}
              </span>
              <span className="text-[color:var(--text-4)] mx-3">—</span>
              <span className={game.winTeam === "B" ? "" : "text-[color:var(--text-3)]"}>
                {game.scoreB ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-3 max-sm:justify-center justify-end">
              <div className="flex flex-col text-right max-sm:text-left max-sm:order-2">
                <div className="font-extrabold text-[18px]">{game.teamBName ?? "Dark"}</div>
                <div className="text-[11px] text-[color:var(--text-3)] uppercase tracking-[0.12em] font-semibold">
                  Team B
                </div>
              </div>
              <TeamBadge team="dark" size={56} />
            </div>
          </div>

          <GameScore detail={detail} />
        </div>

        <GameMetaEditor detail={detail} />

        <SectionHead title={`${game.teamAName ?? "White"} (${detail.rosterA.length})`} />
        <RosterPanel detail={detail} side="A" />

        <SectionHead title={`${game.teamBName ?? "Dark"} (${detail.rosterB.length})`} />
        <RosterPanel detail={detail} side="B" />

        <SectionHead title={`Invited (${detail.invited.length})`} />
        <RosterPanel detail={detail} side="invited" />

        <AddRoster
          gameId={game.id}
          eligible={detail.eligible}
          allLeagues={detail.allLeagues}
          currentLeagueId={game.leagueId ?? null}
          teamAName={game.teamAName ?? "White"}
          teamBName={game.teamBName ?? "Dark"}
        />

        <DangerZone gameId={game.id} />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}

function RosterPanel({
  detail,
  side,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getGameDetail>>>;
  side: "A" | "B" | "invited";
}) {
  const list =
    side === "A" ? detail.rosterA : side === "B" ? detail.rosterB : detail.invited;
  return (
    <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
      {list.length === 0 ? (
        <div className="px-5 py-6 text-center text-[color:var(--text-3)] text-[13px]">
          No players.
        </div>
      ) : (
        list.map((p) => (
          <RosterRow
            key={p.id}
            gameId={detail.game.id}
            playerId={p.id}
            name={`${p.firstName} ${p.lastName}`}
            currentSide={side}
            teamAName={detail.game.teamAName ?? "White"}
            teamBName={detail.game.teamBName ?? "Dark"}
          />
        ))
      )}
    </div>
  );
}
