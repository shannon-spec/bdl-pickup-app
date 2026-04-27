import Link from "next/link";
import { Pill } from "./pill";
import type { GradeKey, RatingContext } from "./rating-key/copy";

export type Level = GradeKey;

const ALL_GRADES: GradeKey[] = [
  "Not Rated",
  "Novice",
  "Intermediate",
  "Advanced",
  "Game Changer",
  "Pro",
];

/**
 * Grade pill — links to the full /grades page pre-set to the clicked
 * grade and the surface's context (player vs. league). "Not Rated"
 * still renders as an em-dash (or null with hideUnrated) but is itself
 * a link so users can ask "what does Not Rated mean?".
 */
export function GradePill({
  level,
  hideUnrated,
  context = "player",
}: {
  level: Level | string;
  hideUnrated?: boolean;
  context?: RatingContext;
}) {
  const grade = ALL_GRADES.includes(level as GradeKey)
    ? (level as GradeKey)
    : "Not Rated";
  const href = `/grades?context=${context}&grade=${encodeURIComponent(grade)}`;

  if (level === "Not Rated") {
    if (hideUnrated) return null;
    return (
      <Link
        href={href}
        aria-label="Grades — Not Rated"
        className="text-[color:var(--text-3)] text-[12px] hover:text-[color:var(--text)] transition-colors"
      >
        —
      </Link>
    );
  }

  const tone =
    level === "Pro" || level === "Game Changer"
      ? "brand"
      : level === "Advanced"
        ? "win"
        : "neutral";

  return (
    <Link
      href={href}
      aria-label={`Grades — ${level}`}
      className="hover:brightness-105 transition-[filter] focus-visible:outline-2 focus-visible:outline-[color:var(--brand)] focus-visible:outline-offset-2 rounded-full"
    >
      <Pill tone={tone}>{level}</Pill>
    </Link>
  );
}
