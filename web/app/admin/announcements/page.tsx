import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { asc, inArray } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { isAdminLike, getMyCommissionerLeagueIds } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { db, leagues } from "@/lib/db";
import { getAuthoredAnnouncements } from "@/lib/queries/announcements";
import { isInviteEmailConfigured } from "@/lib/email/invite-email";
import { ComposerClient } from "./composer-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Announcements · BDL" };

export default async function AnnouncementsPage() {
  const session = await readSession();
  if (!session) redirect("/discover");
  const caps = await getViewCaps(session);
  if (!caps.canManage) redirect("/");

  const isAdmin = isAdminLike(session);
  if (!isAdmin) {
    const mine = await getMyCommissionerLeagueIds(session);
    if (mine.length === 0) redirect("/");
  }

  // League dropdown options. Admins see everything; commissioners see
  // just the leagues they manage.
  let leagueOptions: { id: string; name: string }[] = [];
  if (isAdmin) {
    leagueOptions = await db
      .select({ id: leagues.id, name: leagues.name })
      .from(leagues)
      .orderBy(asc(leagues.name));
  } else {
    const myIds = await getMyCommissionerLeagueIds(session);
    leagueOptions =
      myIds.length > 0
        ? await db
            .select({ id: leagues.id, name: leagues.name })
            .from(leagues)
            .where(inArray(leagues.id, myIds))
            .orderBy(asc(leagues.name))
        : [];
  }

  const history = session.playerId
    ? await getAuthoredAnnouncements(session.playerId, 20)
    : [];

  return (
    <>
      <TopBar active="/admin" />
      <PageFrame>
        <ContextHeader />
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Admin
        </Link>

        <SectionHead
          title="Announcements"
          right={
            <Link
              href="/messages"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold tracking-[0.04em] uppercase border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
            >
              <MessageSquare size={12} /> Send a direct message
            </Link>
          }
        />
        <p className="text-[12.5px] text-[color:var(--text-3)] -mt-1">
          {isAdmin
            ? "Broadcast to every player or a specific league — lands in each recipient's inbox. For 1:1 conversations, use Messages."
            : "Broadcast to your league members — lands in each member's inbox. For 1:1 conversations with a specific player, use Messages."}
        </p>

        <ComposerClient
          isAdmin={isAdmin}
          leagueOptions={leagueOptions}
          emailConfigured={isInviteEmailConfigured()}
        />

        {history.length > 0 && (
          <div>
            <SectionHead title="Recent" count={<span>{history.length}</span>} />
            <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
              {history.map((a) => (
                <div
                  key={a.id}
                  className="grid grid-cols-[1fr_auto] items-start gap-3 px-5 py-3 border-t border-[color:var(--hairline)] first:border-t-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span
                        className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold tracking-[0.05em] uppercase ${
                          a.scope === "global"
                            ? "bg-[color:var(--brand-soft)] text-[color:var(--brand-ink,var(--brand))]"
                            : "bg-[color:var(--surface-2)] text-[color:var(--text-2)] border border-[color:var(--hairline)]"
                        }`}
                      >
                        {a.scope === "global" ? "Global" : a.leagueName ?? "League"}
                      </span>
                      {a.channels.includes("email") && (
                        <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold tracking-[0.05em] uppercase bg-[color:var(--surface-2)] text-[color:var(--text-2)] border border-[color:var(--hairline)]">
                          Email
                        </span>
                      )}
                      <span className="font-bold text-[14px] truncate">
                        {a.headline}
                      </span>
                    </div>
                    <div className="text-[12px] text-[color:var(--text-3)] line-clamp-2">
                      {a.body}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 text-right">
                    <span className="text-[11px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                      {a.readCount}/{a.recipientCount} read
                    </span>
                    <span className="text-[10.5px] text-[color:var(--text-4)]">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
