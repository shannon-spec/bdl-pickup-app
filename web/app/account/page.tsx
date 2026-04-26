import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { readSession } from "@/lib/auth/session";
import { db, players } from "@/lib/db";
import { AvatarUploader } from "@/components/bdl/avatar-uploader";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account · BDL" };

export default async function AccountPage() {
  const session = await readSession();
  if (!session?.playerId) {
    // Super admins (no playerId) and guests both bounce out — there's
    // nothing they can do here.
    redirect("/");
  }

  const [me] = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      username: players.username,
      email: players.email,
      hasPassword: players.passwordHash,
      avatarUrl: players.avatarUrl,
    })
    .from(players)
    .where(eq(players.id, session.playerId))
    .limit(1);

  if (!me) redirect("/");

  const initials = `${me.firstName[0] ?? ""}${me.lastName[0] ?? ""}`.toUpperCase();

  return (
    <>
      <TopBar active="/account" />
      <PageFrame>
        <ContextHeader />
        <SectionHead title="Account" />

        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 flex flex-col gap-1">
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            Signed in as
          </div>
          <div className="font-extrabold text-[18px]">
            {me.firstName} {me.lastName}
          </div>
          <div className="text-[13px] text-[color:var(--text-3)]">
            {me.username ? `@${me.username}` : "No username set"}
            {me.email ? ` · ${me.email}` : ""}
          </div>
        </div>

        <SectionHead title="Headshot" />
        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6">
          <AvatarUploader
            playerId={me.id}
            currentUrl={me.avatarUrl}
            initials={initials}
          />
        </div>

        <SectionHead title="Change password" />
        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6">
          {me.hasPassword ? (
            <ChangePasswordForm />
          ) : (
            <div className="text-[13px] text-[color:var(--text-3)]">
              Your account doesn&apos;t have a password yet. Ask a commissioner
              or admin to issue one, or use the Forgot password flow if your
              email is on file.
            </div>
          )}
        </div>
      </PageFrame>
      <MobileBottomBar active="profile" />
    </>
  );
}
