import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
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
  const sp = await searchParams;
  const initialType =
    sp.type === "TOURNAMENT"
      ? "TOURNAMENT"
      : sp.type === "COMMUNITY"
        ? "COMMUNITY"
        : "LEAGUE";

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
        <NewEventForm initialType={initialType} communityId={sp.community ?? null} />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
