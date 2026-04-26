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
import { getLeagueDetail } from "@/lib/queries/leagues";
import { EditLeagueClient } from "./edit-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit League · BDL" };

export default async function EditLeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/discover");
  const { id } = await params;
  const allowed = await canManageLeague(session, id);
  if (!allowed) redirect(`/leagues/${id}`);
  const caps = await getViewCaps(session);
  if (!caps.canManage) redirect("/");

  const detail = await getLeagueDetail(id);
  if (!detail) notFound();

  return (
    <>
      <TopBar
        active="/leagues"
      />
      <PageFrame>
        <ContextHeader />
        <Link
          href={`/leagues/${id}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> {detail.league.name}
        </Link>

        <div>
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            Edit League
          </div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] mt-0.5">
            {detail.league.name}
          </h1>
        </div>

        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 max-sm:p-5">
          <EditLeagueClient league={detail.league} />
        </div>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
