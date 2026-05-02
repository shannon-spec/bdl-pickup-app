import { redirect } from "next/navigation";
import { asc, inArray } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { isAdminLike, getMyCommissionerLeagueIds } from "@/lib/auth/perms";
import { db, leagues } from "@/lib/db";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import {
  getConversationsForPlayer,
  getMessageablePlayers,
} from "@/lib/queries/messages";
import { getAuthoredAnnouncements } from "@/lib/queries/announcements";
import { isInviteEmailConfigured } from "@/lib/email/invite-email";
import { MessageCenterClient } from "./list-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Message Center · BDL" };

export default async function MessagesPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.playerId) {
    return (
      <>
        <TopBar active="/" />
        <PageFrame>
          <ContextHeader />
          <SectionHead title="Message Center" />
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
            Your account isn&apos;t linked to a player profile, so messaging
            isn&apos;t available yet.
          </div>
        </PageFrame>
        <MobileBottomBar active="home" />
      </>
    );
  }

  const isAdmin = isAdminLike(session);
  const myCommissioned = await getMyCommissionerLeagueIds(session);
  const isCommissioner = myCommissioned.length > 0;

  // League options for "League Members" audience.
  // Admin → every league; Commissioner → only theirs; Player → none (audience hidden).
  let leagueOptions: { id: string; name: string }[] = [];
  if (isAdmin) {
    leagueOptions = await db
      .select({ id: leagues.id, name: leagues.name })
      .from(leagues)
      .orderBy(asc(leagues.name));
  } else if (isCommissioner) {
    leagueOptions = await db
      .select({ id: leagues.id, name: leagues.name })
      .from(leagues)
      .where(inArray(leagues.id, myCommissioned))
      .orderBy(asc(leagues.name));
  }

  const [conversations, messageable, broadcastHistory] = await Promise.all([
    getConversationsForPlayer(session.playerId),
    getMessageablePlayers(session),
    isAdmin || isCommissioner
      ? getAuthoredAnnouncements(session.playerId, 10)
      : Promise.resolve([]),
  ]);
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <>
      <TopBar active="/" />
      <PageFrame>
        <ContextHeader />
        <SectionHead
          title="Message Center"
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
        <p className="text-[12.5px] text-[color:var(--text-3)] -mt-1">
          {isAdmin
            ? "Send a 1:1 message to anyone, broadcast to a league, or post a global announcement. Channel availability adapts to the audience."
            : isCommissioner
              ? "Send a 1:1 message to any player, or broadcast an announcement to one of your leagues."
              : "Send a 1:1 message to any other BDL player — lands in their in-app inbox."}
        </p>
        <MessageCenterClient
          conversations={conversations}
          messageable={messageable}
          viewerId={session.playerId}
          isAdmin={isAdmin}
          isCommissioner={isCommissioner}
          leagueOptions={leagueOptions}
          emailConfigured={isInviteEmailConfigured()}
          broadcastHistory={broadcastHistory}
        />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
