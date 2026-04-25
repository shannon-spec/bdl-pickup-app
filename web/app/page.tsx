import Link from "next/link";
import { ChevronRight, ChevronUp, Check } from "lucide-react";
import { readSession } from "@/lib/auth/session";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextStrip } from "@/components/bdl/context-strip";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { StatBlock, StatRow } from "@/components/bdl/stat-block";
import { TeamBadge } from "@/components/bdl/team-badge";
import { ProbabilityBar } from "@/components/bdl/probability-bar";
import { Pill } from "@/components/bdl/pill";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";

/**
 * Phase 1 landing page — renders the Player Dashboard shell with
 * mocked data so we can verify tokens, primitives, responsive
 * behavior, and light/dark parity before wiring real data.
 */
export default async function Home() {
  const session = await readSession();
  const initials = session?.username
    ? session.username.slice(0, 2).toUpperCase()
    : "ST";

  return (
    <>
      <TopBar active="/" userInitials={initials} />
      <PageFrame>
        <ContextStrip
          leagueName="CPA League"
          season="2026"
          schedule={
            <span>
              <strong className="text-[color:var(--text-2)] font-medium">
                Tuesdays & Thursdays
              </strong>{" "}
              · 7:00 PM
            </span>
          }
          hasMoreLeagues={false}
        />

        {/* Hero — Your Season */}
        <section className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] px-7 pt-6 pb-5 max-sm:px-5 max-sm:pt-5 max-sm:pb-4">
          <div className="flex items-center justify-between gap-3 mb-6 max-sm:flex-col max-sm:items-start max-sm:gap-1.5">
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
              Your Season · <span className="text-[color:var(--text-2)]">CPA League</span>
            </div>
            <div className="text-[12px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
              Week 16 of 20
            </div>
          </div>

          <StatRow>
            <StatBlock
              label="Win %"
              value="58.1"
              unit="%"
              sub={{
                text: "+3.2 last 5G",
                tone: "up",
                icon: <ChevronUp size={10} />,
              }}
            />
            <StatBlock
              label="Record"
              value={
                <span>
                  18
                  <span className="text-[color:var(--text-4)] font-bold mx-[-2px]">–</span>
                  13
                </span>
              }
              sub={{ text: "31 games played" }}
            />
            <StatBlock
              label="Games Played"
              value="84"
              unit="%"
              sub={{ text: "26 of 31 league nights" }}
            />
            <StatBlock
              label="Streak"
              value="W3"
              valueClassName="text-[color:var(--up)]"
              sub={{ text: "3 straight wins", tone: "up" }}
            />
          </StatRow>
        </section>

        {/* Next Game */}
        <section
          className="grid grid-cols-[1fr_auto] items-center gap-5 max-md:grid-cols-1 rounded-[16px] border border-[color:var(--hairline-2)] px-6 py-5 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse at top left, var(--brand-soft), transparent 60%), var(--surface)",
          }}
        >
          <div className="flex flex-col gap-3.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap text-[12px]">
              <Pill tone="brand">Next · Wed Mar 25 · 7:00 PM</Pill>
              <span className="text-[color:var(--text-3)]">CPA Facility</span>
            </div>
            <div className="flex items-center gap-3.5 flex-wrap">
              <TeamPick name="White" record="3-2" team="white" me />
              <span className="text-[color:var(--text-4)] text-[12px] font-medium">vs</span>
              <TeamPick name="Dark" record="2-3" team="dark" />
            </div>
            <ProbabilityBar aLabel="White" bLabel="Dark" a={62} b={38} />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 justify-center h-[46px] px-5 rounded-[12px] bg-[color:var(--brand)] hover:bg-[#DC3D14] text-white font-bold text-[14px] tracking-[0.02em] shadow-[var(--cta-shadow)] transition-transform active:scale-[0.97] max-md:w-full"
          >
            <Check size={18} strokeWidth={2.5} />
            I&apos;m In
          </button>
        </section>

        {/* Upcoming markets */}
        <div>
          <SectionHead
            title="Upcoming · CPA League"
            right={
              <Link
                href="/games"
                className="inline-flex items-center gap-1 text-[12px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
              >
                All games <ChevronRight size={13} />
              </Link>
            }
          />
          <div className="mt-3 rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
            <MarketRow date="Wed · Mar 25" time="7:00 PM" a="White" b="Dark" you="A" probA={62} probB={38} status="rsvp" />
            <MarketRow date="Mon · Mar 30" time="7:00 PM" a="White" b="Dark" you={null} probA={45} probB={55} status="open" />
            <MarketRow date="Wed · Apr 1" time="7:00 PM" a="White" b="Dark" you="B" probA={50} probB={50} status="rsvp" />
          </div>
        </div>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}

function TeamPick({
  name,
  record,
  team,
  me,
}: {
  name: string;
  record: string;
  team: "white" | "dark";
  me?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2.5">
      <TeamBadge team={team} />
      <div className="flex flex-col gap-0.5">
        <div className="font-bold text-[17px] text-[color:var(--text)] inline-flex items-center gap-1.5">
          {name}
          {me && (
            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
              You
            </span>
          )}
        </div>
        <div className="text-[11.5px] font-[family-name:var(--mono)] text-[color:var(--text-3)] num">
          {record} last 5
        </div>
      </div>
    </div>
  );
}

function MarketRow({
  date,
  time,
  a,
  b,
  you,
  probA,
  probB,
  status,
}: {
  date: string;
  time: string;
  a: string;
  b: string;
  you: "A" | "B" | null;
  probA: number;
  probB: number;
  status: "rsvp" | "open";
}) {
  return (
    <div className="grid gap-5 items-center px-5 py-4 grid-cols-[140px_1fr_200px_110px] max-[1100px]:grid-cols-[120px_1fr_110px] max-sm:grid-cols-[1fr_auto] max-sm:gap-y-2 border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] transition-colors cursor-pointer">
      <div className="flex flex-col gap-1">
        <span className="font-bold text-[12.5px] tracking-[0.02em] text-[color:var(--text)]">{date}</span>
        <span className="font-[family-name:var(--mono)] text-[10.5px] text-[color:var(--text-3)] num">{time}</span>
      </div>
      <div className="flex items-center gap-2 max-sm:col-span-2 max-sm:order-3">
        <span className="font-bold">{a}</span>
        {you === "A" && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
            You
          </span>
        )}
        <span className="text-[color:var(--text-4)] font-medium">vs</span>
        <span className="font-bold">{b}</span>
        {you === "B" && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
            You
          </span>
        )}
      </div>
      <div className="max-[1100px]:hidden">
        <ProbabilityBar aLabel="" bLabel="" a={probA} b={probB} compact showTop={false} />
      </div>
      <div className="justify-self-end">
        {status === "rsvp" ? (
          <Pill tone="win">RSVP&apos;d</Pill>
        ) : (
          <Pill tone="neutral">Open</Pill>
        )}
      </div>
    </div>
  );
}
