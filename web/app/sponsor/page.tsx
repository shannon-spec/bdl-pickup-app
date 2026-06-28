import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { getPendingSponsorships } from "@/lib/queries/join";
import { TopBar } from "@/components/bdl/top-bar";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { SponsorList } from "./sponsor-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sponsorships · BDL" };

export default async function SponsorPage() {
  const session = await readSession();
  if (!session) redirect("/login?next=/sponsor");
  const requests = await getPendingSponsorships(session);

  return (
    <>
      <TopBar active="/sponsor" />
      <PageFrame>
        <SectionHead
          title="Sponsorships"
          count={
            requests.length > 0 ? <span>{requests.length} pending</span> : undefined
          }
        />
        <p className="text-[13px] text-[color:var(--text-3)] -mt-1">
          Players who listed you as their sponsor when requesting to join. Your
          confirmation vouches for them to the commissioner.
        </p>
        {requests.length === 0 ? (
          <div className="rounded-[16px] bg-[color:var(--surface-2)] p-10 text-center text-[14px] text-[color:var(--text-3)]">
            No sponsorship requests right now.
          </div>
        ) : (
          <SponsorList requests={requests} />
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
