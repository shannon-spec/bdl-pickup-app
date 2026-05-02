import { redirect } from "next/navigation";
import { asc, inArray } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getMyCommissionerLeagueIds } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { db, leagues } from "@/lib/db";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import {
  getConversationsForPlayer,
  getMessageablePlayers,
} from "@/lib/queries/messages";
import {
  getAuthoredAnnouncements,
  getInboxForPlayer,
} from "@/lib/queries/announcements";
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

  // Gate by ACTIVE VIEW (caps.view) not underlying role — an admin viewing
  // as Commissioner uses commissioner-scoped audiences; switching back to
  // Admin re-enables global broadcasts.
  const caps = await getViewCaps(session);
  const view = caps.view;
  const canGlobal = view === "admin";
  const canLeague = view === "admin" || view === "commissioner";

  // League options for "League Members" audience.
  // Admin view → every league; Commissioner view → only theirs; Player → none.
  let leagueOptions: { id: string; name: string }[] = [];
  if (view === "admin") {
    leagueOptions = await db
      .select({ id: leagues.id, name: leagues.name })
      .from(leagues)
      .orderBy(asc(leagues.name));
  } else if (view === "commissioner") {
    const myCommissioned = await getMyCommissionerLeagueIds(session);
    leagueOptions =
      myCommissioned.length > 0
        ? await db
            .select({ id: leagues.id, name: leagues.name })
            .from(leagues)
            .where(inArray(leagues.id, myCommissioned))
            .orderBy(asc(leagues.name))
        : [];
  }

  const [conversations, messageable, broadcastHistory, inbox] =
    await Promise.all([
      getConversationsForPlayer(session.playerId),
      getMessageablePlayers(session),
      canLeague
        ? getAuthoredAnnouncements(session.playerId, 10)
        : Promise.resolve([]),
      getInboxForPlayer(session.playerId),
    ]);
  const dmUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);
  const inboxUnread = inbox.filter((i) => !i.readAt).length;
  const totalUnread = dmUnread + inboxUnread;

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
              <span>
                {inbox.length + conversations.length} item
                {inbox.length + conversations.length === 1 ? "" : "s"}
              </span>
            )
          }
        />
        <p className="text-[12.5px] text-[color:var(--text-3)] -mt-1">
          {canGlobal
            ? "One place for inbox, conversations, and broadcasts. Channel availability adapts to the audience."
            : canLeague
              ? "One place for inbox, conversations, and league broadcasts."
              : "One place for inbox and 1:1 conversations with other BDL players."}
        </p>
        <MessageCenterClient
          conversations={conversations}
          messageable={messageable}
          viewerId={session.playerId}
          canGlobal={canGlobal}
          canLeague={canLeague}
          leagueOptions={leagueOptions}
          emailConfigured={isInviteEmailConfigured()}
          broadcastHistory={broadcastHistory}
          inbox={inbox}
        />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
