import Image from "next/image";
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
          B<span style={{ color: "#E87722" }}>D</span>L
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
    <Image
      src="/bdl-mark.svg"
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority
      className={cn("flex-shrink-0", className)}
    />
  );
}
