/**
 * Centralized color mapping for each grade tier so the pill looks
 * the same on /grades, the player profile, and the directory cards.
 *
 *   Not Rated    → neutral gray (uses surface tokens for theme)
 *   Novice       → slate (cool gray)
 *   Intermediate → sky  (light blue, distinct from brand)
 *   Advanced     → green
 *   Game Changer → orange
 *   Pro          → gold
 *
 * Backgrounds are semi-transparent so they read on both the light
 * and dark surface; text colors are picked to stay legible on
 * either background. Each tier also gets a 1px inner ring for
 * shape definition independent of the surface contrast.
 */
import type { GradeKey } from "@/lib/queries/player-grades";

export type GradePalette = {
  bg: string;
  text: string;
  ring: string;
};

export const GRADE_PALETTE: Record<GradeKey, GradePalette> = {
  "Not Rated": {
    bg: "var(--surface-2)",
    text: "var(--text-3)",
    ring: "var(--hairline-2)",
  },
  Novice: {
    bg: "rgba(100,116,139,0.14)",
    text: "#475569",
    ring: "rgba(100,116,139,0.40)",
  },
  Intermediate: {
    bg: "rgba(14,165,233,0.14)",
    text: "#0369A1",
    ring: "rgba(14,165,233,0.45)",
  },
  Advanced: {
    bg: "var(--up-soft)",
    text: "var(--up)",
    ring: "color-mix(in srgb, var(--up) 40%, transparent)",
  },
  "Game Changer": {
    bg: "rgba(234,88,12,0.14)",
    text: "#C2410C",
    ring: "rgba(234,88,12,0.45)",
  },
  Pro: {
    bg: "rgba(212,175,55,0.20)",
    text: "#8B6F1B",
    ring: "rgba(212,175,55,0.65)",
  },
};

export function GradePill({
  grade,
  size = "sm",
  className = "",
}: {
  grade: GradeKey;
  size?: "sm" | "lg";
  className?: string;
}) {
  const p = GRADE_PALETTE[grade];
  const sizeCx =
    size === "lg"
      ? "px-4 py-1.5 text-[21px] tracking-[-0.01em] max-sm:text-[18px] max-sm:px-3 max-sm:py-1"
      : "px-2 py-0.5 text-[10px] tracking-[0.06em] uppercase";
  return (
    <span
      className={`inline-flex items-center rounded-full font-extrabold leading-none whitespace-nowrap ${sizeCx} ${className}`}
      style={{
        background: p.bg,
        color: p.text,
        boxShadow: `inset 0 0 0 1px ${p.ring}`,
      }}
    >
      {grade}
    </span>
  );
}
