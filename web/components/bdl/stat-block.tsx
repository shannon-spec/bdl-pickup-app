import { cn } from "@/lib/utils";

type Sub = {
  text: string;
  tone?: "up" | "down" | "muted";
  icon?: React.ReactNode;
};

/**
 * The hero 4-stat pattern. Grouped inside <StatRow /> for hairline
 * dividers between items.
 */
export function StatBlock({
  label,
  value,
  unit,
  valueClassName,
  sub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  valueClassName?: string;
  sub?: Sub;
  className?: string;
}) {
  const subTone = sub?.tone ?? "muted";
  return (
    <div className={cn("pd-port-stat flex flex-col gap-2 min-w-0", className)}>
      <div className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
        {label}
      </div>
      <div
        className={cn(
          "num inline-flex items-baseline gap-1.5",
          "font-extrabold leading-none tracking-[-0.03em] text-[color:var(--text)]",
          "text-[clamp(30px,4.4vw,44px)]",
          valueClassName,
        )}
      >
        <span>{value}</span>
        {unit && (
          <span className="text-[0.55em] font-bold text-[color:var(--text-3)]">
            {unit}
          </span>
        )}
      </div>
      {sub && (
        <div
          className={cn(
            "inline-flex items-center gap-1 text-[11.5px]",
            subTone === "up" && "text-[color:var(--up)]",
            subTone === "down" && "text-[color:var(--down)]",
            subTone === "muted" && "text-[color:var(--text-2)]",
          )}
        >
          {sub.icon}
          <span>{sub.text}</span>
        </div>
      )}
    </div>
  );
}

/**
 * A horizontal row of StatBlocks with hairline dividers between items.
 * Responsive: 4 → 2 → 2 across breakpoints.
 */
export function StatRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-[clamp(16px,2.5vw,28px)]",
        "grid-cols-4",
        "max-md:grid-cols-2 max-md:gap-y-[22px]",
        "[&>.pd-port-stat]:relative",
        // Vertical hairline divider between siblings on desktop
        "[&>.pd-port-stat+.pd-port-stat]:before:content-['']",
        "[&>.pd-port-stat+.pd-port-stat]:before:absolute",
        "[&>.pd-port-stat+.pd-port-stat]:before:top-0",
        "[&>.pd-port-stat+.pd-port-stat]:before:bottom-0",
        "[&>.pd-port-stat+.pd-port-stat]:before:left-[calc(-1*clamp(16px,2.5vw,28px)/2)]",
        "[&>.pd-port-stat+.pd-port-stat]:before:w-px",
        "[&>.pd-port-stat+.pd-port-stat]:before:bg-[color:var(--hairline)]",
        // On 2-col (≤md), hide the divider on even children (which become the first of each row)
        "max-md:[&>.pd-port-stat:nth-child(2n+1)+.pd-port-stat]:before:left-[calc(-1*clamp(16px,2.5vw,28px)/2)]",
        "max-md:[&>.pd-port-stat:nth-child(2n+1)]:before:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
