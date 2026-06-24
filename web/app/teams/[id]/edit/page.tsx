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
import { EditTeamClient } from "./edit-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Team · BDL" };

export default async function EditTeamPage({
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

  return (
    <>
      <TopBar active="/players" />
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
            Edit Team
          </div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] mt-0.5">
            {team.name}
          </h1>
        </div>

        <div className="rounded-[16px] bg-[color:var(--surface)] p-6 max-sm:p-5 shadow-[inset_0_0_0_1px_var(--hairline-2)]">
          <EditTeamClient team={team} />
        </div>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
