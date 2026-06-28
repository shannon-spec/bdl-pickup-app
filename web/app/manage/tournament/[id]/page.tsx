import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { getManageTournament } from "@/lib/queries/organize";
import { TopBar } from "@/components/bdl/top-bar";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { TournamentConsole } from "./tournament-console";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage tournament · BDL" };

export default async function ManageTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await readSession();
  const { id } = await params;
  if (!session) redirect(`/login?next=/manage/tournament/${id}`);
  const t = await getManageTournament(session, id);
  if (!t) notFound();

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
        {t.canManage ? (
          <TournamentConsole t={t} />
        ) : (
          <section className="rounded-[16px] bg-[color:var(--surface-2)] p-10 text-center flex flex-col items-center gap-3">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[color:var(--surface)] text-[color:var(--text-3)]">
              <Lock size={20} />
            </span>
            <div>
              <h1 className="text-[18px] font-extrabold tracking-[-0.02em]">
                You don&apos;t manage this tournament
              </h1>
              <p className="text-[13.5px] text-[color:var(--text-2)] mt-1 max-w-[380px]">
                Only its directors can open the console. Ask an organizer to add
                you, or view the public page.
              </p>
            </div>
            {t.slug && (
              <Link
                href={`/t/${t.slug}`}
                className="inline-flex items-center h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white text-[12px] font-bold uppercase tracking-[0.04em] hover:bg-[color:var(--brand-hover)]"
              >
                View public page
              </Link>
            )}
          </section>
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
