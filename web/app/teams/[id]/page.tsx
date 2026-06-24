import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { canManageTeam } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { LeagueAvatar } from "@/components/bdl/league-avatar";
import { Pill } from "@/components/bdl/pill";
import { formatLabel } from "@/lib/format";
import { getTeamDetail, getEligibleTeamMembers } from "@/lib/queries/teams";
import { TeamRosterControls } from "./team-detail-client";

export const dynamic = "force-dynamic";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getTeamDetail(id);
  if (!detail) notFound();

  const session = await readSession();
  const caps = await getViewCaps(session);
  const canManage = caps.canManage && (await canManageTeam(session, id));
  const eligible = canManage ? await getEligibleTeamMembers(id) : [];

  const { team, roster } = detail;
  const place = [team.city, team.state].filter(Boolean).join(", ");
  const abbr = (team.name.trim()[0] ?? "?").toUpperCase();

  return (
    <>
      <TopBar active="/players" />
      <PageFrame>
        <ContextHeader />
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Back
        </Link>

        {/* Header */}
        <section className="rounded-[16px] bg-[color:var(--surface)] px-5 py-4 shadow-[inset_0_0_0_1px_var(--hairline-2)] flex items-center gap-4 flex-wrap">
          <LeagueAvatar
            kind={team.avatarKind}
            color={team.avatarColor}
            emoji={team.avatarEmoji}
            abbr={abbr}
            size={56}
          />
          <div className="flex flex-col min-w-0 flex-1">
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
              Team · {formatLabel(team.defaultFormat)}
            </div>
            <h1 className="text-[24px] font-extrabold tracking-[-0.03em] leading-tight truncate">
              {team.name}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {place && (
                <span className="text-[12.5px] text-[color:var(--text-3)]">{place}</span>
              )}
              <Pill tone="neutral">{roster.length} players</Pill>
            </div>
          </div>
          {canManage && (
            <Link
              href={`/teams/${id}/edit`}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[var(--r-lg)] bg-[color:var(--surface)] text-[12px] font-bold text-[color:var(--text-2)] hover:text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-soft)] transition-colors shadow-[inset_0_0_0_1px_var(--hairline-2)]"
            >
              <Pencil size={13} /> Edit team
            </Link>
          )}
        </section>

        {team.description && (
          <p className="text-[13.5px] leading-relaxed text-[color:var(--text-2)] -mt-1">
            {team.description}
          </p>
        )}

        {/* Roster */}
        <section className="rounded-[16px] bg-[color:var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--hairline-2)]">
          <SectionHead title="Roster" count={<span>{roster.length}</span>} />
          {roster.length === 0 ? (
            <div className="mt-3 text-[13px] text-[color:var(--text-3)]">
              No players yet.{canManage ? " Add players below." : ""}
            </div>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-0.5 max-sm:grid-cols-1">
              {roster.map((p, i) => (
                <li key={p.id}>
                  <Link
                    href={`/players/${p.id}`}
                    className="flex items-center gap-2.5 py-1 rounded-[6px] -mx-1.5 px-1.5 hover:bg-[color:var(--surface-2)] transition-colors"
                  >
                    <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-[6px] bg-[color:var(--surface-2)] text-[color:var(--text-3)] text-[11px] font-bold font-[family-name:var(--mono)] num">
                      {i + 1}
                    </span>
                    <span className="font-medium text-[14px] truncate hover:text-[color:var(--brand)]">
                      {p.firstName} {p.lastName}
                    </span>
                    {p.position && (
                      <span className="ml-auto text-[12px] font-[family-name:var(--mono)] text-[color:var(--text-4)]">
                        {p.position}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <TeamRosterControls teamId={id} members={roster} eligible={eligible} />
          )}
        </section>

        {/* Games + leaderboard land here in Phase 2 / Phase 3. */}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
