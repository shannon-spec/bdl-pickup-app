import { cn } from "@/lib/utils";

export function ProbabilityBar({
  aLabel,
  bLabel,
  a,
  b,
  compact,
  showTop = true,
  className,
}: {
  aLabel: string;
  bLabel: string;
  a: number; // 0-100
  b: number; // 0-100 (a + b should = 100)
  compact?: boolean;
  showTop?: boolean;
  className?: string;
}) {
  const aLeads = a >= b;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {showTop && (
        <div className="flex items-center justify-between text-[11.5px] font-medium font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
          <span className={aLeads ? "text-[color:var(--up)] font-bold" : undefined}>
            {aLabel} {Math.round(a)}%
          </span>
          <span className={!aLeads ? "text-[color:var(--up)] font-bold" : undefined}>
            {bLabel} {Math.round(b)}%
          </span>
        </div>
      )}
      <div
        className={cn(
          "flex overflow-hidden rounded-full bg-[color:var(--hairline)]",
          compact ? "h-1" : "h-1.5",
        )}
      >
        <div
          style={{ width: `${a}%` }}
          className={aLeads ? "bg-[color:var(--up)]" : "bg-[color:var(--text-3)]"}
        />
        <div
          style={{ width: `${b}%` }}
          className={!aLeads ? "bg-[color:var(--up)]" : "bg-[color:var(--text-3)]"}
        />
      </div>
    </div>
  );
}
