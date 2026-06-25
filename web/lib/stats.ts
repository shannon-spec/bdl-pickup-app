/** Numeric box-score fields, in the order the editor renders them. */
export const STAT_FIELDS = [
  "minutes",
  "points",
  "rebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "fouls",
  "fgm",
  "fga",
  "tpm",
  "tpa",
  "ftm",
  "fta",
] as const;

export type StatField = (typeof STAT_FIELDS)[number];

export type StatRowInput = { playerId: string } & Partial<
  Record<StatField, string | number | null>
>;
