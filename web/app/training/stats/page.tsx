import { redirect } from "next/navigation";
import { Award, Flame, Lock } from "lucide-react";
import { TopBar } from "@/components/bdl/top-bar";
import { ContextHeader } from "@/components/bdl/context-header/context-header";
import { PageFrame, SectionHead } from "@/components/bdl/page-frame";
import { MobileBottomBar } from "@/components/bdl/mobile-bottom-bar";
import { Pill } from "@/components/bdl/pill";
import { readSession } from "@/lib/auth/session";
import { getTrainingStats } from "@/lib/queries/training";
import { exerciseBySlug, TRAINING_GROUPS } from "@/lib/training/catalog";
import { TrainingNav } from "../_components/training-nav";
import { VolumeBars } from "../_components/volume-bars";
import { StreakChips } from "../_components/streak-chips";
import { Heatmap } from "../_components/heatmap";

export const dynamic = "force-dynamic";
export const metadata = { title: "Training Stats · BDL" };

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-[16px] bg-[color:var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--hairline)]">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-2)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function TrainingStatsPage() {
  const session = await readSession();
  if (!session?.playerId) redirect("/login?next=/training/stats");

  const stats = await getTrainingStats(session.playerId);
  const unlockedCount = stats.trophies.filter((t) => t.unlocked).length;
  const groupOf = (slug: string) => exerciseBySlug(slug)?.group;

  return (
    <>
      <TopBar active="/training" />
      <PageFrame>
        <ContextHeader />
        <SectionHead title="Training" right={<Pill tone="brand">beta</Pill>} />
        <TrainingNav active="stats" />

        {/* Per-group: current streaks, weekly volume, weekly-goal chips */}
        {TRAINING_GROUPS.map((g) => {
          const gStreaks = stats.streaks.filter((s) => groupOf(s.slug) === g.key);
          const gVolume = stats.volume.filter((v) => groupOf(v.slug) === g.key);
          const gChips = stats.chips.filter((c) => groupOf(c.slug) === g.key);
          if (!gStreaks.length && !gVolume.length && !gChips.length) return null;
          return (
            <div key={g.key} className="flex flex-col gap-3">
              <SectionHead title={g.label} />
              {gStreaks.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {gStreaks.map((s) => (
                    <div
                      key={s.slug}
                      className="flex flex-col gap-1 rounded-[14px] bg-[color:var(--surface)] p-3.5 shadow-[inset_0_0_0_1px_var(--hairline)]"
                    >
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-3)]">
                        {s.name}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[22px] font-extrabold num font-[family-name:var(--mono)]">
                        <Flame size={18} className="text-[color:var(--brand)]" />
                        {s.streak}
                      </span>
                      <span className="text-[10.5px] text-[color:var(--text-4)]">
                        week streak
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {gVolume.map((v) => (
                <Card key={v.slug} title={`${v.name} — weekly volume (reps)`}>
                  <VolumeBars series={v.series} max={v.max} />
                </Card>
              ))}
              {gChips.length > 0 && (
                <Card title="Weekly goal — last 8 weeks">
                  <div className="flex flex-col gap-3">
                    {gChips.map((c) => (
                      <div key={c.slug} className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-[color:var(--text-2)]">
                          {c.name}
                        </span>
                        <StreakChips weekly={c.weekly} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          );
        })}

        {/* Trophy cabinet (all exercises) */}
        <Card title={`Trophies · ${unlockedCount} of ${stats.trophies.length}`}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {stats.trophies.map((t) => (
              <div
                key={t.id}
                className={`flex items-start gap-2.5 rounded-[12px] p-3 ${
                  t.unlocked
                    ? "bg-[color:var(--surface-2)] shadow-[inset_0_0_0_1px_var(--hairline)]"
                    : "bg-transparent shadow-[inset_0_0_0_1px_var(--hairline)] opacity-60"
                }`}
              >
                {t.unlocked ? (
                  <Award
                    size={18}
                    strokeWidth={2.5}
                    className="mt-0.5 shrink-0 text-[color:var(--gold)]"
                  />
                ) : (
                  <Lock
                    size={16}
                    className="mt-0.5 shrink-0 text-[color:var(--text-4)]"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[12.5px] font-bold">
                    {t.label}
                    {t.comingSoon && !t.unlocked && (
                      <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[color:var(--text-4)]">
                        soon
                      </span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-[color:var(--text-3)]">
                    {t.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Days-logged heatmap */}
        <Card title="Training rhythm — last 8 weeks">
          <Heatmap rows={stats.heatmap} />
        </Card>
      </PageFrame>
      <MobileBottomBar active="home" />
    </>
  );
}
