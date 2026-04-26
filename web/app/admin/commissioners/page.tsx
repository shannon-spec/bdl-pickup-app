import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { asc } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { isAdminLike } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import {
  db,
  leagues,
  leagueCommissioners,
  players,
} from "@/lib/db";
import { CommissionersAdminClient } from "./commissioners-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Commissioners · Admin · BDL" };

export default async function CommissionersAdminPage() {
  const session = await readSession();
  if (!session) redirect("/discover");
  if (!isAdminLike(session)) redirect("/");
  const caps = await getViewCaps(session);
  if (caps.view !== "admin") redirect("/");

  const [leagueRows, commishRows, playerRows] = await Promise.all([
    db
      .select({
        id: leagues.id,
        name: leagues.name,
        season: leagues.season,
      })
      .from(leagues)
      .orderBy(asc(leagues.name)),
    db
      .select({
        leagueId: leagueCommissioners.leagueId,
        playerId: leagueCommissioners.playerId,
      })
      .from(leagueCommissioners),
    db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        email: players.email,
      })
      .from(players)
      .orderBy(asc(players.lastName), asc(players.firstName)),
  ]);

  const playerById = new Map(playerRows.map((p) => [p.id, p]));
  // Collapse the join table into one entry per league with hydrated
  // commissioner records (already sorted by player last/first name).
  const byLeague = new Map<string, typeof playerRows>();
  for (const c of commishRows) {
    const p = playerById.get(c.playerId);
    if (!p) continue;
    const arr = byLeague.get(c.leagueId) ?? [];
    arr.push(p);
    byLeague.set(c.leagueId, arr);
  }

  const data = leagueRows.map((l) => ({
    id: l.id,
    name: l.name,
    season: l.season,
    commissioners: byLeague.get(l.id) ?? [],
  }));

  return (
    <>
      <TopBar
        active="/admin"
        userInitials={session.username.slice(0, 2).toUpperCase()}
      />
      <PageFrame>
        <ContextHeader />
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Admin
        </Link>

        <SectionHead
          title="Commissioners"
          count={
            <span>
              {leagueRows.length} league{leagueRows.length === 1 ? "" : "s"}
            </span>
          }
        />

        <p className="text-[12.5px] text-[color:var(--text-3)] -mt-1">
          Assign or revoke commissioner roles for any league. Commissioners can
          manage games, rosters, and members for their leagues.
        </p>

        <CommissionersAdminClient leagues={data} allPlayers={playerRows} />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
