import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { canMessage } from "@/lib/auth/messaging";
import { TopBar } from "@/components/bdl/top-bar";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { PlayerAvatar } from "@/components/bdl/player-avatar";
import { getThread } from "@/lib/queries/messages";
import { ThreadClient } from "./thread-client";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.playerId) redirect("/messages");
  if (session.playerId === playerId) redirect("/messages");

  const allowed = await canMessage(session, playerId);
  if (!allowed) {
    return (
      <>
        <TopBar active="/" />
        <PageFrame>
          <Link
            href="/messages"
            className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
          >
            <ArrowLeft size={13} /> Messages
          </Link>
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
            You can&apos;t message this player. You must share a league, or be
            a commissioner messaging another commissioner.
          </div>
        </PageFrame>
        <MobileBottomBar active="home" />
      </>
    );
  }

  const thread = await getThread(session.playerId, playerId);
  if (!thread.other) notFound();

  const initials = `${thread.other.firstName[0] ?? ""}${
    thread.other.lastName[0] ?? ""
  }`.toUpperCase();

  return (
    <>
      <TopBar active="/" />
      <PageFrame>
        <Link
          href="/messages"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Messages
        </Link>

        <div className="flex items-center gap-3 pb-2 border-b border-[color:var(--hairline)]">
          <PlayerAvatar
            url={thread.other.avatarUrl}
            initials={initials}
            size={44}
          />
          <div className="min-w-0">
            <div className="font-bold text-[16px] text-[color:var(--text)]">
              {thread.other.firstName} {thread.other.lastName}
            </div>
            <div className="text-[11.5px] text-[color:var(--text-4)] tracking-[0.06em] uppercase">
              Direct message
            </div>
          </div>
        </div>

        <ThreadClient
          otherPlayerId={playerId}
          otherFirstName={thread.other.firstName}
          initialMessages={thread.messages}
          viewerId={session.playerId}
        />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
