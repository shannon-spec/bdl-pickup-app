import { Check } from "lucide-react";

const label = (week: string) => {
  const [, m, d] = week.split("-");
  return `${Number(m)}/${Number(d)}`;
};

/** One chip per week: filled check = weekly day-target met, empty = missed. */
export function StreakChips({
  weekly,
}: {
  weekly: { week: string; hit: boolean }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {weekly.map((w) => (
        <span
          key={w.week}
          title={`Week of ${label(w.week)}`}
          className={`grid h-6 w-6 place-items-center rounded-full ${
            w.hit
              ? "bg-[color:var(--brand)] text-white"
              : "bg-[color:var(--surface-2)] text-[color:var(--text-4)] shadow-[inset_0_0_0_1px_var(--hairline)]"
          }`}
        >
          {w.hit && <Check size={12} strokeWidth={3} />}
        </span>
      ))}
    </div>
  );
}
