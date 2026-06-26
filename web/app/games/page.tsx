import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import {
  isAdminLike,
  getMyCommissionerLeagueIds,
  getMyMemberLeagueIds,
} from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { CommissionerStrip } from "@/components/bdl/commissioner-strip";
import { MembersStrip } from "@/components/bdl/members-strip";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { NextGameCard } from "@/components/bdl/next-game-card";
import { GamesListClient } from "./games-list-client";
import {
  getGamesList,
  getGameRosterLite,
  getMatchupOdds,
  getPlayerWinPctsForLeague,
} from "@/lib/queries/games";
import { getLeaguesWithStats } from "@/lib/queries/leagues";

export const dynamic = "force-dynamic";
export const metadata = { title: "Games · BDL" };

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{
    league?: string;
    status?: "all" | "upcoming" | "completed";
    year?: string;
  }>;
}) {
  const session = await readSession();
  const caps = await getViewCaps(session);
  const isAdmin = isAdminLike(session);
  // Lens-driven scoping:
  //   - admin lens (real admin) → all leagues
  //   - commissioner lens → leagues they commission
  //   - player lens → leagues they're a member of
  //   - guest (no session) → all leagues, read-only
  const useAdminScope =
    !session || (caps.view === "admin" && isAdmin);
  const scopedLeagueIds = useAdminScope
    ? null
    : caps.view === "commissioner"
      ? await getMyCommissionerLeagueIds(session!)
      : await getMyMemberLeagueIds(session!);
  // A signed-in player with no league memberships still has a home,
  // so kick them there. Guests + admins fall through.
  if (
    session &&
    !useAdminScope &&
    (!scopedLeagueIds || scopedLeagueIds.length === 0)
  ) {
    redirect("/");
  }

  const sp = await searchParams;
  const filter = {
    leagueId: sp.league || null,
    status: (sp.status ?? "all") as "all" | "upcoming" | "completed",
    year: sp.year || null,
  };

  const [rowsAll, allLeaguesAll] = await Promise.all([
    getGamesList(filter),
    getLeaguesWithStats(useAdminScope ? undefined : { scopeIds: scopedLeagueIds! }),
  ]);

  const rows = useAdminScope
    ? rowsAll
    : rowsAll.filter((g) => g.leagueId && scopedLeagueIds!.includes(g.leagueId));
  const allLeagues = allLeaguesAll;

  // Pull the soonest still-upcoming game out of the listing and render
  // it as a hero card above the rows. Skipped on the "Completed" filter.
  const today = new Date().toISOString().slice(0, 10);
  const heroGame =
    filter.status === "completed"
      ? null
      : rows
          .filter(
            (g) =>
              !((g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null) &&
              (g.gameDate ?? "") >= today,
          )
          .sort((a, b) =>
            (a.gameDate ?? "").localeCompare(b.gameDate ?? "") ||
            (a.gameTime ?? "").localeCompare(b.gameTime ?? ""),
          )[0] ?? null;
  // Keep the next-up game in the list too — it's also shown as the hero
  // card above, but having it in the list is the expected behavior.
  const baseListRows = rows;

  // Years available across the listing (regardless of selected year).
  // Default-active year = the most recent year that has at least one
  // row. If the URL has a year, use that.
  const availableYears = Array.from(
    new Set(baseListRows.map((g) => g.gameDate?.slice(0, 4)).filter(Boolean) as string[]),
  ).sort().reverse();
  const activeYear = filter.year || availableYears[0] || null;
  const listRows = activeYear
    ? baseListRows.filter((g) => g.gameDate?.startsWith(activeYear))
    : baseListRows;

  // Roster for the next-up hero, if attendance is set. Empty arrays
  // render no roster block — the hero falls back to just the matchup.
  const heroRoster = heroGame
    ? await getGameRosterLite(heroGame.id)
    : { A: [], B: [] };

  // Which side (if any) the signed-in player is rostered on — drives the
  // "You're in" status in the hero module.
  const myPlayerId = session?.playerId ?? null;
  const heroMySide: "A" | "B" | null = myPlayerId
    ? heroRoster.A.some((p) => p.id === myPlayerId)
      ? "A"
      : heroRoster.B.some((p) => p.id === myPlayerId)
        ? "B"
        : null
    : null;

  // Blended matchup odds for the hero game (last-8 team trend +
  // average roster win %). Same algorithm as /games/[id].
  const heroProb =
    heroGame && heroGame.leagueId
      ? await getMatchupOdds(
          heroGame.leagueId,
          heroRoster.A.map((p) => p.id),
          heroRoster.B.map((p) => p.id),
          { format: heroGame.format },
        )
      : null;

  // Per-player win % for the hero rosters (sorting + pills).
  const heroWinPcts =
    heroGame && heroGame.leagueId
      ? Object.fromEntries(
          [
            ...(await getPlayerWinPctsForLeague(
              heroGame.leagueId,
              [...heroRoster.A, ...heroRoster.B].map((p) => p.id),
            )),
          ].map(([id, v]) => [id, { pct: v.pct }]),
        )
      : undefined;

  // Team-vs-team season stats hero. Only meaningful when the listing
  // is scoped to a single league (otherwise White / Dark may differ
  // per-league and the lumped count is misleading).
  type TeamStats = {
    name: string;
    wins: number;
    losses: number;
    pct: number | null;
    streakType: "W" | "L" | null;
    streakCount: number;
    bestWinStreak: number;
    bestLossStreak: number;
    avgWinMargin: number | null;
    avgLossMargin: number | null;
  };
  let teamStats: { a: TeamStats; b: TeamStats; totalCompleted: number } | null = null;
  const distinctLeagues = new Set(rows.map((r) => r.leagueId).filter(Boolean));
  if (distinctLeagues.size === 1) {
    const completed = rows
      .filter(
        (g) =>
          (g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null,
      )
      .sort((a, b) => (a.gameDate ?? "").localeCompare(b.gameDate ?? ""));
    // Per-side accumulators for record, streaks (current + best), and
    // average point margins. Margin uses scoreA/scoreB when present;
    // games scored only via winTeam contribute to the record but not
    // the differential.
    const sideStats = (forSide: "A" | "B") => {
      let wins = 0;
      let losses = 0;
      let curType: "W" | "L" | null = null;
      let curCount = 0;
      let bestWin = 0;
      let bestLoss = 0;
      let winMarginSum = 0;
      let winMarginN = 0;
      let lossMarginSum = 0;
      let lossMarginN = 0;
      for (const g of completed) {
        const w =
          g.winTeam ??
          (g.scoreA !== null && g.scoreB !== null
            ? g.scoreA > g.scoreB ? "A" : g.scoreB > g.scoreA ? "B" : "Tie"
            : null);
        if (!w || w === "Tie") continue;
        const won = w === forSide;
        if (won) wins++; else losses++;
        if (curType === (won ? "W" : "L")) {
          curCount++;
        } else {
          curType = won ? "W" : "L";
          curCount = 1;
        }
        if (won) bestWin = Math.max(bestWin, curCount);
        else bestLoss = Math.max(bestLoss, curCount);
        if (g.scoreA !== null && g.scoreB !== null) {
          const myScore = forSide === "A" ? g.scoreA : g.scoreB;
          const oppScore = forSide === "A" ? g.scoreB : g.scoreA;
          const margin = Math.abs(myScore - oppScore);
          if (won) { winMarginSum += margin; winMarginN++; }
          else { lossMarginSum += margin; lossMarginN++; }
        }
      }
      return {
        wins,
        losses,
        streakType: curType,
        streakCount: curCount,
        bestWinStreak: bestWin,
        bestLossStreak: bestLoss,
        avgWinMargin: winMarginN > 0 ? winMarginSum / winMarginN : null,
        avgLossMargin: lossMarginN > 0 ? lossMarginSum / lossMarginN : null,
      };
    };
    const a = sideStats("A");
    const b = sideStats("B");
    const sample = completed[0] ?? rows[0];
    const aName = sample?.teamAName ?? "White";
    const bName = sample?.teamBName ?? "Dark";
    teamStats = {
      totalCompleted: completed.length,
      a: {
        name: aName,
        pct: a.wins + a.losses > 0 ? (a.wins / (a.wins + a.losses)) * 100 : null,
        ...a,
      },
      b: {
        name: bName,
        pct: b.wins + b.losses > 0 ? (b.wins / (b.wins + b.losses)) * 100 : null,
        ...b,
      },
    };
  }

  return (
    <>
      <TopBar active="/games" />
      <PageFrame>
        <ContextHeader />
        {caps.canManage && (
          <>
            <CommissionerStrip leagueId={filter.leagueId ?? undefined} />
            <MembersStrip leagueId={filter.leagueId ?? undefined} />
          </>
        )}
        {renderListing()}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );

  function renderListing() {
    return (
      <>
        {heroGame && (
          <NextGameCard
            href={`/games/${heroGame.id}`}
            label="Next up"
            date={heroGame.gameDate}
            time={heroGame.gameTime}
            venue={heroGame.venue}
            leagueName={heroGame.leagueName}
            teamAName={heroGame.teamAName}
            teamBName={heroGame.teamBName}
            mySide={heroMySide}
            showStatus={heroMySide !== null}
            canEdit={caps.canManage}
            probA={heroProb?.probA ?? null}
            probB={heroProb?.probB ?? null}
            predictedScore={heroProb?.predictedScore ?? null}
            rosterA={heroRoster.A}
            rosterB={heroRoster.B}
            winPcts={heroWinPcts}
            meId={session?.playerId ?? null}
          />
        )}

        {teamStats && teamStats.totalCompleted > 0 && (
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <TeamSeasonCard t={teamStats.a} side="A" />
            <TeamSeasonCard t={teamStats.b} side="B" />
          </div>
        )}

        <SectionHead
          title="Games"
          count={
            <span>
              {rows.length} game{rows.length === 1 ? "" : "s"}
            </span>
          }
        />

        <FilterBar
          selected={filter.status}
          leagueId={filter.leagueId}
          leagues={allLeagues}
          years={availableYears}
          activeYear={activeYear}
        />

        <GamesListClient rows={listRows} />
      </>
    );
  }
}

function FilterBar({
  selected,
  leagueId,
  leagues,
  years,
  activeYear,
}: {
  selected: "all" | "upcoming" | "completed";
  leagueId: string | null;
  leagues: { id: string; name: string }[];
  years: string[];
  activeYear: string | null;
}) {
  const linkFor = ({
    status = selected,
    lid = leagueId,
    year = activeYear,
  }: {
    status?: string;
    lid?: string | null;
    year?: string | null;
  } = {}) => {
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status);
    if (lid) params.set("league", lid);
    if (year) params.set("year", year);
    const qs = params.toString();
    return qs ? `/games?${qs}` : "/games";
  };
  const Pillish = ({
    href,
    active,
    children,
  }: {
    href: string;
    active: boolean;
    children: React.ReactNode;
  }) => (
    <Link
      href={href}
      className={`inline-flex items-center h-8 px-3 rounded-full text-[12px] font-semibold tracking-[0.04em] uppercase transition-colors border ${
        active
          ? "bg-[color:var(--brand)] text-white border-transparent"
          : "bg-[color:var(--surface)] border-[color:var(--hairline-2)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
      }`}
    >
      {children}
    </Link>
  );
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Pillish href={linkFor({ status: "all" })} active={selected === "all"}>
        All
      </Pillish>
      <Pillish href={linkFor({ status: "upcoming" })} active={selected === "upcoming"}>
        Upcoming
      </Pillish>
      <Pillish href={linkFor({ status: "completed" })} active={selected === "completed"}>
        Completed
      </Pillish>
      {years.length > 0 && (
        <>
          <span className="mx-1 text-[color:var(--text-4)]" aria-hidden>·</span>
          {years.map((y) => (
            <Pillish key={y} href={linkFor({ year: y })} active={activeYear === y}>
              {y}
            </Pillish>
          ))}
        </>
      )}
      {leagues.length > 1 && (
        <form method="get" action="/games" className="ml-2">
          <input type="hidden" name="status" value={selected === "all" ? "" : selected} />
          {activeYear && <input type="hidden" name="year" value={activeYear} />}
          <select
            name="league"
            defaultValue={leagueId ?? ""}
            className="h-8 rounded-full border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-3 text-[12px] cursor-pointer"
            suppressHydrationWarning
          >
            <option value="">All leagues</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <noscript>
            <button type="submit" className="ml-2 h-8 px-3 rounded-full text-[12px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)]">Apply</button>
          </noscript>
        </form>
      )}
    </div>
  );
}

