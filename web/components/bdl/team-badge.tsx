import { cn } from "@/lib/utils";

export function TeamBadge({
  team,
  size = 36,
  className,
}: {
  team: "white" | "dark";
  size?: number;
  className?: string;
}) {
  const letter = team === "white" ? "W" : "D";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[10px]",
        "font-extrabold tracking-[-0.02em]",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: team === "white" ? "var(--tb-white-bg)" : "var(--tb-dark-bg)",
        color: team === "white" ? "var(--tb-white-fg)" : "var(--tb-dark-fg)",
        boxShadow:
          team === "white"
            ? "inset 0 0 0 1px var(--hairline-2)"
            : "inset 0 0 0 1px rgba(255,255,255,.04)",
      }}
    >
      {letter}
    </span>
  );
}
