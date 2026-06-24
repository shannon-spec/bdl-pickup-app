import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { NewTeamClient } from "./new-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Team · BDL" };

export default async function NewTeamPage() {
  const session = await readSession();
  if (!session) redirect("/discover");
  const caps = await getViewCaps(session);
  if (!caps.canManage) redirect("/");

  return (
    <>
      <TopBar active="/players" />
      <PageFrame>
        <ContextHeader />
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Back
        </Link>

        <div>
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            New Team
          </div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] mt-0.5">
            Create a team
          </h1>
          <p className="text-[13px] text-[color:var(--text-3)] mt-1">
            A standalone travel team with its own roster that plays games
            against other teams. You&apos;ll be added as the team admin so you
            can manage the roster and schedule games right away.
          </p>
        </div>

        <div className="rounded-[16px] bg-[color:var(--surface)] p-6 max-sm:p-5 shadow-[inset_0_0_0_1px_var(--hairline-2)]">
          <NewTeamClient />
        </div>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
