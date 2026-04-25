import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { CommissionerStrip } from "@/components/bdl/commissioner-strip";
import { MembersStrip } from "@/components/bdl/members-strip";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { getRoster } from "@/lib/queries/roster";
import { RosterClient } from "./roster-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Roster · BDL" };

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await readSession();
  const isAdmin =
    session?.role === "owner" || session?.role === "super_admin";
  if (!isAdmin) redirect("/");
  const caps = await getViewCaps(session);
  if (caps.view !== "admin") redirect("/");

  const { q } = await searchParams;
  const rows = await getRoster(q);

  return (
    <>
      <TopBar active="/roster" userInitials={session.username.slice(0, 2).toUpperCase()} />
      <PageFrame>
        <ContextHeader />
        <CommissionerStrip />
        <MembersStrip />
        <SectionHead
          title="Roster"
          count={
            <span>
              {rows.length} player{rows.length === 1 ? "" : "s"}
            </span>
          }
        />
        <RosterClient initialRows={rows} initialQuery={q ?? ""} />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}

// Re-export Pill so the client component shares the same primitive
// (avoids importing it directly in a client component file's tree).
export { Pill };
