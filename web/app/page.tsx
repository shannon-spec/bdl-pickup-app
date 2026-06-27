import Link from "next/link";
import { ChevronRight, Shield, Users, Smartphone } from "lucide-react";
import { eq } from "drizzle-orm";
import { readSession } from "@/lib/auth/session";
import { getRememberedLogin } from "@/lib/cookies/last-login";
import { db, players } from "@/lib/db";
import { emailHash } from "@/lib/crypto/secrets";
import { getMyContexts } from "@/lib/queries/contexts";
import { Brand } from "@/components/bdl/brand";
import {
  BasketballIcon,
  TrophyIcon,
  TeamIcon,
  StarIcon,
} from "@/components/bdl/sport-icons";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "BDL · Ball Don't Lie — pickup basketball, organized",
};

type Known = {
  name: string;
  initials: string;
  avatarUrl: string | null;
  subline: string;
  hasSession: boolean;
};

/** Recognize the user from a live session, else from the device's remembered
 *  identifier. Returns null when we can't (→ anonymous cell). */
async function resolveKnown(): Promise<Known | null> {
  const session = await readSession();

  const fromPlayer = async (
    p: { firstName: string; lastName: string | null; avatarUrl: string | null },
    hasSession: boolean,
  ): Promise<Known | null> => {
    const first = (p.firstName ?? "").trim();
    if (!first) return null;
    const initials =
      `${first[0] ?? ""}${(p.lastName ?? "").trim()[0] ?? ""}`.toUpperCase();
    let subline = "Pick up where you left off";
    if (hasSession) {
      try {
        const ctx = await getMyContexts(session);
        if (ctx?.[0]) subline = ctx[0].name;
      } catch {
        /* best-effort */
      }
    }
    return { name: first, initials, avatarUrl: p.avatarUrl, subline, hasSession };
  };

  if (session?.playerId) {
    const [me] = await db
      .select({
        firstName: players.firstName,
        lastName: players.lastName,
        avatarUrl: players.avatarUrl,
      })
      .from(players)
      .where(eq(players.id, session.playerId))
      .limit(1);
    if (me) {
      const k = await fromPlayer(me, true);
      if (k) return k;
    }
  }

  // Not signed in (or no name) — try the device's remembered identifier.
  const remembered = await getRememberedLogin();
  if (remembered) {
    const hash =
      remembered.kind === "email"
        ? emailHash(remembered.value)
        : emailHash(remembered.value.replace(/\D/g, ""));
    const col =
      remembered.kind === "email" ? players.emailHash : players.phoneHash;
    const [me] = await db
      .select({
        firstName: players.firstName,
        lastName: players.lastName,
        avatarUrl: players.avatarUrl,
      })
      .from(players)
      .where(eq(col, hash))
      .limit(1);
    if (me) return fromPlayer(me, false);
  }

  return null;
}

