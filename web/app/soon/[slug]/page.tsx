import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronRight, ArrowLeft } from "lucide-react";
import {
  TeamIcon,
  TrophyIcon,
  StarIcon,
} from "@/components/bdl/sport-icons";

const LOCKUP_RATIO = 1000 / 340;

export const dynamic = "force-dynamic";

type SoonKey = "coach" | "organize" | "watch";

const SOON: Record<
  SoonKey,
  {
    Icon: typeof TeamIcon;
    eyebrow: string;
    title: string;
    blurb: string;
    chips: string[];
  }
> = {
  coach: {
    Icon: TeamIcon,
    eyebrow: "For coaches",
    title: "Coach a team",
    blurb:
      "Rosters, lineups, practice plans, and tournament entries — the full coaching toolkit is coming to BDL.",
    chips: ["Rosters", "Lineups", "Practice plans", "Tournaments"],
  },
  organize: {
    Icon: TrophyIcon,
    eyebrow: "For organizers",
    title: "Run a league or tournament",
    blurb:
      "Spin up leagues, tournaments, and events with scheduling and live brackets. We're almost ready.",
    chips: ["Leagues", "Tournaments", "Scheduling", "Live brackets"],
  },
  watch: {
    Icon: StarIcon,
    eyebrow: "For fans",
    title: "Stay updated",
    blurb:
      "Live scores, schedules, player pages, and brackets — follow every run as it happens.",
    chips: ["Live scores", "Schedules", "Player pages", "Brackets"],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cfg = SOON[slug as SoonKey];
  return { title: cfg ? `${cfg.title} · Coming soon · BDL` : "Coming soon · BDL" };
}

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cfg = SOON[slug as SoonKey];
  if (!cfg) notFound();
  const { Icon } = cfg;
  const logoH = 44;

  return (
    <main
      className="min-h-[100dvh] flex items-center justify-center px-5 py-10 text-white"
      style={{
        backgroundColor: "#0A0E14",
        backgroundImage:
          "linear-gradient(180deg, rgba(6,9,13,.92) 0%, rgba(6,9,13,.82) 50%, rgba(6,9,13,.94) 100%), url(/hero-court.jpg)",
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
      }}
    >
      <div className="w-full max-w-[520px] flex flex-col items-center text-center">
        <Image
          src="/bdl-lockup-dark.png"
          alt="BDL · Ball Don't Lie"
          width={Math.round(logoH * LOCKUP_RATIO)}
          height={logoH}
          priority
          style={{ height: logoH, width: "auto" }}
        />

        {/* glowing icon */}
        <div className="relative mt-9 mb-5">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ background: "rgba(13,139,255,.45)" }}
          />
          <span className="relative inline-flex items-center justify-center w-[84px] h-[84px] rounded-full bg-white/[0.06] ring-[1.5px] ring-[#EA6A2B] text-white shadow-[0_8px_40px_rgba(13,139,255,.30)]">
            <Icon size={40} />
          </span>
        </div>

        <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-[rgba(234,106,43,0.20)] border border-[rgba(234,106,43,0.45)] text-[11px] font-bold uppercase tracking-[0.14em]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EA6A2B] animate-pulse" />
          Coming soon
        </span>

        <h1 className="mt-4 text-[34px] font-extrabold tracking-[-0.03em] leading-[1.02]">
          {cfg.title}
          <span style={{ color: "#EA6A2B" }}>.</span>
        </h1>
        <p className="mt-3 text-[14.5px] text-white/70 leading-relaxed max-w-[420px]">
          {cfg.blurb}
        </p>

        {/* feature chips */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {cfg.chips.map((c) => (
            <span
              key={c}
              className="inline-flex items-center h-8 px-3.5 rounded-full bg-white/[0.06] border border-white/10 text-[12.5px] font-medium text-white/80"
            >
              {c}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-9 w-full flex flex-col gap-3">
          <Link
            href="/login?intent=play"
            className="group inline-flex items-center justify-center gap-2 h-[52px] rounded-[14px] text-white font-bold text-[15px] tracking-[-0.01em] transition-[filter] hover:brightness-[1.05]"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #1F84FF 0%, #0D6FE0 100%)",
              boxShadow: "0 12px 30px rgba(13,139,255,.36)",
            }}
          >
            I want to play
            <ChevronRight
              size={18}
              className="opacity-85 group-hover:translate-x-0.5 transition-transform"
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 h-12 rounded-[14px] border border-white/15 bg-white/[0.06] text-white/85 font-semibold text-[14px] hover:bg-[rgba(120,185,255,0.16)] hover:border-[rgba(120,185,255,0.40)] transition-colors"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
        </div>

        <p className="mt-7 text-[13px] text-white/55">
          Already play in a league?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#7CB0FF] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
