import { Pill } from "./pill";

export type Level =
  | "Not Rated"
  | "Novice"
  | "Intermediate"
  | "Advanced"
  | "Game Changer"
  | "Pro";

/**
 * Standardised grade pill used for both player ratings and league
 * skill targets. "Not Rated" renders as an em-dash so it doesn't add
 * visual noise.
 */
export function GradePill({
  level,
  hideUnrated,
}: {
  level: Level | string;
  hideUnrated?: boolean;
}) {
  if (level === "Not Rated") {
    if (hideUnrated) return null;
    return <span className="text-[color:var(--text-3)] text-[12px]">—</span>;
  }
  if (level === "Pro" || level === "Game Changer") {
    return <Pill tone="brand">{level}</Pill>;
  }
  if (level === "Advanced") {
    return <Pill tone="win">{level}</Pill>;
  }
  return <Pill tone="neutral">{level}</Pill>;
}
