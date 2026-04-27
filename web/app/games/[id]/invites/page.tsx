import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { canManageGame } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { formatLabel } from "@/lib/format";
import { getGameDetail } from "@/lib/queries/games";
import {
  getInvitesForGame,
  getInvitePool,
  getInviteActivity,
  getEffectiveInviteSettings,
} from "@/lib/queries/game-invites";
import { InviteManager } from "../invite-manager";

export const dynamic = "force-dynamic";

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()]} · ${
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dt.getMonth()]
  } ${dt.getDate()}, ${dt.getFullYear()}`;
};
const fmtTime = (t: string | null) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = Number(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
};

export default async function GameInvitesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readSession();
  const { id } = await params;
  if (!session) redirect("/login");

  const caps = await getViewCaps(session);
  const canEdit = caps.canManage && (await canManageGame(session, id));
  if (!canEdit) redirect(`/games/${id}`);

  const detail = await getGameDetail(id);
  if (!detail) notFound();
  const { game } = detail;

  const [invites, pool, activity, settings] = await Promise.all([
    getInvitesForGame(id),
    getInvitePool(id),
    getInviteActivity(id, 30),
    getEffectiveInviteSettings(id),
  ]);
  if (!settings) notFound();

  return (
    <>
      <TopBar active="/games" />
      <PageFrame>
        <ContextHeader />
        <Link
          href={`/games/${id}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Game
        </Link>

        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-6 py-5">
          <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
            {game.leagueName ?? "—"} · {formatLabel(game.format)}
          </div>
          <h1 className="text-[22px] font-extrabold tracking-[-0.03em] mt-0.5">
            Invite Manager
          </h1>
          <div className="text-[13px] text-[color:var(--text-3)] mt-0.5">
            {fmtDate(game.gameDate)}
            {game.gameTime ? ` · ${fmtTime(game.gameTime)}` : ""}
            {game.venue ? ` · ${game.venue}` : ""}
          </div>
        </div>

        <InviteManager
          gameId={id}
          initialInvites={invites}
          initialPool={pool}
          initialActivity={activity}
          settings={settings}
          game={{
            leagueName: game.leagueName ?? "BDL game",
            dateLabel: `${fmtDate(game.gameDate)}${game.gameTime ? ` · ${fmtTime(game.gameTime)}` : ""}`,
            venue: game.venue,
          }}
        />
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
