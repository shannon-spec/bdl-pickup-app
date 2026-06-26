import Link from "next/link";
import { ArrowLeft, Hammer } from "lucide-react";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";

/**
 * Routed placeholder for product surfaces that aren't built yet. Keeps the
 * full app shell (nav + context switcher) so there's never a dead end —
 * the user can always switch context or head home.
 */
export function ComingSoon({
  active = "/home",
  title,
  blurb,
}: {
  active?: string;
  title: string;
  blurb: string;
}) {
  return (
    <>
      <TopBar active={active} />
      <PageFrame>
        <ContextHeader />
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)] -mb-2"
        >
          <ArrowLeft size={13} /> Home
        </Link>
        <section className="rounded-[16px] bg-[color:var(--surface-2)] p-10 text-center flex flex-col items-center gap-3">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
            <Hammer size={20} />
          </span>
          <div>
            <h1 className="text-[20px] font-extrabold tracking-[-0.02em]">{title}</h1>
            <p className="text-[13.5px] text-[color:var(--text-2)] mt-1 max-w-[420px]">
              {blurb}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
            <Link
              href="/home"
              className="inline-flex items-center h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white text-[12px] font-bold tracking-[0.04em] uppercase hover:bg-[color:var(--brand-hover)]"
            >
              Back home
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--surface)] text-[12px] font-bold text-[color:var(--text-2)] hover:bg-[color:var(--surface-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)]"
            >
              Browse
            </Link>
          </div>
        </section>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
