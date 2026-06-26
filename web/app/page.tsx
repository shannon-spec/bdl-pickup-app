import Link from "next/link";
import { redirect } from "next/navigation";
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
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] leading-tight">
            Pickup basketball, organized.
          </h1>
          <p className="text-[14px] text-[color:var(--text-2)] leading-relaxed max-w-[340px]">
            Find a run, manage a team, or run your own league or tournament — one
            account, every role.
          </p>
        </div>

        {/* Two CTAs by intent — not by role. */}
        <div className="flex flex-col gap-3">
          <Link
            href="/login?intent=play"
            className="h-13 min-h-[52px] rounded-[14px] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[15px] flex items-center justify-center shadow-[var(--cta-shadow)] transition-colors"
          >
            Find a run near me
          </Link>
          <Link
            href="/login?intent=organize"
            className="h-13 min-h-[52px] rounded-[14px] bg-[color:var(--surface)] text-[color:var(--text)] font-bold text-[15px] flex items-center justify-center border border-[color:var(--hairline-2)] hover:bg-[color:var(--surface-2)] transition-colors"
          >
            Run a league or tournament
          </Link>
        </div>

        <div className="text-center mt-5 text-[13px] text-[color:var(--text-3)]">
          Already play in a league?{" "}
          <Link href="/login" className="font-semibold text-[color:var(--brand)] hover:underline">
            Sign in
          </Link>
        </div>

        <div className="flex items-center justify-center gap-2 mt-7 flex-wrap">
          {["Free to join", "All ages", "No app needed"].map((t) => (
            <span
              key={t}
              className="inline-flex items-center h-7 px-3 rounded-full bg-[color:var(--surface-2)] text-[11.5px] font-medium text-[color:var(--text-3)]"
            >
              {t}
            </span>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/discover"
            className="text-[12.5px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
          >
            Browse leagues & teams →
          </Link>
        </div>
      </div>
    </main>
  );
}
