#!/usr/bin/env node
/**
 * Per-player box-score stats for a game (game_stats). Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-game-stats.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`
  CREATE TABLE IF NOT EXISTS game_stats (
    game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    minutes integer,
    points integer,
    rebounds integer,
    assists integer,
    steals integer,
    blocks integer,
    turnovers integer,
    fouls integer,
    fgm integer,
    fga integer,
    tpm integer,
    tpa integer,
    ftm integer,
    fta integer,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (game_id, player_id)
  )
`;
await sql`CREATE INDEX IF NOT EXISTS game_stats_player_idx ON game_stats(player_id)`;

console.log("✓ game_stats ensured");
