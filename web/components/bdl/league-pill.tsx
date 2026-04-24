import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * League switcher pill used in the context strip. Shows a gradient
 * league dot, the league name, the season in mono, and an optional
 * chevron affordance when multiple leagues are available.
 */
export function LeaguePill({
  name,
  season,
  hasMore,
  onClick,
  className,
}: {
  name: string;
  season?: string;
  hasMore?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full",
        "h-[42px] pl-1 pr-4",
        "bg-[color:var(--surface)] border border-[color:var(--hairline-2)]",
        "text-[14px] font-medium text-[color:var(--text)]",
        "transition-colors",
        onClick && "cursor-pointer hover:bg-[color:var(--surface-2)] hover:border-[color:var(--text-4)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="rounded-full w-[34px] h-[34px] flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, var(--brand), #8B2FA0)",
          boxShadow: "inset 0 0 0 2px var(--mark-inset)",
        }}
      />
      <span className="font-bold">{name}</span>
      {season && (
        <span className="font-[family-name:var(--mono)] text-[12px] text-[color:var(--text-3)] num">
          {season}
        </span>
      )}
      {hasMore && (
        <ChevronDown size={14} className="text-[color:var(--text-3)]" />
      )}
    </Comp>
  );
}
