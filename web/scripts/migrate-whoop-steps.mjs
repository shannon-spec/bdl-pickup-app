#!/usr/bin/env node
/**
 * Add whoop_cycles.steps. Idempotent. Existing rows get null until the
 * next sync re-pulls cycle data with score.steps populated.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-whoop-steps.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`ALTER TABLE whoop_cycles ADD COLUMN IF NOT EXISTS steps integer`;

console.log("✓ whoop_cycles.steps ready (re-sync to backfill values).");
