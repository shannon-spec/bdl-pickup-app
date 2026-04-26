import Image from "next/image";
import { cn } from "@/lib/utils";

const LOCKUP_RATIO = 1000 / 340; // aspect ratio of bdl-lockup-*.png

/**
 * Full BDL lockup (basketball mark + "BDL · BALL DON'T LIE" wordmark).
 * Theme-aware: the dark-mode artwork is hidden in light mode and vice
 * versa via the `dark:` Tailwind variant (mapped to `[data-theme="dark"]`
 * in globals.css).
 */
export function Brand({
  className,
  height = 41,
}: {
  className?: string;
  /** Rendered height in px. Width derives from the lockup aspect ratio. */
  height?: number;
}) {
  const width = Math.round(height * LOCKUP_RATIO);
  return (
    <div
      className={cn("flex items-center min-w-0", className)}
      style={{ height }}
    >
      <Image
        src="/bdl-lockup-light.png"
        alt="BDL · Ball Don't Lie"
        width={width}
        height={height}
        priority
        className="block dark:hidden flex-shrink-0"
        style={{ height, width: "auto" }}
      />
      <Image
        src="/bdl-lockup-dark.png"
        alt="BDL · Ball Don't Lie"
        width={width}
        height={height}
        priority
        className="hidden dark:block flex-shrink-0"
        style={{ height, width: "auto" }}
      />
    </div>
  );
}

export function BrandMark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
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
