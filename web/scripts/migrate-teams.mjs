#!/usr/bin/env node
/**
 * Create the travel-team tables: teams, team_players, team_commissioners.
 * Idempotent — safe to re-run.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-teams.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

// teams — mirrors the leagues avatar/soft-delete conventions. default_format
// reuses the existing game_format enum (form constrains to 5v5 / 3v3).
await sql`
  CREATE TABLE IF NOT EXISTS teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    city text,
    state text,
    description text,
    default_format game_format NOT NULL DEFAULT '5v5',
    avatar_kind text NOT NULL DEFAULT 'monogram',
    avatar_color text NOT NULL DEFAULT 'brand',
    avatar_emoji text,
    created_by uuid REFERENCES players(id) ON DELETE SET NULL,
    hidden_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS team_players (
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, player_id)
  )
`;
await sql`CREATE INDEX IF NOT EXISTS tp_player_idx ON team_players(player_id)`;

await sql`
  CREATE TABLE IF NOT EXISTS team_commissioners (
    team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, player_id)
  )
`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM teams`;
console.log(`✓ teams / team_players / team_commissioners ensured (${count} teams)`);
