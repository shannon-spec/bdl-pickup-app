import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import {
  isAdminLike,
  getMyCommissionerLeagueIds,
} from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { getLeaguesWithStats } from "@/lib/queries/leagues";
import { NewGameClient } from "./new-game-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedule Game · BDL" };

export default async function NewGamePage() {
  const session = await readSession();
  if (!session) redirect("/discover");
  const caps = await getViewCaps(session);
  if (!caps.canManage) redirect("/games");

  const isAdmin = isAdminLike(session);
  const scopedIds = isAdmin
    ? null
    : await getMyCommissionerLeagueIds(session);
  if (!isAdmin && (!scopedIds || scopedIds.length === 0)) redirect("/games");
  const allLeagues = await getLeaguesWithStats(
    isAdmin ? undefined : { scopeIds: scopedIds! },
  );
  const leagueOptions = allLeagues.map((l) => ({ id: l.id, name: l.name }));

  return (
    <>
      <TopBar active="/games" />
      <PageFrame>
        <ContextHeader />
        <Link
          href="/games"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Games
        </Link>

        <div>
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            Schedule Game
          </div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] mt-0.5">
            Schedule a game
          </h1>
          <p className="text-[13px] text-[color:var(--text-3)] mt-1">
            Pick a league and time. Once it&apos;s on the calendar
            you&apos;ll go straight into the Invite Manager to fill the roster.
          </p>
        </div>

        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 max-sm:p-5">
          <NewGameClient leagues={leagueOptions} />
        </div>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
