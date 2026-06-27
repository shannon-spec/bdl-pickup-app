/**
 * BDL line-icon set — black (currentColor) strokes with an orange accent,
 * matching the brand icon sheet. Strokes inherit currentColor so the same
 * icon reads white on a colored button and dark on a light card.
 */
const ACCENT = "#EA6A2B";

type IconProps = { size?: number; className?: string };

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  className,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function BasketballIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.8 V21.2 M2.8 12 H21.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.1 5.1 C 9.2 8.6 9.2 15.4 5.1 18.9" stroke={ACCENT} strokeWidth="1.8" />
      <path d="M18.9 5.1 C 14.8 8.6 14.8 15.4 18.9 18.9" stroke={ACCENT} strokeWidth="1.8" />
    </svg>
  );
}

export function TrophyIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M7 4 H17 V8 a5 5 0 0 1 -10 0 Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M7 5 C 4 5 4 9.5 7.4 9.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M17 5 C 20 5 20 9.5 16.6 9.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 13 V16.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 20 H15 M10 16.5 H14 V20 H10 Z" stroke="currentColor" strokeWidth="1.8" />
      <rect x="11" y="3.1" width="2" height="1.8" rx="0.5" fill={ACCENT} />
    </svg>
  );
}

export function TeamIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      {/* back person — black */}
      <circle cx="8.5" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 18 v-1 a5 5 0 0 1 8.5 -3.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {/* front person — orange */}
      <circle cx="15" cy="7.5" r="2.8" stroke={ACCENT} strokeWidth="1.8" />
      <path d="M10 18 v-1.5 a5 5 0 0 1 10 0 V18" stroke={ACCENT} strokeWidth="1.8" />
    </svg>
  );
}

export function StarIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path
        d="M12 2.6 L14.7 9.1 L21.6 9.5 L16.2 13.8 L18 20.4 L12 16.6 L6 20.4 L7.8 13.8 L2.4 9.5 L9.3 9.1 Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 7 L13.3 10.2 L16.7 10.4 L14 12.6 L14.9 15.9 L12 14 L9.1 15.9 L10 12.6 L7.3 10.4 L10.7 10.2 Z"
        stroke={ACCENT}
        strokeWidth="1.6"
      />
    </svg>
  );
}
