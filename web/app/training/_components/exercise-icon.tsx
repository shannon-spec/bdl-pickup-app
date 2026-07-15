/**
 * Per-exercise line icons, drawn to match the app's lucide stroke style
 * (24×24, currentColor, round caps). Server-safe (no hooks) so it can be
 * used from both server and client components.
 */

type Props = { slug: string; size?: number; className?: string };

function Svg({
  size = 18,
  className,
  children,
}: {
  size?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Side-view plank / push-up: head, straight back to feet, support arm, floor. */
function PushupsIcon(p: { size?: number; className?: string }) {
  return (
    <Svg size={p.size} className={p.className}>
      <circle cx="5" cy="8" r="1.9" />
      <path d="M6.6 9.3 L19.5 15" />
      <path d="M6.9 9.6 L6 18" />
      <path d="M19.5 15 L20.6 18" />
      <path d="M3 18 H21.5" />
    </Svg>
  );
}

/** Barbell (bar + plates + collars) for bench press. */
function BenchIcon(p: { size?: number; className?: string }) {
  return (
    <Svg size={p.size} className={p.className}>
      <path d="M2 12 H22" />
      <path d="M5.5 8 V16" />
      <path d="M8 9.5 V14.5" />
      <path d="M16 9.5 V14.5" />
      <path d="M18.5 8 V16" />
      <path d="M3 10.5 V13.5" />
      <path d="M21 10.5 V13.5" />
    </Svg>
  );
}

/** Basketball (circle + seams) for daily shots. */
function ShotsIcon(p: { size?: number; className?: string }) {
  return (
    <Svg size={p.size} className={p.className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3 V21" />
      <path d="M3 12 H21" />
      <path d="M5.6 5.2 C 9 9, 9 15, 5.6 18.8" />
      <path d="M18.4 5.2 C 15 9, 15 15, 18.4 18.8" />
    </Svg>
  );
}

export function ExerciseIcon({ slug, size, className }: Props) {
  if (slug === "pushups") return <PushupsIcon size={size} className={className} />;
  if (slug === "shots") return <ShotsIcon size={size} className={className} />;
  return <BenchIcon size={size} className={className} />;
}
