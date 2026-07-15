import type { Tier } from "@/lib/training/engine";

/** Headline level / tier / XP progress card for the Train home screen. */
export function XpBar({
  xp,
  level,
  tier,
  into,
  needed,
  pct,
}: {
  xp: number;
  level: number;
  tier: Tier;
  into: number;
  needed: number;
  pct: number;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-[16px] bg-[color:var(--surface)] p-4 shadow-[inset_0_0_0_1px_var(--hairline)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-10 w-10 place-items-center rounded-full text-[14px] font-extrabold text-white num"
            style={{ backgroundColor: tier.color }}
          >
            {level}
          </span>
          <div className="flex flex-col leading-tight">
            <span
              className="text-[13px] font-bold uppercase tracking-[0.08em]"
              style={{ color: tier.color }}
            >
              {tier.name}
            </span>
            <span aria-hidden className="text-[11px] tracking-[0.12em]">
              <span style={{ color: tier.color }}>{"★".repeat(tier.stars)}</span>
              <span className="text-[color:var(--text-4)]">
                {"☆".repeat(5 - tier.stars)}
              </span>
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[15px] font-extrabold num font-[family-name:var(--mono)]">
            {xp.toLocaleString()} XP
          </div>
          <div className="text-[11px] text-[color:var(--text-3)] num">
            Level {level}
          </div>
        </div>
      </div>

      <div>
        <div className="h-2 overflow-hidden rounded-full bg-[color:var(--hairline)]">
          <div
            className="h-full rounded-full bg-[color:var(--brand)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 text-right text-[11px] text-[color:var(--text-4)] num">
          {into} / {needed} to level {level + 1}
        </div>
      </div>

      <p className="text-[11.5px] text-[color:var(--text-3)]">{tier.perk}</p>
    </section>
  );
}
