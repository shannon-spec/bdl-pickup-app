#!/usr/bin/env node
/**
 * Add whoop_workouts table + players.whoop_last_sync_at. Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-whoop-workouts.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`
  ALTER TABLE players
  ADD COLUMN IF NOT EXISTS whoop_last_sync_at timestamptz
`;

await sql`
  CREATE TABLE IF NOT EXISTS whoop_workouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    whoop_workout_id text NOT NULL,
    date timestamptz NOT NULL,
    duration_min integer,
    strain real,
    avg_hr integer,
    max_hr integer,
    calories integer,
    sport_id integer,
    synced_at timestamptz NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS whoop_workouts_player_workout_uq
  ON whoop_workouts (player_id, whoop_workout_id)
`;

await sql`
  CREATE INDEX IF NOT EXISTS whoop_workouts_player_date_idx
  ON whoop_workouts (player_id, date)
`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM whoop_workouts`;
console.log(`✓ whoop_workouts ensured (${count} rows)`);
