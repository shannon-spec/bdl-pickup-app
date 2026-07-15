const label = (week: string) => {
  const [, m, d] = week.split("-");
  return `${Number(m)}/${Number(d)}`;
};

/** Weekly-volume column chart (hand-built; no chart lib in the repo). */
export function VolumeBars({
  series,
  max,
}: {
  series: { week: string; reps: number }[];
  max: number;
}) {
  return (
    <div className="flex h-28 items-end gap-2">
      {series.map((p) => (
        <div
          key={p.week}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
        >
          <span className="text-[10px] text-[color:var(--text-3)] num">
            {p.reps}
          </span>
          <div
            className="w-full min-h-[2px] rounded-t-[4px] bg-[color:var(--brand)]"
            style={{ height: `${Math.round((p.reps / max) * 100)}%` }}
          />
          <span className="text-[9.5px] text-[color:var(--text-4)] num">
            {label(p.week)}
          </span>
        </div>
      ))}
    </div>
  );
}
