import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { getPendingRequestsForManager } from "@/lib/queries/join";
import { TopBar } from "@/components/bdl/top-bar";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { RequestQueue } from "./requests-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join requests · BDL" };

export default async function RequestsPage() {
  const session = await readSession();
  if (!session) redirect("/login?next=/manage/requests");
  const requests = await getPendingRequestsForManager(session);

  return (
    <>
      <TopBar active="/manage" />
      <PageFrame>
        <Link
          href="/manage"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
        >
          <ArrowLeft size={13} /> Manage
        </Link>
        <SectionHead
          title="Join requests"
          count={
            requests.length > 0 ? (
              <span>{requests.length} pending</span>
            ) : undefined
          }
        />
        {requests.length === 0 ? (
          <div className="rounded-[16px] bg-[color:var(--surface-2)] p-10 text-center text-[14px] text-[color:var(--text-3)]">
            No pending requests. New requests to your leagues and teams show up
            here.
          </div>
        ) : (
          <RequestQueue requests={requests} />
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
