import { Fragment } from "react";
import type { HeatCell } from "@/lib/queries/training";

const CELL: Record<HeatCell, string> = {
  none: "bg-[color:var(--surface-2)]",
  pushups: "bg-[color:var(--brand-soft)]",
  bench: "bg-[color:var(--info-soft)]",
  both: "bg-[color:var(--brand)]",
};

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

const label = (week: string) => {
  const [, m, d] = week.split("-");
  return `${Number(m)}/${Number(d)}`;
};

const LEGEND: { cell: HeatCell; text: string }[] = [
  { cell: "pushups", text: "Push-ups" },
  { cell: "bench", text: "Bench" },
  { cell: "both", text: "Both" },
  { cell: "none", text: "Rest" },
];

/** 7-day × 8-week training-rhythm grid (contribution-graph style). */
export function Heatmap({
  rows,
}: {
  rows: { week: string; days: HeatCell[] }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid items-center gap-1"
        style={{ gridTemplateColumns: "auto repeat(7, minmax(0, 1fr))" }}
      >
        <span />
        {DOW.map((d, i) => (
          <span
            key={i}
            className="text-center text-[9px] uppercase text-[color:var(--text-4)]"
          >
            {d}
          </span>
        ))}
        {rows.map((r) => (
          <Fragment key={r.week}>
            <span className="pr-1 text-right text-[9px] text-[color:var(--text-4)] num">
              {label(r.week)}
            </span>
            {r.days.map((c, i) => (
              <span
                key={i}
                title={`${label(r.week)} · ${c}`}
                className={`h-4 rounded-[3px] ${CELL[c]}`}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {LEGEND.map((l) => (
          <span
            key={l.cell}
            className="inline-flex items-center gap-1.5 text-[10px] text-[color:var(--text-3)]"
          >
            <span className={`h-3 w-3 rounded-[3px] ${CELL[l.cell]}`} />
            {l.text}
          </span>
        ))}
      </div>
    </div>
  );
}
