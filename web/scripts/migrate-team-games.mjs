#!/usr/bin/env node
/**
 * Extend games for team-vs-team play: team_a_id, team_b_id, game_type,
 * tournament_name. Idempotent — safe to re-run.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-team-games.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

// Enum (guarded — CREATE TYPE has no IF NOT EXISTS).
await sql`
  DO $$ BEGIN
    CREATE TYPE game_type AS ENUM ('league', 'exhibition', 'tournament');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$
`;

await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS team_a_id uuid REFERENCES teams(id) ON DELETE SET NULL`;
await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS team_b_id uuid REFERENCES teams(id) ON DELETE SET NULL`;
await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS game_type game_type NOT NULL DEFAULT 'league'`;
await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS tournament_name text`;
await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS tournament_round text`;
await sql`CREATE INDEX IF NOT EXISTS games_team_a_idx ON games(team_a_id)`;
await sql`CREATE INDEX IF NOT EXISTS games_team_b_idx ON games(team_b_id)`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM games`;
console.log(`✓ games.team_a_id/team_b_id/game_type/tournament_name ensured (${count} games)`);
