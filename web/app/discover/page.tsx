import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { getLeaguesWithStats } from "@/lib/queries/leagues";
import { db, leaguePlayers } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover · BDL" };

export default async function DiscoverPage() {
  // Discover is the public landing page — visitors without a session
  // see the same league directory; "Your leagues" simply collapses.
  const session = await readSession();

  const allLeagues = await getLeaguesWithStats();

  // Which leagues is the signed-in player in?
  const memberSet = new Set<string>();
  if (session?.playerId) {
    const memberships = await db
      .select({ leagueId: leaguePlayers.leagueId })
      .from(leaguePlayers)
      .where(eq(leaguePlayers.playerId, session.playerId));
    for (const m of memberships) memberSet.add(m.leagueId);
  }

  const yours = allLeagues.filter((l) => memberSet.has(l.id));
  const others = allLeagues.filter((l) => !memberSet.has(l.id));

  return (
    <>
      <TopBar
        active="/discover"
      />
      <PageFrame>
        <ContextHeader />
        <SectionHead
          title="Discover"
          count={
            <span>
              {allLeagues.length} league{allLeagues.length === 1 ? "" : "s"}
            </span>
          }
        />

        {yours.length > 0 && (
          <>
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] mt-1">
              Your leagues
            </div>
            <Grid>
              {yours.map((l) => (
                <LeagueCard key={l.id} l={l} mine />
              ))}
            </Grid>
          </>
        )}

        {others.length > 0 && (
          <>
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)] mt-2">
              {yours.length > 0 ? "Other leagues" : "All leagues"}
            </div>
            <Grid>
              {others.map((l) => (
                <LeagueCard key={l.id} l={l} />
              ))}
            </Grid>
          </>
        )}

        {allLeagues.length === 0 && (
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
            No leagues to discover yet.
          </div>
        )}
      </PageFrame>
      <MobileBottomBar active="discover" />
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
      {children}
    </div>
  );
}

function LeagueCard({
  l,
  mine,
}: {
  l: Awaited<ReturnType<typeof getLeaguesWithStats>>[number];
  mine?: boolean;
}) {
  const cap = l.maxPlayers ?? null;
  const spots =
    cap !== null && cap !== undefined ? Math.max(0, cap - l.playerCount) : null;

  return (
    <Link
      href={`/leagues/${l.id}`}
      className={`group rounded-[14px] border p-4 flex flex-col gap-3 transition-colors ${
        mine
          ? "border-[color:var(--brand)]"
          : "border-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:border-[color:var(--text-4)]"
      }`}
      style={
        mine
          ? {
              background:
                "radial-gradient(ellipse at top right, var(--brand-soft), transparent 60%), var(--surface)",
            }
          : undefined
      }
    >
      <div
        className="w-9 h-9 rounded-full"
        style={{
          background: "linear-gradient(135deg, var(--brand), var(--brand-2))",
          boxShadow: "inset 0 0 0 2px var(--mark-inset)",
        }}
      />
      <div>
        <div className="font-bold text-[16px]">{l.name}</div>
        <div className="text-[12px] text-[color:var(--text-3)] mt-0.5">
          {l.season ? `${l.season} · ` : ""}
          {l.schedule || l.location || "Open league"}
        </div>
      </div>
      <div className="flex items-center justify-between mt-auto pt-1 gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {mine && <Pill tone="win" dot>You&apos;re in</Pill>}
          <Pill tone="neutral">{l.playerCount} players</Pill>
          {spots !== null && <Pill tone="neutral">{spots} spot{spots === 1 ? "" : "s"}</Pill>}
        </div>
        <ChevronRight
          size={16}
          className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)]"
        />
      </div>
    </Link>
  );
}
