import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { db, superAdmins, players } from "@/lib/db";
import { AdminRow, AddAdmin } from "./settings-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · BDL" };

export default async function SettingsPage() {
  const session = await readSession();
  const isAdmin = session?.role === "owner" || session?.role === "super_admin";
  if (!isAdmin) redirect("/");
  const caps = await getViewCaps(session);
  if (caps.view !== "admin") redirect("/");

  const admins = await db.select().from(superAdmins).orderBy(asc(superAdmins.username));
  const allPlayers = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
    })
    .from(players)
    .orderBy(asc(players.lastName), asc(players.firstName));

  return (
    <>
      <TopBar active="/settings" />
      <PageFrame>
        <ContextHeader />
        <SectionHead
          title="Settings"
          count={
            <span>
              {admins.length} admin{admins.length === 1 ? "" : "s"}
            </span>
          }
        />

        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[color:var(--hairline)]">
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
              Super Admins
            </div>
            <p className="text-[13px] text-[color:var(--text-2)] mt-1">
              Super Admins have full access to Roster, Leagues, Games, and Settings. Owners
              cannot be removed.
            </p>
          </div>
          {admins.map((a) => (
            <AdminRow
              key={a.id}
              admin={{
                id: a.id,
                username: a.username,
                email: a.email,
                firstName: a.firstName,
                lastName: a.lastName,
                role: a.role,
                playerId: a.playerId,
              }}
              allPlayers={allPlayers}
            />
          ))}
        </div>

        <AddAdmin allPlayers={allPlayers} />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
