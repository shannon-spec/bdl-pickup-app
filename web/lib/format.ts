/**
 * Display label for a league/game format. Hides legacy `*-series`
 * variants and renders the new `series` value as a clean "SERIES".
 * Used by every pill that surfaces a format value so downstream
 * pages stay in sync.
 */
export function formatLabel(format: string): string {
  switch (format) {
    case "5v5":
    case "5v5-series":
      return "5 V 5";
    case "3v3":
    case "3v3-series":
      return "3 V 3";
    case "series":
      return "SERIES";
    default:
      return format.toUpperCase();
  }
}
