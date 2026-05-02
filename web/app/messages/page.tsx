import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { getConversationsForPlayer } from "@/lib/queries/messages";
import { getMessageablePlayers } from "@/lib/queries/messages";
import { MessagesListClient } from "./list-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages · BDL" };

export default async function MessagesPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.playerId) {
    return (
      <>
        <TopBar active="/" />
        <PageFrame>
          <ContextHeader />
          <SectionHead title="Messages" />
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
            Your account isn&apos;t linked to a player profile, so there&apos;s
            no messaging yet.
          </div>
        </PageFrame>
        <MobileBottomBar active="home" />
      </>
    );
  }

  const [conversations, messageable] = await Promise.all([
    getConversationsForPlayer(session.playerId),
    getMessageablePlayers(session),
  ]);
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <>
      <TopBar active="/" />
      <PageFrame>
        <ContextHeader />
        <SectionHead
          title="Messages"
          count={
            totalUnread > 0 ? (
              <span className="text-[color:var(--brand)]">
                {totalUnread} unread
              </span>
            ) : (
              <span>{conversations.length}</span>
            )
          }
        />
        <MessagesListClient
          conversations={conversations}
          messageable={messageable}
          viewerId={session.playerId}
        />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
