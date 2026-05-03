#!/usr/bin/env node
/**
 * Add venue columns to leagues. Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-league-venue.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS venue_name text`;
await sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS venue_court text`;
await sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS venue_address text`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM leagues`;
console.log(`✓ leagues.venue_name/venue_court/venue_address ensured (${count} rows)`);
