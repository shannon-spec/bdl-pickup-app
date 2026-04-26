import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { isAdminLike, getMyCommissionerLeagueIds } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { getCredentialPlayers } from "@/lib/queries/credentials";
import { CredentialsTable } from "./credentials-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Credentials · BDL" };

export default async function CredentialsPage() {
  const session = await readSession();
  if (!session) redirect("/discover");
  const caps = await getViewCaps(session);
  // Admins always; commissioners need an active management lens AND
  // at least one league they commission.
  if (!caps.canManage) redirect("/");
  if (!isAdminLike(session)) {
    const mine = await getMyCommissionerLeagueIds(session);
    if (mine.length === 0) redirect("/");
  }

  const { rows, scope } = await getCredentialPlayers();

  return (
    <>
      <TopBar
        active="/admin"
      />
      <PageFrame>
        <ContextHeader />
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Admin
        </Link>

        <SectionHead
          title="Login Credentials"
          count={
            <span>
              {rows.length} player{rows.length === 1 ? "" : "s"}
            </span>
          }
        />

        <p className="text-[12.5px] text-[color:var(--text-3)] -mt-1">
          {scope === "admin"
            ? "Set or reset login credentials for any player. Commissioners can use these credentials to invite and manage their leagues."
            : "Set or reset login credentials for players in the leagues you commission."}
        </p>

        <CredentialsTable rows={rows} />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
