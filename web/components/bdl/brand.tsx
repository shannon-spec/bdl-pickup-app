import { cn } from "@/lib/utils";

/**
 * The BDL basketball mark + wordmark. Larger than standard on purpose —
 * it's the first point of visual gravity in the top bar.
 */
export function Brand({ className, showSub = true }: { className?: string; showSub?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      <BrandMark size={34} />
      <div className="flex flex-col leading-none min-w-0">
        <span className="font-extrabold text-[20px] tracking-[-0.03em] text-[color:var(--text)]">
          BDL
        </span>
        {showSub && (
          <span className="mt-1.5 text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[color:var(--text-3)] whitespace-nowrap">
            Ball Don't Lie
          </span>
        )}
      </div>
    </div>
  );
}

export function BrandMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-block rounded-full flex-shrink-0", className)}
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 32% 30%, #ff8a5c, #F04E23 55%, #9B2A10)",
        boxShadow: "inset 0 0 0 1px var(--mark-inset)",
      }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background: [
            "radial-gradient(circle at 50% 50%, transparent 62%, rgba(0,0,0,.18) 62.5%, transparent 64%)",
            "radial-gradient(circle at 50% 50%, transparent 45%, rgba(255,255,255,.28) 45.5%, transparent 47%)",
          ].join(","),
        }}
      />
      <span
        className="pointer-events-none absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] opacity-35"
        style={{ background: "#fff" }}
      />
    </span>
  );
}
