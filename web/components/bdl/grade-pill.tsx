"use client";

import { useRef } from "react";
import { Pill } from "./pill";
import { useRatingKey } from "./rating-key/rating-key-provider";
import type { GradeKey, RatingContext } from "./rating-key/copy";

export type Level = GradeKey;

/**
 * Standardised grade pill — opens the Rating Key modal pre-set to the
 * clicked grade and the surface's context (player vs. league).
 *
 * "Not Rated" still renders as an em-dash (or null when hideUnrated)
 * but is now a button so users can still ask "what does Not Rated
 * mean?" by clicking it.
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
  const ref = useRef<HTMLButtonElement | null>(null);
  const { open } = useRatingKey();

  if (level === "Not Rated") {
    if (hideUnrated) return null;
    return (
      <button
        ref={ref}
        type="button"
        aria-label="Rating key — Not Rated"
        onClick={() =>
          open({ context, grade: "Not Rated", trigger: ref.current })
        }
        className="text-[color:var(--text-3)] text-[12px] hover:text-[color:var(--text)] transition-colors cursor-pointer"
      >
        —
      </button>
    );
  }

  const tone =
    level === "Pro" || level === "Game Changer"
      ? "brand"
      : level === "Advanced"
        ? "win"
        : "neutral";

  const grade = (
    [
      "Not Rated",
      "Novice",
      "Intermediate",
      "Advanced",
      "Game Changer",
      "Pro",
    ] as GradeKey[]
  ).includes(level as GradeKey)
    ? (level as GradeKey)
    : "Not Rated";

  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Rating key — ${level}`}
      onClick={() => open({ context, grade, trigger: ref.current })}
      className="cursor-pointer hover:brightness-105 transition-[filter] focus-visible:outline-2 focus-visible:outline-[color:var(--brand)] focus-visible:outline-offset-2 rounded-full"
    >
      <Pill tone={tone}>{level}</Pill>
    </button>
  );
}
