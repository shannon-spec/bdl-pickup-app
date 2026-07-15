import { Fragment } from "react";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

const label = (week: string) => {
  const [, m, d] = week.split("-");
  return `${Number(m)}/${Number(d)}`;
};

/** Shade a day by how many distinct exercises were trained. */
const cellClass = (n: number) =>
  n <= 0
    ? "bg-[color:var(--surface-2)]"
    : n === 1
      ? "bg-[color:var(--brand-soft)]"
      : n === 2
        ? "bg-[rgba(13,139,255,0.55)]"
        : "bg-[color:var(--brand)]";

/** 7-day × 8-week training-rhythm grid (contribution-graph style). */
export function Heatmap({ rows }: { rows: { week: string; days: number[] }[] }) {
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
                title={`${label(r.week)} · ${c} exercise${c === 1 ? "" : "s"}`}
                className={`h-4 rounded-[3px] ${cellClass(c)}`}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-[color:var(--text-3)]">
        <span>Less</span>
        {[0, 1, 2, 3].map((n) => (
          <span key={n} className={`h-3 w-3 rounded-[3px] ${cellClass(n)}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
