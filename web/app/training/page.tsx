import Link from "next/link";
import { redirect } from "next/navigation";
import { Dumbbell, Flame, Plus } from "lucide-react";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { readSession } from "@/lib/auth/session";
import { getTrainingHome, type HomeExercise } from "@/lib/queries/training";
import { TrainingNav } from "./_components/training-nav";
import { XpBar } from "./_components/xp-bar";
import { ExerciseIcon } from "./_components/exercise-icon";

export const dynamic = "force-dynamic";
export const metadata = { title: "Training · BDL" };

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

export default async function TrainingPage() {
  const session = await readSession();
  if (!session?.playerId) redirect("/login?next=/training");

  const home = await getTrainingHome(session.playerId);

  return (
    <>
      <TopBar active="/training" />
      <PageFrame>
        <ContextHeader />
        <SectionHead title="Training" right={<Pill tone="brand">beta</Pill>} />
        <TrainingNav active="train" />

        <XpBar
          xp={home.xp}
          level={home.level}
          tier={home.tier}
          into={home.progress.into}
          needed={home.progress.needed}
          pct={home.progress.pct}
        />

        {home.exercises.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {home.exercises.map((ex) => (
              <ExerciseCard key={ex.slug} ex={ex} />
            ))}
          </div>
        )}
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}

function ExerciseCard({ ex }: { ex: HomeExercise }) {
  const goalMetDays = ex.days.filter((d) => d >= 2).length;
  const loggedDays = ex.days.filter((d) => d >= 1).length;
  const qualifying = ex.progression === "weekly-step" ? goalMetDays : loggedDays;
  return (
    <div className="flex flex-col gap-3 rounded-[16px] bg-[color:var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--hairline)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]">
            <ExerciseIcon slug={ex.slug} />
          </span>
          <div>
          <div className="text-[15px] font-bold">{ex.name}</div>
          <div className="text-[11.5px] text-[color:var(--text-3)]">
            {ex.hasRepGoal ? (
              <>
                Goal: {ex.currentGoal} reps/day
                {ex.type === "weighted" && ex.weightGoal != null
                  ? ` @ ${ex.weightGoal} lb`
                  : ""}{" "}
                · {ex.weeklyDayTarget} of 7 days
              </>
            ) : (
              <>Log daily · {ex.weeklyDayTarget} of 7 days</>
            )}
          </div>
          {ex.nextGoal != null && ex.nextGoal !== ex.currentGoal && (
            <div className="text-[10.5px] text-[color:var(--text-4)]">
              Next week: {ex.nextGoal} reps/day after a completed week
            </div>
          )}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-soft)] px-2.5 py-1 text-[12px] font-bold text-[color:var(--brand-ink)] num">
          <Flame size={13} strokeWidth={2.5} /> {ex.streak} wk
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {ex.days.map((d, i) => (
            <span
              key={i}
              className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold uppercase ${
                d >= 2
                  ? "bg-[color:var(--brand)] text-white"
                  : d === 1
                    ? "bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]"
                    : "bg-[color:var(--surface-2)] text-[color:var(--text-4)] shadow-[inset_0_0_0_1px_var(--hairline)]"
              }`}
            >
              {DOW[i]}
            </span>
          ))}
        </div>
        <span className="text-[11px] text-[color:var(--text-4)] num">
          {qualifying}/{ex.weeklyDayTarget}
        </span>
      </div>

      <Link
        href={`/training/log?ex=${ex.slug}`}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-[var(--cta-shadow)] hover:bg-[color:var(--brand-hover)]"
      >
        <Dumbbell size={14} strokeWidth={2.5} /> Log {ex.name}
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[16px] bg-[color:var(--surface)] p-10 text-center shadow-[inset_0_0_0_1px_var(--hairline-2)]">
      <Dumbbell size={28} className="text-[color:var(--text-3)]" />
      <div className="text-[14px] font-semibold">Build your program</div>
      <p className="max-w-[320px] text-[12.5px] text-[color:var(--text-3)]">
        Add exercises to your training cart, set your rhythm, and start earning
        XP for showing up and hitting your goals.
      </p>
      <Link
        href="/training/cart"
        className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-[var(--r-lg)] bg-[color:var(--brand)] px-5 text-[12px] font-bold uppercase tracking-[0.06em] text-white shadow-[var(--cta-shadow)] hover:bg-[color:var(--brand-hover)]"
      >
        <Plus size={14} strokeWidth={2.5} /> Add exercises
      </Link>
    </div>
  );
}
