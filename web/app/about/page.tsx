import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "About · BDL",
  description:
    "BDL is personal. Pickup basketball strips it all down — no titles, no shortcuts. Built to track the games and keep the connection.",
};

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

export default function AboutPage() {
  return (
    <>
      <TopBar active="/about" />
      <PageFrame>
        <ContextHeader />
        <SectionHead title="About" count={<Pill tone="brand">Beta · v{VERSION}</Pill>} />

        <section className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-7 py-8 max-sm:px-5 flex flex-col gap-6">
          <p className="text-[17px] leading-[1.65] text-[color:var(--text-2)]">
            <strong className="text-[color:var(--text)]">BDL — Ball Don&apos;t Lie —</strong>{" "}
            is personal. I&apos;ve spent 30 years building products, but
            everything that actually shaped me came from sports. The lessons,
            the relationships, the standard. Pickup basketball strips it all
            down. No titles, no shortcuts. You earn respect or you don&apos;t.
            Every run tells the truth —{" "}
            <em className="not-italic font-semibold text-[color:var(--text)]">
              ball don&apos;t lie
            </em>
            .
          </p>

          <p className="text-[15.5px] leading-[1.7] text-[color:var(--text-2)]">
            I built BDL to hold onto that. To track the games and the stats,
            yes — but more importantly to keep the connection. The guys you
            run with. The courts you show up to. The relationships that stick.
          </p>

          <p className="text-[15.5px] leading-[1.7] text-[color:var(--text-2)]">
            If it works, BDL becomes a place where you can always find a run,
            stay close to your people, and hold onto the part of the game that
            stays with you for life.
          </p>

          <div className="h-px bg-[color:var(--hairline)] my-1" />

          <p className="text-[12.5px] leading-[1.5] text-[color:var(--text-3)]">
            Designed by{" "}
            <a
              href="https://aurumco.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[color:var(--text-2)] underline decoration-[color:var(--brand)] underline-offset-[3px] hover:text-[color:var(--brand)]"
            >
              Shannon Terry of AurumCo.AI
            </a>{" "}
            · Currently in beta (v{VERSION}).
          </p>

          <p className="text-[20px] font-extrabold tracking-[-0.015em] text-[color:var(--text)]">
            Every game counts.
          </p>
        </section>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
