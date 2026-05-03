#!/usr/bin/env node
/**
 * Add whoop_cycles table + new columns on whoop_workouts (end_date,
 * sport_name) needed for game/strain time-overlap matching. Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-whoop-cycles.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`ALTER TABLE whoop_workouts ADD COLUMN IF NOT EXISTS end_date timestamptz`;
await sql`ALTER TABLE whoop_workouts ADD COLUMN IF NOT EXISTS sport_name text`;

await sql`
  CREATE TABLE IF NOT EXISTS whoop_cycles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    whoop_cycle_id text NOT NULL,
    date date NOT NULL,
    cycle_start timestamptz,
    cycle_end timestamptz,
    day_strain real,
    avg_hr integer,
    max_hr integer,
    calories integer,
    synced_at timestamptz NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS whoop_cycles_player_cycle_uq
  ON whoop_cycles (player_id, whoop_cycle_id)
`;
// Earlier revisions of this script created a unique index on
// (player_id, date). Whoop emits multiple cycles per calendar day
// during sleep-schedule shifts, so the unique constraint blocked
// upserts. Drop it if present and replace with a non-unique index.
await sql`DROP INDEX IF EXISTS whoop_cycles_player_date_uq`;
await sql`
  CREATE INDEX IF NOT EXISTS whoop_cycles_player_date_idx
  ON whoop_cycles (player_id, date)
`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM whoop_cycles`;
console.log(`✓ whoop_cycles ready (${count} rows). whoop_workouts has end_date + sport_name.`);
