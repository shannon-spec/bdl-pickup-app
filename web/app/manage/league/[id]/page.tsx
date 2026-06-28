import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { getManageLeague } from "@/lib/queries/organize";
import { TopBar } from "@/components/bdl/top-bar";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { LeagueConsole } from "./league-console";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage league · BDL" };

export default async function ManageLeaguePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readSession();
  const { id } = await params;
  if (!session) redirect(`/login?next=/manage/league/${id}`);
  const lg = await getManageLeague(session, id);
  if (!lg) notFound();

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
        {lg.canManage ? (
          <LeagueConsole lg={lg} />
        ) : (
          <section className="rounded-[16px] bg-[color:var(--surface-2)] p-10 text-center flex flex-col items-center gap-3">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[color:var(--surface)] text-[color:var(--text-3)]">
              <Lock size={20} />
            </span>
            <div>
              <h1 className="text-[18px] font-extrabold tracking-[-0.02em]">
                You don&apos;t manage this league
              </h1>
              <p className="text-[13.5px] text-[color:var(--text-2)] mt-1 max-w-[380px]">
                Only its commissioners can open the console.
              </p>
            </div>
            <Link
              href={`/leagues/${lg.id}`}
              className="inline-flex items-center h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white text-[12px] font-bold uppercase tracking-[0.04em] hover:bg-[color:var(--brand-hover)]"
            >
              View league
            </Link>
          </section>
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
