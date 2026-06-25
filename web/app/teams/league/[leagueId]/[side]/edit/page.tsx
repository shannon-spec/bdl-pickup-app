import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { canManageLeague } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { getLeagueSideView } from "@/lib/queries/teams";
import { EditLeagueSideClient } from "./edit-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Team · BDL" };

export default async function EditLeagueSidePage({
  params,
}: {
  params: Promise<{ leagueId: string; side: string }>;
}) {
  const { leagueId, side: rawSide } = await params;
  if (rawSide !== "A" && rawSide !== "B") notFound();
  const side = rawSide as "A" | "B";

  const session = await readSession();
  if (!session) redirect("/discover");
  const caps = await getViewCaps(session);
  if (!caps.canManage || !(await canManageLeague(session, leagueId)))
    redirect(`/teams/league/${leagueId}/${side}`);

  const view = await getLeagueSideView(leagueId, side);
  if (!view) notFound();

  return (
    <>
      <TopBar active="/teams" />
      <PageFrame>
        <ContextHeader />
        <Link
          href={`/teams/league/${leagueId}/${side}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> {view.sideName}
        </Link>

        <div>
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            Edit Team
          </div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] mt-0.5">
            {view.sideName}
          </h1>
          <p className="text-[13px] text-[color:var(--text-3)] mt-1">
            {view.league.name} · league team. Set a custom name and avatar for
            this side.
          </p>
        </div>

        <div className="rounded-[16px] bg-[color:var(--surface)] p-6 max-sm:p-5 shadow-[inset_0_0_0_1px_var(--hairline-2)]">
          <EditLeagueSideClient
            leagueId={leagueId}
            side={side}
            initial={{
              name: view.sideName,
              avatarKind: view.avatarKind === "emoji" ? "emoji" : "monogram",
              avatarColor: view.avatarColor,
              avatarEmoji: view.avatarEmoji ?? "",
            }}
          />
        </div>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
