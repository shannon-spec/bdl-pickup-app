import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { canManageTeam } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { db, teams } from "@/lib/db";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { getTeamCards } from "@/lib/queries/teams";
import { NewTeamGameClient } from "./new-team-game-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedule Team Game · BDL" };

export default async function NewTeamGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/discover");
  const { id } = await params;
  if (!(await canManageTeam(session, id))) redirect(`/teams/${id}`);
  const caps = await getViewCaps(session);
  if (!caps.canManage) redirect("/");

  const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
  if (!team) notFound();

  const allTeams = await getTeamCards({ all: true });
  const opponents = allTeams
    .filter((t) => t.id !== id)
    .map((t) => ({ id: t.id, name: t.name }));

  return (
    <>
      <TopBar active="/teams" />
      <PageFrame>
        <ContextHeader />
        <Link
          href={`/teams/${id}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> {team.name}
        </Link>

        <div>
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            Schedule Game
          </div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] mt-0.5">
            {team.name} vs …
          </h1>
          <p className="text-[13px] text-[color:var(--text-3)] mt-1">
            Schedule an exhibition or tournament game against another team.
            You&apos;ll build both rosters and enter the score on the game page.
          </p>
        </div>

        <div className="rounded-[16px] bg-[color:var(--surface)] p-6 max-sm:p-5 shadow-[inset_0_0_0_1px_var(--hairline-2)]">
          <NewTeamGameClient
            teamId={id}
            teamName={team.name}
            defaultFormat={team.defaultFormat}
            opponents={opponents}
          />
        </div>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
