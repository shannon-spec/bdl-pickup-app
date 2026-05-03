#!/usr/bin/env node
/**
 * Add optional pin-override coordinates to leagues.venue. Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-league-venue-coords.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS venue_lat double precision`;
await sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS venue_lng double precision`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM leagues`;
console.log(`✓ leagues.venue_lat/venue_lng ensured (${count} rows)`);
