import { cn } from "@/lib/utils";

/**
 * Standard page body container. Max-width 1240px, fluid horizontal
 * padding, safe-area-aware bottom padding so the mobile bottom bar
 * doesn't cover content.
 */
export function PageFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "mx-auto max-w-[1240px] w-full",
        "px-[clamp(14px,3vw,28px)] pt-[28px]",
        "pb-[calc(80px+var(--safe-bottom))]",
        "flex flex-col gap-6",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function SectionHead({
  title,
  count,
  right,
  className,
}: {
  title: string;
  count?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="inline-flex items-center gap-2.5">
        <span aria-hidden className="w-[3px] h-[12px] rounded-sm bg-[color:var(--brand)]" />
        <span className="text-[11.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-2)]">
          {title}
        </span>
        {count !== undefined && (
          <span className="text-[12px] font-medium text-[color:var(--text-4)] num">
            {count}
          </span>
        )}
      </div>
      {right}
    </div>
  );
}
