import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { Brand } from "@/components/bdl/brand";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "BDL · Ball Don't Lie — pickup basketball, organized",
};

/**
 * Front Door. Public, server-rendered, two intent-based CTAs. Signed-in
 * users skip straight to their role home.
 */
export default async function FrontDoor() {
  const session = await readSession();
  if (session) redirect("/home");

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] flex flex-col">
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          <Brand height={52} />
          <h1 className="text-[34px] font-extrabold tracking-[-0.035em] leading-[1.04] mt-1">
            Basketball<br />starts here<span style={{ color: "#EA6A2B" }}>.</span>
          </h1>
          <p className="text-[14px] text-[color:var(--text-2)] leading-relaxed max-w-[340px]">
            Find games. Join teams. Run leagues. Host tournaments. Track every
            stat. All from one account.
          </p>
        </div>

        {/* Primary path — Play. */}
        <Link
          href="/login?intent=play"
          className="group flex items-center gap-3.5 min-h-[64px] rounded-[16px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white pl-4 pr-3 py-3 shadow-[var(--cta-shadow)] transition-colors"
        >
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/15 shrink-0 text-[22px] leading-none">
            🏀
          </span>
          <span className="flex-1 text-[17px] font-bold tracking-[-0.01em]">
            I want to play
          </span>
          <ChevronRight size={22} className="opacity-80 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <div className="flex items-center gap-3 my-4">
          <span className="h-px flex-1 bg-[color:var(--hairline)]" />
          <span className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-4)]">or</span>
          <span className="h-px flex-1 bg-[color:var(--hairline)]" />
        </div>

        {/* Secondary paths — Coach / Organize / Watch. */}
        <div className="flex flex-col gap-3">
          <PathCard
            href="/login?intent=coach"
            emoji="📋"
            title="Coach a team"
            sub="Roster · enter tournaments"
          />
          <PathCard
            href="/login?intent=organize"
            emoji="🗂️"
            title="Run a league or tournament"
            sub="League · tourney · frat / campus"
          />
          <PathCard
            href="/discover"
            emoji="👀"
            title="Just here to watch"
            sub="Follow players · scores"
          />
        </div>

        <div className="text-center mt-6 text-[13px] text-[color:var(--text-3)]">
          Already play in a league?{" "}
          <Link href="/login" className="font-semibold text-[color:var(--brand)] hover:underline">
            Sign in
          </Link>
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          {["Free to join", "All ages", "No app needed"].map((t) => (
            <span
              key={t}
              className="inline-flex items-center h-7 px-3 rounded-full bg-[color:var(--surface-2)] text-[11.5px] font-medium text-[color:var(--text-3)]"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}

function PathCard({
  href,
  emoji,
  title,
  sub,
}: {
  href: string;
  emoji: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3.5 rounded-[16px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] px-4 py-3.5 hover:bg-[color:var(--surface-2)] transition-colors"
    >
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-[12px] bg-[color:var(--surface-2)] text-[24px] leading-none shrink-0 group-hover:bg-[color:var(--surface)]">
        {emoji}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-[16px] tracking-[-0.01em] leading-tight">
          {title}
        </span>
        <span className="block text-[12.5px] text-[color:var(--text-3)] mt-0.5">{sub}</span>
      </span>
      <ChevronRight
        size={18}
        className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)] shrink-0"
      />
    </Link>
  );
}
