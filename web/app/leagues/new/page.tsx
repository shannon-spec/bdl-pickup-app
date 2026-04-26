import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { NewLeagueClient } from "./new-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "New League · BDL" };

export default async function NewLeaguePage() {
  const session = await readSession();
  if (!session) redirect("/discover");
  const caps = await getViewCaps(session);
  if (!caps.canManage) redirect("/");

  return (
    <>
      <TopBar
        active="/leagues"
        userInitials={session.username.slice(0, 2).toUpperCase()}
      />
      <PageFrame>
        <ContextHeader />
        <Link
          href="/leagues"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Leagues
        </Link>

        <div>
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            New League
          </div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] mt-0.5">
            Create a league
          </h1>
          <p className="text-[13px] text-[color:var(--text-3)] mt-1">
            You&apos;ll automatically be added as commissioner so you can start
            adding members and scheduling games right away.
          </p>
        </div>

        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 max-sm:p-5">
          <NewLeagueClient />
        </div>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
