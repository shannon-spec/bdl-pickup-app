import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { AvatarUploader } from "@/components/bdl/avatar-uploader";
import { getPlayer } from "@/lib/queries/roster";
import { EditPlayerForm } from "./edit-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit player · BDL" };

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readSession();
  const isAdmin = session?.role === "owner" || session?.role === "super_admin";
  if (!isAdmin) redirect("/");
  const caps = await getViewCaps(session);
  if (caps.view !== "admin") redirect("/");

  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  return (
    <>
      <TopBar
        active="/players"
      />
      <PageFrame>
        <ContextHeader />
        <Link
          href={`/players/${player.id}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> {player.firstName} {player.lastName}
        </Link>

        <div>
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            Edit Player
          </div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] mt-0.5">
            {player.firstName} {player.lastName}
          </h1>
        </div>

        <SectionHead title="Headshot" />
        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6">
          <AvatarUploader
            playerId={player.id}
            currentUrl={player.avatarUrl}
            initials={`${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`.toUpperCase()}
          />
        </div>

        <EditPlayerForm player={player} />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
