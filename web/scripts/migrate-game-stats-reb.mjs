#!/usr/bin/env node
/**
 * Add offensive/defensive rebound columns to game_stats. Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-game-stats-reb.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS oreb integer`;
await sql`ALTER TABLE game_stats ADD COLUMN IF NOT EXISTS dreb integer`;

console.log("✓ game_stats.oreb/dreb ensured");
