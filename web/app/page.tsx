import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ChevronRight, Shield, Users, Smartphone } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import {
  BasketballIcon,
  TrophyIcon,
  TeamIcon,
  StarIcon,
} from "@/components/bdl/sport-icons";

const LOCKUP_RATIO = 1000 / 340;

export const dynamic = "force-dynamic";
export const metadata = {
  title: "BDL · Ball Don't Lie — pickup basketball, organized",
};

/**
 * Front Door. Public, server-rendered. Dark court hero + intent CTAs.
 * Signed-in users skip straight to their role home.
 */
export default async function FrontDoor() {
  const session = await readSession();
  if (session) redirect("/home");

  const logoH = 56;

  return (
    <main className="min-h-[100dvh] flex justify-center bg-[color:var(--bg)] px-0 sm:px-6 py-0 sm:py-6">
      <div className="w-full max-w-[750px] flex flex-col pb-9 overflow-hidden border-0 sm:border border-[#C4C2BA] rounded-none sm:rounded-[20px] shadow-none sm:shadow-[0_8px_34px_rgba(0,0,0,.10)]">
        {/* ---------- HERO (always dark, full-bleed top of the card) ---------- */}
        <section
          className="relative overflow-hidden text-white px-6 pt-10 pb-20"
          style={{
            backgroundColor: "#0A0E14",
            backgroundImage:
              "url(/hero-court.jpg), radial-gradient(120% 90% at 85% 30%, rgba(234,106,43,.28), transparent 55%), radial-gradient(130% 120% at 20% 0%, #11161f 0%, #070a0f 70%)",
            backgroundSize: "cover, cover, cover",
            backgroundPosition: "center, center, center",
          }}
        >
          {/* faint basketball, upper-right (decorative; the photo overrides) */}
          <BasketballIcon
            size={230}
            className="pointer-events-none absolute -right-12 top-6 opacity-[0.10] text-white"
          />

          <div className="relative flex flex-col items-center text-center">
            <Image
              src="/bdl-lockup-dark.png"
              alt="BDL · Ball Don't Lie"
              width={Math.round(logoH * LOCKUP_RATIO)}
              height={logoH}
              priority
              style={{ height: logoH, width: "auto" }}
            />
            <h1 className="mt-5 text-[51px] font-extrabold tracking-[-0.04em] leading-[0.96]">
              Basketball
              <br />
              starts here<span style={{ color: "#EA6A2B" }}>.</span>
            </h1>
            <p className="mt-4 text-[14.5px] text-white/75 leading-relaxed max-w-[300px] sm:max-w-[440px]">
              Find games. Join teams. Run leagues. Host tournaments. Track every
              stat. All from one account.
            </p>
          </div>
        </section>

        {/* ---------- PLAY — straddles hero / light boundary ---------- */}
        <div className="relative z-10 w-[80%] mx-auto -mt-12">
          <Link
            href="/login?intent=play"
            className="group relative overflow-hidden flex items-center gap-4 min-h-[96px] rounded-[20px] text-white px-5 py-4 transition-[filter] hover:brightness-[1.04]"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #1F84FF 0%, #0D6FE0 100%)",
              boxShadow: "0 14px 34px rgba(13,139,255,.38)",
            }}
          >
            <BasketballIcon
              size={210}
              className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 opacity-[0.14] text-white"
            />
            <span className="relative inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/12 ring-[1.5px] ring-[#EA6A2B] shrink-0 text-white">
              <BasketballIcon size={30} />
            </span>
            <span className="relative flex-1 min-w-0">
              <span className="block text-[22px] font-extrabold tracking-[-0.02em] leading-tight">
                I want to play
              </span>
              <span className="block text-[14px] text-white/85 mt-0.5">
                Find runs, join teams, play in leagues
              </span>
            </span>
            <ChevronRight
              size={24}
              className="relative opacity-80 group-hover:translate-x-0.5 transition-transform shrink-0"
            />
          </Link>
        </div>

        {/* ---------- OR divider ---------- */}
        <div className="flex items-center gap-3 w-[80%] mx-auto my-5">
          <span className="h-px flex-1 bg-[color:var(--hairline)]" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-4)]">
            or
          </span>
          <span className="h-px flex-1 bg-[color:var(--hairline)]" />
        </div>

        {/* ---------- Coach / Organize / Watch ---------- */}
        <div className="flex flex-col gap-3 w-[80%] mx-auto">
          <PathCard
            href="/login?intent=coach"
            icon={<TeamIcon size={26} />}
            title="Coach a team"
            sub="Manage rosters, lineups, practices & tournaments"
          />
          <PathCard
            href="/login?intent=organize"
            icon={<TrophyIcon size={26} />}
            title="Run a league or tournament"
            sub="Create leagues, tournaments & events"
          />
          <PathCard
            href="/discover"
            icon={<StarIcon size={26} />}
            title="Stay updated"
            sub="Live scores, schedules, players & brackets"
          />
        </div>

        {/* ---------- Sign in ---------- */}
        <div className="text-center mt-7 text-[14px] text-[color:var(--text-2)]">
          Already play in a league?{" "}
          <Link
            href="/login"
            className="inline-flex items-center gap-0.5 font-bold text-[color:var(--brand)] hover:underline"
          >
            Sign in
            <ChevronRight size={15} className="mt-0.5" />
          </Link>
        </div>

        {/* ---------- Trust strip ---------- */}
        <div className="grid grid-cols-3 mt-8 px-2">
          <Trust
            icon={<Shield size={22} />}
            label="FREE TO JOIN"
            sub="Always"
          />
          <Trust
            icon={<Users size={22} />}
            label="ALL AGES"
            sub="Youth to adult"
            divider
          />
          <Trust
            icon={<Smartphone size={22} />}
            label="NO APP NEEDED"
            sub="Works anywhere"
            divider
          />
        </div>
      </div>
    </main>
  );
}

function PathCard({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-[18px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,.04)] hover:bg-[color:var(--surface-2)] transition-colors"
    >
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[color:var(--surface-2)] text-[color:var(--text)] shrink-0 group-hover:bg-[color:var(--surface)]">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-extrabold text-[17px] tracking-[-0.01em] leading-tight">
          {title}
        </span>
        <span className="block text-[13px] text-[color:var(--text-3)] mt-1">
          {sub}
        </span>
      </span>
      <ChevronRight
        size={20}
        className="text-[color:var(--text-3)] group-hover:text-[color:var(--text)] shrink-0"
      />
    </Link>
  );
}

function Trust({
  icon,
  label,
  sub,
  divider,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-center gap-2.5 px-2 ${
        divider ? "border-l border-[color:var(--hairline)]" : ""
      }`}
    >
      <span className="text-[color:var(--brand)] shrink-0">{icon}</span>
      <span className="leading-tight">
        <span className="block text-[11px] font-bold tracking-[0.04em] text-[color:var(--text)]">
          {label}
        </span>
        <span className="block text-[11px] text-[color:var(--text-3)] mt-0.5">
          {sub}
        </span>
      </span>
    </div>
  );
}
