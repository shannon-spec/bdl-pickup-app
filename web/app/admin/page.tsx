import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Users, Trophy, Globe, Settings, BarChart3, Activity, KeyRound, ShieldCheck } from "lucide-react";
import { count } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { isAdminLike } from "@/lib/auth/perms";
import { getViewCaps } from "@/lib/auth/view";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { db, players, leagues, games, superAdmins } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · BDL" };

type Tile = {
  href: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
  stat?: string;
};

export default async function AdminPage() {
  const session = await readSession();
  if (!session) redirect("/discover");
  if (!isAdminLike(session)) redirect("/");
  const caps = await getViewCaps(session);
  if (caps.view !== "admin") redirect("/");

  const [pCount] = await db.select({ n: count() }).from(players);
  const [lCount] = await db.select({ n: count() }).from(leagues);
  const [gCount] = await db.select({ n: count() }).from(games);
  const [aCount] = await db.select({ n: count() }).from(superAdmins);

  const tiles: Tile[] = [
    {
      href: "/players",
      icon: <Users size={20} />,
      label: "Players",
      desc: "Manage all players. Add, edit, deactivate.",
      stat: `${pCount.n} player${pCount.n === 1 ? "" : "s"}`,
    },
    {
      href: "/leagues",
      icon: <Trophy size={20} />,
      label: "Leagues",
      desc: "Create and manage leagues, commissioners, members.",
      stat: `${lCount.n} league${lCount.n === 1 ? "" : "s"}`,
    },
    {
      href: "/games",
      icon: <Globe size={20} />,
      label: "Games",
      desc: "Schedule games, score them, lock as final.",
      stat: `${gCount.n} game${gCount.n === 1 ? "" : "s"}`,
    },
    {
      href: "/admin/commissioners",
      icon: <ShieldCheck size={20} />,
      label: "Commissioners",
      desc: "Assign or revoke commissioner roles for any league.",
    },
    {
      href: "/admin/credentials",
      icon: <KeyRound size={20} />,
      label: "Credentials",
      desc: "Issue logins for commissioners + players.",
    },
    {
      href: "/settings",
      icon: <Settings size={20} />,
      label: "Super Admins",
      desc: "Manage admin users + login credentials.",
      stat: `${aCount.n} admin${aCount.n === 1 ? "" : "s"}`,
    },
    {
      href: "/leaderboard",
      icon: <BarChart3 size={20} />,
      label: "Leaderboard",
      desc: "Win %, records, and Game Winner awards.",
    },
    {
      href: "/activity",
      icon: <Activity size={20} />,
      label: "Activity",
      desc: "Reverse-chronological feed of every game event.",
    },
  ];

  return (
    <>
      <TopBar
        active="/admin"
        userInitials={session.username.slice(0, 2).toUpperCase()}
      />
      <PageFrame>
        <ContextHeader />

        <SectionHead title="Admin" count={<span>{aCount.n} admin{aCount.n === 1 ? "" : "s"}</span>} />

        <div className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
          {tiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-[14px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-5 flex flex-col gap-3 hover:border-[color:var(--text-4)] transition-colors"
            >
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-[var(--r-lg)] bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
                {t.icon}
              </span>
              <div className="flex-1">
                <div className="font-bold text-[16px] text-[color:var(--text)]">
                  {t.label}
                </div>
                <div className="text-[12.5px] text-[color:var(--text-3)] mt-1">
                  {t.desc}
                </div>
              </div>
              <div className="flex items-center justify-between text-[11.5px] text-[color:var(--text-3)] mt-auto">
                <span className="font-[family-name:var(--mono)] num">
                  {t.stat ?? ""}
                </span>
                <ChevronRight
                  size={14}
                  className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)]"
                />
              </div>
            </Link>
          ))}
        </div>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
