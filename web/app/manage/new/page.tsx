import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { getCreateCaps } from "@/lib/queries/organize";
import { TopBar } from "@/components/bdl/top-bar";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { NewEventForm } from "./new-event-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create · Manage · BDL" };

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; community?: string }>;
}) {
  const session = await readSession();
  if (!session?.playerId) redirect("/login?next=/manage/new");
  const caps = await getCreateCaps(session);
  if (!caps.any) redirect("/manage");
  const sp = await searchParams;
  const requested =
    sp.type === "TOURNAMENT"
      ? "TOURNAMENT"
      : sp.type === "COMMUNITY"
        ? "COMMUNITY"
        : "LEAGUE";
  // Fall back to a type the user is actually allowed to create.
  const allowedTypes = [
    caps.league && "LEAGUE",
    caps.tournament && "TOURNAMENT",
    caps.community && "COMMUNITY",
  ].filter(Boolean) as ("LEAGUE" | "TOURNAMENT" | "COMMUNITY")[];
  const initialType = allowedTypes.includes(
    requested as "LEAGUE" | "TOURNAMENT" | "COMMUNITY",
  )
    ? (requested as "LEAGUE" | "TOURNAMENT" | "COMMUNITY")
    : allowedTypes[0];

  return (
    <>
      <TopBar active="/manage" />
      <PageFrame>
        <Link
          href="/manage"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
        >
          <ArrowLeft size={13} /> Manage
        </Link>
        <NewEventForm
          initialType={initialType}
          allowedTypes={allowedTypes}
          communityId={sp.community ?? null}
        />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
