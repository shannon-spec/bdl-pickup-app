#!/usr/bin/env node
/**
 * Add Whoop HR-zone duration columns to whoop_workouts. Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-whoop-zones.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

for (const z of [0, 1, 2, 3, 4, 5]) {
  await sql.query(
    `ALTER TABLE whoop_workouts ADD COLUMN IF NOT EXISTS zone${z}_sec integer`,
  );
}

console.log("✓ whoop_workouts.zone0_sec…zone5_sec ready.");
