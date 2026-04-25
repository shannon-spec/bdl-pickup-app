import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { isAdminLike, getMyCommissionerLeagueIds } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { getLeaguesWithStats } from "@/lib/queries/leagues";
import { LeaguesPageClient } from "./leagues-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leagues · BDL" };

export default async function LeaguesPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const caps = await getViewCaps(session);
  if (!caps.canManage) redirect("/");
  const isAdmin = isAdminLike(session);
  const commishLeagueIds = isAdmin ? null : await getMyCommissionerLeagueIds(session);
  if (!isAdmin && (!commishLeagueIds || commishLeagueIds.length === 0)) redirect("/");

  const rows = await getLeaguesWithStats(
    isAdmin ? undefined : { scopeIds: commishLeagueIds! },
  );

  return (
    <>
      <TopBar active="/leagues" userInitials={session.username.slice(0, 2).toUpperCase()} />
      <PageFrame>
        <ContextHeader />
        <LeaguesPageClient canCreate={caps.view === "admin"}>
          <SectionHead
            title="Leagues"
            count={
              <span>
                {rows.length} league{rows.length === 1 ? "" : "s"}
              </span>
            }
          />

          {rows.length === 0 ? (
            <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
              No leagues yet.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
              {rows.map((l) => (
                <Link
                  key={l.id}
                  href={`/leagues/${l.id}`}
                  className="group rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-4 flex flex-col gap-3 hover:border-[color:var(--text-4)] transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, var(--brand), var(--brand-2))",
                      boxShadow: "inset 0 0 0 2px var(--mark-inset)",
                    }}
                  />
                  <div>
                    <div className="font-bold text-[16px] text-[color:var(--text)]">{l.name}</div>
                    <div className="text-[12px] text-[color:var(--text-3)] mt-0.5">
                      {l.season ? `${l.season} · ` : ""}
                      {l.schedule || l.location || "Open league"}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Pill tone="neutral">{l.playerCount} players</Pill>
                      <Pill tone="neutral">
                        {l.completedGames} / {l.totalGames} games
                      </Pill>
                      <Pill tone="brand">{l.format.replace("v", " V ").toUpperCase()}</Pill>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)]"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </LeaguesPageClient>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