/**
 * Season summary card for one team. Mirrors the gold/silver tinting used
 * elsewhere — silver for the A side ("White"-style team), gold for B
 * ("Dark"-style team). Win % is null when the team hasn't played yet.
 */
function TeamSeasonCard({
  t,
  side,
}: {
  t: {
    name: string;
    wins: number;
    losses: number;
    pct: number | null;
    streakType: "W" | "L" | null;
    streakCount: number;
    bestWinStreak: number;
    bestLossStreak: number;
    avgWinMargin: number | null;
    avgLossMargin: number | null;
  };
  side: "A" | "B";
}) {
  const isSilver = side === "A";
  const tint = isSilver ? "rgba(170,178,192,.22)" : "rgba(212,175,55,.22)";
  const border = isSilver ? "rgba(170,178,192,.45)" : "rgba(212,175,55,.55)";
  const initial = (t.name[0] ?? "?").toUpperCase();
  const fmtMargin = (m: number | null) =>
    m === null ? "—" : m.toFixed(1);
  return (
    <section
      className="rounded-[16px] border border-[color:var(--hairline-2)] overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${tint}, transparent 70%), var(--surface)`,
        borderColor: border,
      }}
    >
      <div className="px-5 py-3.5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`inline-flex items-center justify-center w-8 h-8 rounded-[10px] font-extrabold text-[13px] ${
              isSilver ? "bg-[var(--tb-white-bg)] text-[var(--tb-white-fg)]" : "bg-[var(--tb-dark-bg)] text-[var(--tb-dark-fg)]"
            }`}
            style={{
              boxShadow: "inset 0 0 0 1px var(--mark-inset)",
            }}
          >
            {initial}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-extrabold text-[16px] text-[color:var(--text)] leading-none">
              {t.name}
            </span>
            <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)] leading-none">
              Season
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
          <Stat label="Record">
            <span className="font-[family-name:var(--mono)] num font-extrabold text-[18px]">
              {t.wins}
              <span className="text-[color:var(--text-4)] font-bold mx-[-2px]">–</span>
              {t.losses}
            </span>
          </Stat>
          <Stat label="Win %">
            <span className="font-[family-name:var(--mono)] num font-extrabold text-[18px]">
              {t.pct === null ? "—" : `${t.pct.toFixed(1)}`}
              {t.pct !== null && (
                <span className="text-[color:var(--text-3)] text-[11px] font-bold ml-0.5">
                  %
                </span>
              )}
            </span>
          </Stat>
          <Stat label="Best W / L">
            <span className="font-[family-name:var(--mono)] num font-extrabold text-[18px]">
              <span className="text-[color:var(--up)]">
                {t.bestWinStreak > 0 ? `W${t.bestWinStreak}` : "—"}
              </span>
              <span className="text-[color:var(--text-4)] font-bold mx-1">·</span>
              <span className="text-[color:var(--down)]">
                {t.bestLossStreak > 0 ? `L${t.bestLossStreak}` : "—"}
              </span>
            </span>
          </Stat>
          <Stat label="Avg +/− · Wins">
            <span className="font-[family-name:var(--mono)] num font-extrabold text-[18px] text-[color:var(--up)]">
              {t.avgWinMargin === null ? "—" : `+${fmtMargin(t.avgWinMargin)}`}
            </span>
          </Stat>
          <Stat label="Avg +/− · Losses">
            <span className="font-[family-name:var(--mono)] num font-extrabold text-[18px] text-[color:var(--down)]">
              {t.avgLossMargin === null ? "—" : `−${fmtMargin(t.avgLossMargin)}`}
            </span>
          </Stat>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
        {label}
      </span>
      <span className="leading-none">{children}</span>
    </div>
  );
}

