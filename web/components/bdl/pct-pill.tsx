/**
 * Pill-shaped career win % indicator. Green soft-bg ≥60, red <40,
 * neutral chip in between. Mono digits keep the value column aligned
 * across stacked rows.
 */
export function PctPill({ pct }: { pct: number }) {
  const tone =
    pct >= 60
      ? {
          bg: "var(--up-soft)",
          fg: "var(--up)",
          border: "rgba(52,168,83,.35)",
        }
      : pct < 40
      ? {
          bg: "var(--down-soft)",
          fg: "var(--down)",
          border: "rgba(234,67,53,.35)",
        }
      : {
          bg: "var(--surface-2)",
          fg: "var(--text-2)",
          border: "var(--hairline-2)",
        };
  return (
    <span
      className="inline-flex items-center justify-center min-w-[58px] h-6 px-2 rounded-full border font-[family-name:var(--mono)] num text-[11.5px] font-extrabold"
      style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}
    >
      {pct.toFixed(1)}%
    </span>
  );
}
