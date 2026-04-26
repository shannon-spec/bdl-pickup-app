/**
 * Hero tag — red shaded pill awarded to the gameWinner of any close
 * game (margin ≤ 3). Pairs the pill with the hero's name in plain
 * text so the recognition reads as a callout, not just a badge.
 */
export function isHeroGame(args: {
  gameWinner: string | null;
  scoreA: number | null;
  scoreB: number | null;
}): boolean {
  if (!args.gameWinner) return false;
  if (args.scoreA === null || args.scoreB === null) return false;
  return Math.abs(args.scoreA - args.scoreB) <= 3;
}

export function HeroTag({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  const small = size === "sm";
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span
        className={`inline-flex items-center gap-1 rounded-full font-extrabold uppercase tracking-[0.08em] border ${
          small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
        }`}
        style={{
          background: "rgba(234,67,53,.18)",
          borderColor: "rgba(234,67,53,.55)",
          color: "var(--down)",
        }}
      >
        <span aria-hidden>★</span>
        Hero
      </span>
      <span
        className={`font-bold text-[color:var(--text)] ${
          small ? "text-[12px]" : "text-[13px]"
        }`}
      >
        {name}
      </span>
    </span>
  );
}
