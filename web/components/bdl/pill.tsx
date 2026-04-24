import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "win" | "loss" | "warn" | "info";

const toneStyles: Record<Tone, string> = {
  neutral:
    "bg-[color:var(--surface-2)] text-[color:var(--text-2)] border border-[color:var(--hairline)]",
  brand: "bg-[color:var(--brand-soft)] text-[color:var(--brand-ink)]",
  win: "bg-[color:var(--up-soft)] text-[color:var(--up)]",
  loss: "bg-[color:var(--down-soft)] text-[color:var(--down)]",
  warn: "bg-[color:var(--warn-soft)] text-[color:var(--warn)]",
  info: "bg-[color:var(--info-soft)] text-[color:var(--info)]",
};

export function Pill({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full",
        "px-2.5 py-1 uppercase tracking-[0.06em]",
        "text-[11px] font-semibold leading-none whitespace-nowrap",
        toneStyles[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
        />
      )}
      {children}
    </span>
  );
}
