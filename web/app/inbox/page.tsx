import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { getInboxForPlayer } from "@/lib/queries/announcements";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox · BDL" };

export default async function InboxPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.playerId) {
    return (
      <>
        <TopBar active="/" />
        <PageFrame>
          <ContextHeader />
          <SectionHead title="Inbox" />
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
            Your account isn&apos;t linked to a player profile, so there&apos;s
            no inbox yet.
          </div>
        </PageFrame>
        <MobileBottomBar active="home" />
      </>
    );
  }

  const items = await getInboxForPlayer(session.playerId);
  const unreadCount = items.filter((i) => !i.readAt).length;

  return (
    <>
      <TopBar active="/" />
      <PageFrame>
        <ContextHeader />
        <SectionHead
          title="Inbox"
          count={
            unreadCount > 0 ? (
              <span className="text-[color:var(--brand)]">
                {unreadCount} unread
              </span>
            ) : (
              <span>{items.length}</span>
            )
          }
        />
        <InboxClient items={items} unreadCount={unreadCount} />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
