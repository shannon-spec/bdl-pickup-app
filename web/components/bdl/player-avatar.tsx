import { cn } from "@/lib/utils";

/**
 * Server-friendly avatar that renders the uploaded headshot when set,
 * else a brand-gradient initials disc. Uses a plain <img> so we don't
 * need to whitelist Vercel Blob in next.config — the image is already
 * CDN-served.
 */
export function PlayerAvatar({
  url,
  initials,
  size = 40,
  className,
}: {
  url?: string | null;
  initials: string;
  size?: number;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className={cn(
          "rounded-full object-cover flex-shrink-0",
          "border border-[color:var(--hairline-2)]",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-full text-white font-extrabold flex-shrink-0",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: "linear-gradient(135deg, var(--brand), var(--brand-2))",
      }}
    >
      {initials}
    </span>
  );
}
