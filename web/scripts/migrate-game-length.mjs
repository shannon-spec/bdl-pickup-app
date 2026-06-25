#!/usr/bin/env node
/**
 * Add games.game_length_minutes (scheduled regulation clock, in minutes).
 * Idempotent — safe to re-run.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-game-length.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS game_length_minutes integer`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM games`;
console.log(`✓ games.game_length_minutes ensured (${count} games)`);
