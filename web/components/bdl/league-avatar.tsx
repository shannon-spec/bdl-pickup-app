/**
 * League avatar — renders either initials over a colored gradient
 * (monogram) or a single emoji on a colored background. Mirrors the
 * Apple Contact-poster aesthetic used in messaging apps so leagues
 * read at a glance across the surface.
 *
 * Color keys index AVATAR_COLORS below; unknown keys fall back to
 * `brand` so legacy rows always render. Server- and client-renderable.
 */

export type LeagueAvatarKind = "monogram" | "emoji";

export type LeagueAvatarInput = {
  kind: string | null | undefined;
  color: string | null | undefined;
  emoji: string | null | undefined;
  abbr: string;
};

export type AvatarColor = {
  key: string;
  label: string;
  /** CSS gradient string used as the dot background. */
  background: string;
  /** Foreground text color. */
  text: string;
};

export const AVATAR_COLORS: AvatarColor[] = [
  {
    key: "brand",
    label: "Brand",
    background: "linear-gradient(135deg, var(--brand) 0%, #0461C2 100%)",
    text: "#fff",
  },
  {
    key: "emerald",
    label: "Emerald",
    background: "linear-gradient(135deg, #1FA463 0%, #0A6A40 100%)",
    text: "#fff",
  },
  {
    key: "teal",
    label: "Teal",
    background: "linear-gradient(135deg, #2A6F7B 0%, #143F47 100%)",
    text: "#fff",
  },
  {
    key: "ruby",
    label: "Ruby",
    background: "linear-gradient(135deg, #E14B5A 0%, #9C1D2C 100%)",
    text: "#fff",
  },
  {
    key: "sage",
    label: "Sage",
    background: "linear-gradient(135deg, #6FB48F 0%, #2E8056 100%)",
    text: "#fff",
  },
  {
    key: "rose",
    label: "Rose",
    background: "linear-gradient(135deg, #F0A6BB 0%, #B85580 100%)",
    text: "#fff",
  },
  {
    key: "coral",
    label: "Coral",
    background: "linear-gradient(135deg, #F0823D 0%, #BE3E80 100%)",
    text: "#fff",
  },
  {
    key: "pink",
    label: "Pink",
    background: "linear-gradient(135deg, #F4A4BD 0%, #C77AAA 100%)",
    text: "#fff",
  },
  {
    key: "amber",
    label: "Amber",
    background: "linear-gradient(135deg, #F4B73B 0%, #D17A2C 100%)",
    text: "#0a0a0a",
  },
  {
    key: "violet",
    label: "Violet",
    background: "linear-gradient(135deg, #8062D6 0%, #4B2EA8 100%)",
    text: "#fff",
  },
  {
    key: "slate",
    label: "Slate",
    background: "linear-gradient(135deg, #6B7280 0%, #374151 100%)",
    text: "#fff",
  },
  {
    key: "graphite",
    label: "Graphite",
    background:
      "linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3, var(--hairline-2)) 100%)",
    text: "var(--text)",
  },

  // Lighter pastel shades — softer, more contact-poster.
  // Foreground stays dark for readability against the lift.
  {
    key: "sky",
    label: "Sky",
    background: "linear-gradient(135deg, #BCE0FF 0%, #7FB6E8 100%)",
    text: "#0a3052",
  },
  {
    key: "mint",
    label: "Mint",
    background: "linear-gradient(135deg, #C7EBD0 0%, #8BCFA0 100%)",
    text: "#0d3a23",
  },
  {
    key: "seafoam",
    label: "Seafoam",
    background: "linear-gradient(135deg, #C0EDE3 0%, #7BCBBC 100%)",
    text: "#0e3b34",
  },
  {
    key: "lavender",
    label: "Lavender",
    background: "linear-gradient(135deg, #DCD0F5 0%, #B19DDC 100%)",
    text: "#2a1d4a",
  },
  {
    key: "blush",
    label: "Blush",
    background: "linear-gradient(135deg, #F8D2DC 0%, #E89DAE 100%)",
    text: "#4d1929",
  },
  {
    key: "peach",
    label: "Peach",
    background: "linear-gradient(135deg, #FDD9B7 0%, #F4A87A 100%)",
    text: "#522612",
  },
  {
    key: "buttercream",
    label: "Buttercream",
    background: "linear-gradient(135deg, #FCE8AB 0%, #F1C76C 100%)",
    text: "#4a3409",
  },
  {
    key: "linen",
    label: "Linen",
    background: "linear-gradient(135deg, #F4ECDD 0%, #DCC9A1 100%)",
    text: "#3a2e15",
  },
];

export function getAvatarColor(key: string | null | undefined): AvatarColor {
  return AVATAR_COLORS.find((c) => c.key === key) ?? AVATAR_COLORS[0];
}

export function LeagueAvatar({
  kind,
  color,
  emoji,
  abbr,
  size = 36,
  className,
}: LeagueAvatarInput & { size?: number; className?: string }) {
  const c = getAvatarColor(color);
  const isEmoji = kind === "emoji" && emoji && emoji.trim().length > 0;

  // Scale typography off the size so a 28px dot still reads. Monogram
  // text fills more of the circle than emoji glyphs do natively.
  const monoFont = Math.max(11, Math.round(size * 0.4));
  const emojiFont = Math.max(14, Math.round(size * 0.55));

  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-full flex-shrink-0 ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: c.background,
        color: c.text,
        boxShadow: "inset 0 0 0 2px var(--mark-inset)",
        fontWeight: 800,
        fontSize: isEmoji ? emojiFont : monoFont,
        lineHeight: 1,
        letterSpacing: isEmoji ? 0 : "-0.01em",
      }}
    >
      {isEmoji ? emoji : abbr}
    </span>
  );
}
