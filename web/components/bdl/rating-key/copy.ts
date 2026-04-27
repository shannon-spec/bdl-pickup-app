export type RatingContext = "player" | "league";

export type GradeKey =
  | "Not Rated"
  | "Novice"
  | "Intermediate"
  | "Advanced"
  | "Game Changer"
  | "Pro";

export const GRADES: GradeKey[] = [
  "Not Rated",
  "Novice",
  "Intermediate",
  "Advanced",
  "Game Changer",
  "Pro",
];

export type GradeDef = {
  key: GradeKey;
  /** Plain-text fallback (for screen readers). */
  body: string;
  /** Description with <strong> highlights baked in for visual weight. */
  bodyHtml: string;
};

export const PLAYER_GRADES: Record<GradeKey, GradeDef> = {
  "Not Rated": {
    key: "Not Rated",
    body:
      "New to BDL or hasn't logged enough runs to be graded yet. Default for first-timers — rating unlocks after a few sessions and peer feedback.",
    bodyHtml:
      "New to BDL or hasn't logged enough runs to be graded yet. <strong>Default for first-timers</strong> — rating unlocks after a few sessions and peer feedback.",
  },
  Novice: {
    key: "Novice",
    body:
      "New to organized pickup. Still learning rotations, spacing, and pace. Hustle and conditioning carry more weight than craft. Welcomed at beginner-friendly runs.",
    bodyHtml:
      "<strong>New to organized pickup.</strong> Still learning rotations, spacing, and pace. Hustle and conditioning carry more weight than craft. Welcomed at <strong>beginner-friendly runs</strong>.",
  },
  Intermediate: {
    key: "Intermediate",
    body:
      "Solid rec-league hooper. Knows the game, hits the open shot, finishes around the rim, plays within a team concept. The default level of most pickup runs.",
    bodyHtml:
      "<strong>Solid rec-league hooper.</strong> Knows the game, hits the open shot, finishes around the rim, plays within a team concept. <strong>The default level of most pickup runs.</strong>",
  },
  Advanced: {
    key: "Advanced",
    body:
      "Former HS varsity, former college players past their prime years, or strong rec regulars. Reads plays, creates their own shot, guards up a level, makes the right pass. Holds their own at competitive runs.",
    bodyHtml:
      "<strong>Former HS varsity, former college players past their prime years, or strong rec regulars.</strong> Reads plays, creates their own shot, guards up a level, makes the right pass. Holds their own at <strong>competitive runs</strong>.",
  },
  "Game Changer": {
    key: "Game Changer",
    body:
      "Former college player or top-tier rec hooper. Raises the level of every team they're on. Can take over a stretch on either end. Captains pick first.",
    bodyHtml:
      "<strong>Former college player or top-tier rec hooper.</strong> Raises the level of every team they're on. Can take over a stretch on either end. <strong>Captains pick first.</strong>",
  },
  Pro: {
    key: "Pro",
    body:
      "D1, overseas, G League, or pro experience. Rare ceiling — used sparingly to keep runs balanced. Think \"gym ringer.\" Captain selection may be flagged.",
    bodyHtml:
      "<strong>D1, overseas, G League, or pro experience.</strong> Rare ceiling — used sparingly to keep runs balanced. Think <strong>\"gym ringer.\"</strong> Captain selection may be flagged.",
  },
};

export const LEAGUE_GRADES: Record<GradeKey, GradeDef> = {
  "Not Rated": {
    key: "Not Rated",
    body:
      "Brand-new league or unrated by organizers. Skill level still being established — rating set after the first few sessions and player feedback.",
    bodyHtml:
      "<strong>Brand-new league or unrated by organizers.</strong> Skill level still being established — rating set after the first few sessions and player feedback.",
  },
  Novice: {
    key: "Novice",
    body:
      "Beginner-friendly run. Welcoming to new players, fundamentals-focused, low-pressure. Good first stop if you're new to pickup or returning from a long layoff.",
    bodyHtml:
      "<strong>Beginner-friendly run.</strong> Welcoming to new players, fundamentals-focused, low-pressure. <strong>Good first stop</strong> if you're new to pickup or returning from a long layoff.",
  },
  Intermediate: {
    key: "Intermediate",
    body:
      "The default rec environment. Mixed skill, fair calls, competitive but not chippy. Most BDL leagues live here. Show up, shoot around, get a run.",
    bodyHtml:
      "<strong>The default rec environment.</strong> Mixed skill, fair calls, competitive but not chippy. <strong>Most BDL leagues live here.</strong> Show up, shoot around, get a run.",
  },
  Advanced: {
    key: "Advanced",
    body:
      "High-level rec. Consistent regulars, real defense, real spacing, real fouls. You'll be tested. Bring a teammate or expect to earn your spot.",
    bodyHtml:
      "<strong>High-level rec.</strong> Consistent regulars, real defense, real spacing, real fouls. <strong>You'll be tested.</strong> Bring a teammate or expect to earn your spot.",
  },
  "Game Changer": {
    key: "Game Changer",
    body:
      "Elite rec or minor open-run league. Ex-college players are regulars. Fast pace, real scoring, real consequences for bad shots. Captains run it tight.",
    bodyHtml:
      "<strong>Elite rec or minor open-run league.</strong> Ex-college players are regulars. Fast pace, real scoring, real consequences for bad shots. Captains run it tight.",
  },
  Pro: {
    key: "Pro",
    body:
      "Pro-am or invite-only run. Pros and former pros only. Rare and hard to get into — typically gated by referral or league commissioner approval.",
    bodyHtml:
      "<strong>Pro-am or invite-only run.</strong> Pros and former pros only. <strong>Rare and hard to get into</strong> — typically gated by referral or league commissioner approval.",
  },
};

/** Tier dot color ramp — single-accent intensity scale. */
export const DOT_COLORS: Record<GradeKey, string> = {
  "Not Rated": "#3a3a3a",
  Novice: "#5a5a5a",
  Intermediate: "#9a9a9a",
  Advanced: "#d4d4d4",
  "Game Changer": "#E87722",
  Pro: "#E87722",
};

export const PRO_GLOW = "0 0 0 3px rgba(232,119,34,.25)";

export function gradesFor(ctx: RatingContext): Record<GradeKey, GradeDef> {
  return ctx === "player" ? PLAYER_GRADES : LEAGUE_GRADES;
}
