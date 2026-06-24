import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { isAdminLike } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { LeagueAvatar } from "@/components/bdl/league-avatar";
import { formatLabel } from "@/lib/format";
import { getTeamCards } from "@/lib/queries/teams";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teams · BDL" };

export default async function TeamsPage() {
  const session = await readSession();
  if (!session) redirect("/discover");
  const caps = await getViewCaps(session);
  if (!caps.canManage) redirect("/");
  const isAdminView = caps.view === "admin" && isAdminLike(session);

  const teams = await getTeamCards({
    all: isAdminView,
    commissionerPlayerId: session.playerId,
  });

  return (
    <>
      <TopBar active="/players" />
      <PageFrame>
        <ContextHeader />
        <SectionHead
          title="Teams"
          count={<span>{teams.length}</span>}
          right={
            <Link
              href="/teams/new"
              className="inline-flex items-center gap-1 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
            >
              Create team <ChevronRight size={13} />
            </Link>
          }
        />

        {teams.length === 0 ? (
          <div className="rounded-[16px] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px] shadow-[inset_0_0_0_1px_var(--hairline-2)]">
            No teams yet.{" "}
            <Link href="/teams/new" className="text-[color:var(--brand-ink)] font-semibold">
              Create one →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
            {teams.map((t) => (
              <Link
                key={t.id}
                href={`/teams/${t.id}`}
                className="group rounded-[14px] bg-[color:var(--surface)] p-4 flex flex-col gap-3 shadow-[inset_0_0_0_1px_var(--hairline-2)] hover:shadow-[inset_0_0_0_1.5px_var(--text-4)] transition-shadow"
              >
                <LeagueAvatar
                  kind={t.avatarKind}
                  color={t.avatarColor}
                  emoji={t.avatarEmoji}
                  abbr={(t.name[0] ?? "?").toUpperCase()}
                  size={36}
                />
                <div>
                  <div className="font-bold text-[16px] text-[color:var(--text)]">{t.name}</div>
                  <div className="text-[12px] text-[color:var(--text-3)] mt-0.5">
                    {[t.city, t.state].filter(Boolean).join(", ") || "Travel team"}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-auto pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Pill tone="neutral">{t.rosterCount} players</Pill>
                    <Pill tone="brand">{formatLabel(t.defaultFormat)}</Pill>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)]"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
