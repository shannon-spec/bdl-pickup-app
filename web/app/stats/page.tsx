import Link from "next/link";
import { eq } from "drizzle-orm";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { readSession } from "@/lib/auth/session";
import { getViewCaps } from "@/lib/auth/view";
import {
  getMyMemberLeagueIds,
  getMyCommissionerLeagueIds,
} from "@/lib/auth/perms";
import { db, leagues } from "@/lib/db";
import { getActiveLeagueId } from "@/lib/cookies/active-league";
import { getLeaguePlayerStats } from "@/lib/queries/player-stats";
import { StatsTable, AwardKey } from "./stats-table";

const EXAMPLE_LEAGUE_NAME = "CPA League";

async function getExampleLeagueId(): Promise<string | null> {
  const [row] = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(eq(leagues.name, EXAMPLE_LEAGUE_NAME))
    .limit(1);
  return row?.id ?? null;
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Player Stats · BDL" };

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string; year?: string }>;
}) {
  const sp = await searchParams;
  const session = await readSession();
  const meId = session?.playerId ?? null;
  const caps = await getViewCaps(session);

  let scopeLeagueIds: string[] | null = null;
  if (caps.view !== "admin") {
    const [memberIds, commishIds] = await Promise.all([
      getMyMemberLeagueIds(session),
      getMyCommissionerLeagueIds(session),
    ]);
    scopeLeagueIds = Array.from(new Set([...memberIds, ...commishIds]));
    if (scopeLeagueIds.length === 0) {
      const exampleId = await getExampleLeagueId();
      if (exampleId) scopeLeagueIds = [exampleId];
    }
  }

  // Stats are always scoped to a single league (no "All leagues" view).
  // Default to the explicit param → active-league cookie → first in scope.
  const activeLeagueId = await getActiveLeagueId();
  const selectedLeagueId =
    sp.league || activeLeagueId || scopeLeagueIds?.[0] || null;

  const data = await getLeaguePlayerStats({
    leagueId: selectedLeagueId,
    year: sp.year || null,
    scopeLeagueIds,
  });
  // If nothing resolved yet (e.g. admin without an active league), fall back
  // to the first available league so a real league is always selected.
  const effectiveLeagueId = selectedLeagueId || data.leagueOptions[0]?.id || null;

  return (
    <>
      <TopBar active="/stats" />
      <PageFrame>
        <ContextHeader />
        <SectionHead
          title="Player Stats"
          count={
            <span>
              {data.players.length} player{data.players.length === 1 ? "" : "s"} ·{" "}
              {data.totalGames} game{data.totalGames === 1 ? "" : "s"} with stats
            </span>
          }
        />

        <FilterBar
          leagueId={effectiveLeagueId}
          year={sp.year || "all"}
          leagues={data.leagueOptions}
          years={data.yearOptions}
        />

        {data.players.length === 0 ? (
          <div className="rounded-[16px] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px] shadow-[inset_0_0_0_1px_var(--hairline-2)]">
            No box-score stats recorded yet. Enter a game&apos;s box score to see
            player stats here.
          </div>
        ) : (
          <>
            <AwardKey />
            <StatsTable rows={data.players} meId={meId} />
          </>
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}

function FilterBar({
  leagueId,
  year,
  leagues,
  years,
}: {
  leagueId: string | null;
  year: string;
  leagues: { id: string; name: string }[];
  years: string[];
}) {
  const linkFor = (lid: string | null, y: string) => {
    const params = new URLSearchParams();
    if (lid) params.set("league", lid);
    if (y && y !== "all") params.set("year", y);
    const qs = params.toString();
    return qs ? `/stats?${qs}` : "/stats";
  };
  const FilterPill = ({
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
      {leagues.map((l) => (
        <FilterPill key={l.id} href={linkFor(l.id, year)} active={leagueId === l.id}>
          {l.name}
        </FilterPill>
      ))}
      <span className="mx-1 text-[color:var(--text-4)]">·</span>
      <FilterPill href={linkFor(leagueId, "all")} active={year === "all"}>
        All time
      </FilterPill>
      {years.map((y) => (
        <FilterPill key={y} href={linkFor(leagueId, y)} active={year === y}>
          {y}
        </FilterPill>
      ))}
    </div>
  );
}
