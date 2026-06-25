#!/usr/bin/env node
/**
 * League-side teams: an info override (league_team_meta) and a managed
 * regular roster (league_team_players) per league side. Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-league-teams.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`
  CREATE TABLE IF NOT EXISTS league_team_meta (
    league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    side text NOT NULL,
    name text,
    avatar_kind text,
    avatar_color text,
    avatar_emoji text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (league_id, side)
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS league_team_players (
    league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    side text NOT NULL,
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (league_id, side, player_id)
  )
`;
await sql`CREATE INDEX IF NOT EXISTS ltp_player_idx ON league_team_players(player_id)`;

console.log("✓ league_team_meta + league_team_players ensured");
