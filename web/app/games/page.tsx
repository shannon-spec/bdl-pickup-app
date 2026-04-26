import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
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
import { Pill } from "@/components/bdl/pill";
import { TeamBadge } from "@/components/bdl/team-badge";
import { ProbabilityBar } from "@/components/bdl/probability-bar";
import { HeroTag, isHeroGame } from "@/components/bdl/hero-tag";
import { getGamesList } from "@/lib/queries/games";
import { getLeaguesWithStats } from "@/lib/queries/leagues";
import { GamesPageClient } from "./games-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Games · BDL" };

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

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; status?: "all" | "upcoming" | "completed" }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login");
  const caps = await getViewCaps(session);
  const isAdmin = isAdminLike(session);
  // Lens-driven scoping: in commissioner view, even a super admin sees
  // only the leagues they actually commission. Real admin view = all.
  // In player view, scope to leagues the viewer is a member of.
  const useAdminScope = caps.view === "admin" && isAdmin;
  const scopedLeagueIds = useAdminScope
    ? null
    : caps.view === "commissioner"
      ? await getMyCommissionerLeagueIds(session)
      : await getMyMemberLeagueIds(session);
  if (!useAdminScope && (!scopedLeagueIds || scopedLeagueIds.length === 0)) {
    redirect("/");
  }

  const sp = await searchParams;
  const filter = {
    leagueId: sp.league || null,
    status: (sp.status ?? "all") as "all" | "upcoming" | "completed",
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
  const listRows = heroGame ? rows.filter((g) => g.id !== heroGame.id) : rows;

  // Last-5 win rate within the hero game's league → simple A/B odds.
  let heroProb: { probA: number; probB: number } | null = null;
  if (heroGame) {
    const completedSameLeague = rows
      .filter(
        (g) =>
          g.leagueId === heroGame.leagueId &&
          ((g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null),
      )
      .sort((a, b) => (a.gameDate ?? "").localeCompare(b.gameDate ?? ""))
      .slice(-5);
    let aW = 0, aTot = 0, bW = 0, bTot = 0;
    for (const g of completedSameLeague) {
      const w =
        g.winTeam ??
        (g.scoreA !== null && g.scoreB !== null
          ? g.scoreA > g.scoreB ? "A" : g.scoreB > g.scoreA ? "B" : "Tie"
          : null);
      if (!w || w === "Tie") continue;
      if (w === "A") { aW++; aTot++; bTot++; } else { bW++; bTot++; aTot++; }
    }
    const aRate = aTot > 0 ? aW / aTot : 0.5;
    const bRate = bTot > 0 ? bW / bTot : 0.5;
    const denom = aRate + bRate || 1;
    const probA = Math.round((aRate / denom) * 100);
    heroProb = { probA, probB: 100 - probA };
  }

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
    let aW = 0, aL = 0, bW = 0, bL = 0;
    for (const g of completed) {
      const w =
        g.winTeam ??
        (g.scoreA !== null && g.scoreB !== null
          ? g.scoreA > g.scoreB ? "A" : g.scoreB > g.scoreA ? "B" : "Tie"
          : null);
      if (!w || w === "Tie") continue;
      if (w === "A") { aW++; bL++; } else { bW++; aL++; }
    }
    const streak = (forSide: "A" | "B") => {
      let type: "W" | "L" | null = null;
      let count = 0;
      for (let i = completed.length - 1; i >= 0; i--) {
        const g = completed[i];
        const w =
          g.winTeam ??
          (g.scoreA !== null && g.scoreB !== null
            ? g.scoreA > g.scoreB ? "A" : g.scoreB > g.scoreA ? "B" : "Tie"
            : null);
        if (!w || w === "Tie") break;
        const won = w === forSide;
        if (type === null) {
          type = won ? "W" : "L";
          count = 1;
        } else if (type === (won ? "W" : "L")) count++;
        else break;
      }
      return { streakType: type, streakCount: count };
    };
    const sample = completed[0] ?? rows[0];
    const aName = sample?.teamAName ?? "White";
    const bName = sample?.teamBName ?? "Dark";
    teamStats = {
      totalCompleted: completed.length,
      a: {
        name: aName,
        wins: aW,
        losses: aL,
        pct: aW + aL > 0 ? (aW / (aW + aL)) * 100 : null,
        ...streak("A"),
      },
      b: {
        name: bName,
        wins: bW,
        losses: bL,
        pct: bW + bL > 0 ? (bW / (bW + bL)) * 100 : null,
        ...streak("B"),
      },
    };
  }

  return (
    <>
      <TopBar active="/games" userInitials={session.username.slice(0, 2).toUpperCase()} />
      <PageFrame>
        <ContextHeader />
        {caps.canManage && (
          <>
            <CommissionerStrip leagueId={filter.leagueId ?? undefined} />
            <MembersStrip leagueId={filter.leagueId ?? undefined} />
          </>
        )}
        {caps.canManage ? (
          <GamesPageClient leagues={allLeagues}>
            {renderListing()}
          </GamesPageClient>
        ) : (
          renderListing()
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );

  function renderListing() {
    return (
      <>
        {heroGame && (
          <section
            className="relative rounded-[16px] border border-[color:var(--hairline-2)] overflow-hidden"
            style={{
              background:
                "radial-gradient(ellipse at top left, var(--next-game-tint), transparent 60%), var(--surface)",
            }}
          >
            <Link
              href={`/games/${heroGame.id}`}
              aria-label={`Game details for ${heroGame.teamAName} vs ${heroGame.teamBName}`}
              className="absolute inset-0 z-0 rounded-[16px]"
            />
            <div className="absolute top-2.5 right-2.5 z-10">
              <Pill tone="brand">Next up</Pill>
            </div>
            <div className="relative z-[1] px-5 py-4 flex flex-col gap-2.5 pointer-events-none">
              <div className="flex items-center gap-2.5 flex-wrap text-[12px] pr-[110px]">
                <Pill tone="brand">
                  Next · {fmtDate(heroGame.gameDate)}
                  {heroGame.gameTime ? ` · ${fmtTime(heroGame.gameTime)}` : ""}
                </Pill>
                {heroGame.leagueName && (
                  <span className="text-[color:var(--text-3)]">{heroGame.leagueName}</span>
                )}
                {heroGame.venue && (
                  <span className="text-[color:var(--text-3)]">· {heroGame.venue}</span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2.5">
                  <TeamBadge team="white" />
                  <span className="font-extrabold text-[18px] text-[color:var(--text)]">
                    {heroGame.teamAName}
                  </span>
                </div>
                <span className="text-[color:var(--text-4)] text-[12px] font-medium">vs</span>
                <div className="inline-flex items-center gap-2.5">
                  <TeamBadge team="dark" />
                  <span className="font-extrabold text-[18px] text-[color:var(--text)]">
                    {heroGame.teamBName}
                  </span>
                </div>
              </div>
              {heroProb && (
                <ProbabilityBar
                  aLabel={heroGame.teamAName}
                  bLabel={heroGame.teamBName}
                  a={heroProb.probA}
                  b={heroProb.probB}
                  compact
                />
              )}
            </div>
          </section>
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

        <FilterBar selected={filter.status} leagueId={filter.leagueId} leagues={allLeagues} />

        {listRows.length === 0 ? (
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
            {heroGame ? "No other games match the current filter." : "No games match the current filter."}
          </div>
        ) : (
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
            {listRows.map((g) => {
                const completed =
                  (g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null;
                const isHero =
                  isHeroGame({
                    gameWinner: g.gameWinner,
                    scoreA: g.scoreA,
                    scoreB: g.scoreB,
                  }) && !!g.gameWinnerName;
                return (
                  <Link
                    key={g.id}
                    href={`/games/${g.id}`}
                    className="grid grid-cols-[160px_1fr_auto_auto] max-sm:grid-cols-[1fr_auto] gap-4 items-center px-5 py-3 border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] transition-colors text-[14px]"
                  >
                    <div className="font-bold text-[12.5px]">
                      {fmtDate(g.gameDate)}
                    </div>
                    <div className="min-w-0 max-sm:col-span-2 max-sm:order-3 flex items-center gap-2 flex-wrap">
                      <span className="text-[color:var(--text-3)] text-[12px]">
                        {g.leagueName}
                      </span>
                      <TeamLabel
                        side="A"
                        winTeam={g.winTeam}
                        name={g.teamAName}
                      />
                      <span className="text-[color:var(--text-4)] font-medium">vs</span>
                      <TeamLabel
                        side="B"
                        winTeam={g.winTeam}
                        name={g.teamBName}
                      />
                      {isHero && <HeroTag name={g.gameWinnerName!} size="sm" />}
                    </div>
                    <div className="font-[family-name:var(--mono)] text-[13px] num">
                      {g.scoreA !== null && g.scoreB !== null ? (
                        <>
                          <span className={g.winTeam === "A" ? "" : "text-[color:var(--text-3)]"}>
                            {g.scoreA}
                          </span>
                          <span className="text-[color:var(--text-4)] mx-1">—</span>
                          <span className={g.winTeam === "B" ? "" : "text-[color:var(--text-3)]"}>
                            {g.scoreB}
                          </span>
                        </>
                      ) : (
                        <span className="text-[color:var(--text-3)]">—</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 justify-self-end">
                      {completed ? (
                        g.locked ? (
                          <Pill tone="win" dot>
                            Final
                          </Pill>
                        ) : (
                          <Pill tone="neutral">Open</Pill>
                        )
                      ) : (
                        <Pill tone="neutral">Upcoming</Pill>
                      )}
                      <ChevronRight size={14} className="text-[color:var(--text-3)]" />
                    </div>
                  </Link>
                );
              })}
          </div>
        )}
      </>
    );
  }
}

function FilterBar({
  selected,
  leagueId,
  leagues,
}: {
  selected: "all" | "upcoming" | "completed";
  leagueId: string | null;
  leagues: { id: string; name: string }[];
}) {
  const linkFor = (status: string, lid: string | null) => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (lid) params.set("league", lid);
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
      <Pillish href={linkFor("all", leagueId)} active={selected === "all"}>
        All
      </Pillish>
      <Pillish href={linkFor("upcoming", leagueId)} active={selected === "upcoming"}>
        Upcoming
      </Pillish>
      <Pillish href={linkFor("completed", leagueId)} active={selected === "completed"}>
        Completed
      </Pillish>
      {leagues.length > 1 && (
        <form method="get" action="/games" className="ml-2">
          <input type="hidden" name="status" value={selected === "all" ? "" : selected} />
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
  };
  side: "A" | "B";
}) {
  const isSilver = side === "A";
  const tint = isSilver ? "rgba(170,178,192,.22)" : "rgba(212,175,55,.22)";
  const border = isSilver ? "rgba(170,178,192,.45)" : "rgba(212,175,55,.55)";
  const initial = (t.name[0] ?? "?").toUpperCase();
  const streakTone =
    t.streakType === "W"
      ? "text-[color:var(--up)]"
      : t.streakType === "L"
        ? "text-[color:var(--down)]"
        : "text-[color:var(--text-3)]";
  return (
    <section
      className="rounded-[16px] border border-[color:var(--hairline-2)] overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${tint}, transparent 70%), var(--surface)`,
        borderColor: border,
      }}
    >
      <div className="px-5 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`inline-flex items-center justify-center w-9 h-9 rounded-[10px] font-extrabold text-[14px] ${
              isSilver ? "bg-[var(--tb-white-bg)] text-[var(--tb-white-fg)]" : "bg-[var(--tb-dark-bg)] text-[var(--tb-dark-fg)]"
            }`}
            style={{
              boxShadow: "inset 0 0 0 1px var(--mark-inset)",
            }}
          >
            {initial}
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-extrabold text-[16px] text-[color:var(--text)]">
              {t.name}
            </span>
            <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)]">
              Season
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Record">
            <span className="font-[family-name:var(--mono)] num font-extrabold text-[20px]">
              {t.wins}
              <span className="text-[color:var(--text-4)] font-bold mx-[-2px]">–</span>
              {t.losses}
            </span>
          </Stat>
          <Stat label="Win %">
            <span className="font-[family-name:var(--mono)] num font-extrabold text-[20px]">
              {t.pct === null ? "—" : `${t.pct.toFixed(1)}`}
              {t.pct !== null && (
                <span className="text-[color:var(--text-3)] text-[12px] font-bold ml-0.5">
                  %
                </span>
              )}
            </span>
          </Stat>
          <Stat label="Streak">
            <span
              className={`font-[family-name:var(--mono)] num font-extrabold text-[20px] ${streakTone}`}
            >
              {t.streakType ? `${t.streakType}${t.streakCount}` : "—"}
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

/**
 * Team-name label on a games row. The winning side (A=White, B=Dark) gets
 * a shaded pill — silver for white-team wins, gold for dark-team wins —
 * to telegraph the result without any extra "Won by …" copy. The losing
 * side dims to text-3 to keep the row focused on the winner.
 */
function TeamLabel({
  side,
  winTeam,
  name,
}: {
  side: "A" | "B";
  winTeam: "A" | "B" | "Tie" | null;
  name: string;
}) {
  const isWinner = winTeam === side;
  const isLoser = winTeam === "A" || winTeam === "B" ? !isWinner : false;
  if (isWinner) {
    const isSilver = side === "A"; // White wins → silver; Dark wins → gold
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-extrabold text-[color:var(--text)] border"
        style={{
          background: isSilver
            ? "rgba(170,178,192,.22)"
            : "rgba(212,175,55,.22)",
          borderColor: isSilver
            ? "rgba(170,178,192,.45)"
            : "rgba(212,175,55,.55)",
        }}
      >
        ✓ {name}
      </span>
    );
  }
  return (
    <span
      className={
        isLoser ? "font-medium text-[color:var(--text-3)]" : "font-bold"
      }
    >
      {name}
    </span>
  );
}
