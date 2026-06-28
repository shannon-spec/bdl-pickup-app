import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Trophy, CalendarDays, Users2 } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { isAdminLike } from "@/lib/auth/perms";
import { getMyContexts } from "@/lib/queries/contexts";
import { getCreateCaps, type CreateCaps } from "@/lib/queries/organize";
import { getPendingRequestsForManager } from "@/lib/queries/join";
import { CreateMenu } from "@/components/bdl/create-menu";
import { DeleteEventButton } from "@/components/bdl/delete-event-button";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { LeagueAvatar } from "@/components/bdl/league-avatar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage · BDL" };

const TYPE_LABEL: Record<string, string> = {
  LEAGUE: "League",
  TOURNAMENT: "Tournament",
  COMMUNITY: "Community",
};

function manageHref(type: string, id: string) {
  if (type === "LEAGUE") return `/manage/league/${id}`;
  if (type === "TOURNAMENT") return `/manage/tournament/${id}`;
  return `/manage/community/${id}`;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "•"
  );
}

export default async function ManagePage() {
  const session = await readSession();
  if (!session) redirect("/login?next=/manage");

  const all = await getMyContexts(session);
  // Organizer surfaces only — leagues/tournaments/communities you administer.
  const mine = all.filter((c) => c.manage && c.type !== "TEAM");
  const caps = await getCreateCaps(session);
  const isAdmin = isAdminLike(session);
  const pendingRequests = (await getPendingRequestsForManager(session)).length;

  return (
    <>
      <TopBar active="/manage" />
      <PageFrame>
        <ContextHeader />

        <SectionHead
          title="Manage"
          right={caps.any ? <CreateMenu caps={caps} /> : undefined}
        />

        {pendingRequests > 0 && (
          <Link
            href="/manage/requests"
            className="flex items-center gap-3 rounded-[14px] border border-[color:var(--brand)] bg-[color:var(--brand-soft)] px-4 py-3 hover:brightness-[0.98] transition"
          >
            <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-[color:var(--brand)] text-white text-[12px] font-extrabold">
              {pendingRequests}
            </span>
            <span className="flex-1 text-[14px] font-bold text-[color:var(--brand-ink)]">
              Join request{pendingRequests === 1 ? "" : "s"} to review
            </span>
            <ChevronRight size={18} className="text-[color:var(--brand-ink)]" />
          </Link>
        )}

        {mine.length === 0 ? (
          caps.any ? (
            <CreateFirst caps={caps} />
          ) : (
            <NoRole />
          )
        ) : (
          <div className="flex flex-col gap-2.5">
            {mine.map((c) => (
              <div
                key={`${c.type}:${c.id}`}
                className="group flex items-center gap-2 rounded-[14px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] pr-2.5 hover:bg-[color:var(--surface-2)] transition-colors"
              >
                <Link
                  href={manageHref(c.type, c.id)}
                  className="flex items-center gap-3.5 flex-1 min-w-0 pl-3.5 py-3"
                >
                  <LeagueAvatar
                    kind={c.avatarKind}
                    color={c.avatarColor}
                    emoji={c.avatarEmoji}
                    abbr={initials(c.name)}
                    size={40}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-[15px] tracking-[-0.01em] truncate">
                      {c.name}
                    </span>
                    <span className="block text-[12px] text-[color:var(--text-3)] mt-0.5">
                      {TYPE_LABEL[c.type] ?? c.type} ·{" "}
                      {c.role.charAt(0) + c.role.slice(1).toLowerCase()}
                    </span>
                  </span>
                  <ChevronRight
                    size={18}
                    className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)] shrink-0"
                  />
                </Link>
                {isAdmin && (
                  <DeleteEventButton
                    type={c.type as "LEAGUE" | "TOURNAMENT" | "COMMUNITY"}
                    id={c.id}
                    name={c.name}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}

function NoRole() {
  return (
    <section className="rounded-[16px] bg-[color:var(--surface-2)] p-8 flex flex-col items-center text-center gap-3">
      <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">
        Nothing to manage yet
      </h2>
      <p className="text-[13.5px] text-[color:var(--text-2)] max-w-[420px]">
        Creating leagues is for commissioners and tournaments for organizers. Ask
        an existing organizer to invite you, and you&apos;ll be able to run it
        here.
      </p>
      <Link
        href="/discover"
        className="inline-flex items-center h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white text-[12px] font-bold uppercase tracking-[0.04em] hover:bg-[color:var(--brand-hover)]"
      >
        Browse games
      </Link>
    </section>
  );
}

function CreateFirst({ caps }: { caps: CreateCaps }) {
  const opts = [
    caps.league && {
      href: "/manage/new?type=LEAGUE",
      icon: <CalendarDays size={18} />,
      title: "Start a league",
      sub: "Recurring play · seasons · standings",
    },
    caps.tournament && {
      href: "/manage/new?type=TOURNAMENT",
      icon: <Trophy size={18} />,
      title: "Run a tournament",
      sub: "Divisions · brackets · one or few days",
    },
    caps.community && {
      href: "/manage/new?type=COMMUNITY",
      icon: <Users2 size={18} />,
      title: "Create a community",
      sub: "Frat / campus / gym — owns many events",
    },
  ].filter(Boolean) as {
    href: string;
    icon: React.ReactNode;
    title: string;
    sub: string;
  }[];
  return (
    <section className="rounded-[16px] bg-[color:var(--surface-2)] p-7 flex flex-col items-center text-center gap-4">
      <div>
        <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">
          Run your first event
        </h2>
        <p className="text-[13.5px] text-[color:var(--text-2)] mt-1 max-w-[420px]">
          Create a league, tournament, or community and publish it in a few
          minutes. Invite co-organizers and share a join link.
        </p>
      </div>
      <div className="w-full max-w-[440px] flex flex-col gap-2.5">
        {opts.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            className="group flex items-center gap-3.5 rounded-[14px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] px-4 py-3.5 hover:bg-[color:var(--surface-2)] transition-colors text-left"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)] shrink-0">
              {o.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-[14.5px] tracking-[-0.01em]">
                {o.title}
              </span>
              <span className="block text-[12px] text-[color:var(--text-3)] mt-0.5">
                {o.sub}
              </span>
            </span>
            <ChevronRight
              size={18}
              className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)] shrink-0"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