export default async function FrontDoor() {
  const known = await resolveKnown();

  return (
    <main className="min-h-[100dvh] flex justify-center bg-[color:var(--bg)] px-0 sm:px-6 py-0 sm:py-6">
      <div className="w-full max-w-[750px] flex flex-col pb-9 overflow-hidden border-0 sm:border border-[#C4C2BA] rounded-none sm:rounded-[20px] shadow-none sm:shadow-[0_8px_34px_rgba(0,0,0,.10)] bg-[color:var(--bg)]">
        {/* ---------- Header: logo left, Sign in right ---------- */}
        <header className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[color:var(--hairline)]">
          <Link href="/" aria-label="BDL home" className="min-w-0">
            <Brand height={34} />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[14px] font-bold text-[color:var(--text)] hover:bg-[color:var(--surface-2)] transition-colors"
          >
            Sign in
          </Link>
        </header>

        {/* ---------- Court-photo backdrop: welcome cell + headline ---------- */}
        <section
          className="relative px-4 sm:px-5 pt-6 pb-9 text-white"
          style={{
            backgroundColor: "#0A0E14",
            backgroundImage:
              "linear-gradient(100deg, rgba(6,9,13,.86) 0%, rgba(6,9,13,.55) 46%, rgba(6,9,13,.22) 100%), url(/hero-court.jpg)",
            backgroundSize: "cover, cover",
            backgroundPosition: "center, center bottom",
          }}
        >
          <WelcomeCell known={known} />
          {known && (
            <p className="text-center mt-3 text-[13.5px] text-white/70">
              Not {known.name}?{" "}
              <Link
                href="/login"
                className="font-bold text-[#7CB0FF] hover:underline"
              >
                Sign in to another account
              </Link>
            </p>
          )}
          <h1 className="mt-7 text-[32px] font-extrabold tracking-[-0.035em] leading-[0.98]">
            Basketball
            <br />
            starts here<span style={{ color: "#EA6A2B" }}>.</span>
          </h1>
        </section>

        {/* ---------- New-to-BDL group ---------- */}
        <div className="px-4 sm:px-5 pt-6">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-3)] mb-3">
            New to BDL? Start here
          </p>
          <div className="flex flex-col gap-3">
            <PathCard
              href="/login?intent=play"
              icon={<BasketballIcon size={26} />}
              title="I want to play"
              sub="Find runs, join teams, play in leagues"
            />
            <PathCard
              href="/soon/coach"
              icon={<TeamIcon size={26} />}
              title="Coach a team"
              sub="Manage rosters, lineups, practices & tournaments"
            />
            <PathCard
              href="/soon/organize"
              icon={<TrophyIcon size={26} />}
              title="Run a league or tournament"
              sub="Create leagues, tournaments & events"
            />
            <PathCard
              href="/soon/watch"
              icon={<StarIcon size={26} />}
              title="Stay updated"
              sub="Live scores, schedules, players & brackets"
            />
          </div>
        </div>

        {/* ---------- Trust strip ---------- */}
        <div className="grid grid-cols-3 mt-8 px-3">
          <Trust icon={<Shield size={22} />} label="FREE TO JOIN" sub="Always" />
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

function WelcomeCell({ known }: { known: Known | null }) {
  const continueHref = known
    ? known.hasSession
      ? "/home"
      : "/login"
    : "/login";

  return (
    <div
      className="relative overflow-hidden rounded-[18px] text-white px-4 py-4 flex items-center gap-3.5"
      style={{
        backgroundImage: "linear-gradient(135deg, #1F84FF 0%, #0D6FE0 100%)",
        boxShadow: "0 12px 30px rgba(13,139,255,.32)",
      }}
    >
      {/* avatar */}
      {known?.avatarUrl ? (
        <span className="inline-flex w-12 h-12 rounded-full overflow-hidden shrink-0 ring-2 ring-white/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={known.avatarUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        </span>
      ) : known ? (
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white text-[#0D6FE0] font-extrabold text-[15px] shrink-0">
          {known.initials}
        </span>
      ) : (
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/15 text-white shrink-0">
          <BasketballIcon size={26} />
        </span>
      )}

      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-white/80 leading-none">
          {known ? "Welcome back" : "Welcome to BDL"}
        </div>
        <div className="text-[19px] font-extrabold leading-tight truncate mt-0.5">
          {known ? known.name : "Ball Don't Lie"}
        </div>
        <div className="text-[12.5px] text-white/75 truncate mt-0.5">
          {known ? known.subline : "Sign in to track your games"}
        </div>
      </div>

      <Link
        href={continueHref}
        className="shrink-0 inline-flex items-center gap-1 h-10 px-4 rounded-[12px] bg-white text-[#0D6FE0] font-bold text-[14px] hover:brightness-[0.97] transition-[filter]"
      >
        {known ? "Continue" : "Sign in"}
        <ChevronRight size={16} />
      </Link>
    </div>
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
