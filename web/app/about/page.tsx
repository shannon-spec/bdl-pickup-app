import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { BrandMark } from "@/components/bdl/brand";
import { Pill } from "@/components/bdl/pill";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "About · BDL",
  description:
    "BDL — Ball Don't Lie — is a pickup basketball tracker for leagues that take their stat lines seriously.",
};

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

export default function AboutPage() {
  return (
    <>
      <TopBar active="/about" />
      <PageFrame>
        <ContextHeader />
        <SectionHead title="About" count={<Pill tone="brand">Beta · v{VERSION}</Pill>} />

        <section className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-6 py-7 max-sm:px-5 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <BrandMark size={48} />
            <div className="flex flex-col leading-tight">
              <span className="font-extrabold text-[22px] tracking-[-0.03em] text-[color:var(--text)]">
                B<span style={{ color: "#E87722" }}>D</span>L
              </span>
              <span className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
                Ball Don&apos;t Lie · Pickup Tracker
              </span>
            </div>
          </div>

          <p className="text-[15px] leading-[1.65] text-[color:var(--text-2)]">
            <strong className="text-[color:var(--text)]">BDL — Ball Don&apos;t Lie —</strong>{" "}
            is a pickup basketball tracker for leagues that take their stat
            lines seriously. Designed by{" "}
            <a
              href="https://aurumco.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[color:var(--text)] underline decoration-[color:var(--brand)] underline-offset-[3px] hover:text-[color:var(--brand)]"
            >
              Shannon Terry of AurumCo.AI
            </a>{" "}
            and currently in beta (v{VERSION}), BDL turns weekly runs into
            seasons: players, games, wins, heroes, and the standings to back it
            all up.
          </p>

          <p className="text-[18px] font-extrabold tracking-[-0.01em] text-[color:var(--text)]">
            Every game counts.
          </p>
        </section>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
