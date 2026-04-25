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
        <SectionHead
          title="Games"
          count={
            <span>
              {rows.length} game{rows.length === 1 ? "" : "s"}
            </span>
          }
        />

        <FilterBar selected={filter.status} leagueId={filter.leagueId} leagues={allLeagues} />

        {rows.length === 0 ? (
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
            No games match the current filter.
          </div>
        ) : (
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
            {rows.map((g) => {
                const completed =
                  (g.scoreA !== null && g.scoreB !== null) || g.winTeam !== null;
                return (
                  <Link
                    key={g.id}
                    href={`/games/${g.id}`}
                    className="grid grid-cols-[160px_1fr_auto_auto] max-sm:grid-cols-[1fr_auto] gap-4 items-center px-5 py-3 border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] transition-colors text-[14px]"
                  >
                    <div className="font-bold text-[12.5px]">
                      {fmtDate(g.gameDate)}
                    </div>
                    <div className="min-w-0 max-sm:col-span-2 max-sm:order-3">
                      <span className="text-[color:var(--text-3)] text-[12px] mr-2">
                        {g.leagueName}
                      </span>
                      <span className="font-bold">{g.teamAName}</span>
                      <span className="text-[color:var(--text-4)] mx-2 font-medium">vs</span>
                      <span className="font-bold">{g.teamBName}</span>
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
