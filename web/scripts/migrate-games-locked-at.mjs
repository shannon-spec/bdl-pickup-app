#!/usr/bin/env node
/**
 * Add games.locked_at and bootstrap it from updated_at for currently
 * locked games. Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-games-locked-at.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`ALTER TABLE games ADD COLUMN IF NOT EXISTS locked_at timestamptz`;

// Bootstrap: stamp updated_at on any game that is currently locked
// but has a null locked_at, so the auto-sync watermark check has a
// timestamp to compare against. Won't overwrite already-set values.
const stamped = await sql`
  UPDATE games
  SET locked_at = updated_at
  WHERE locked = TRUE AND locked_at IS NULL
  RETURNING id
`;

console.log(`✓ games.locked_at ready (bootstrapped ${stamped.length} locked rows).`);
