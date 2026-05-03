#!/usr/bin/env node
/**
 * Add players.inbox_cleared_at and players.broadcasts_cleared_at —
 * per-viewer soft-clear watermarks for the Message Center. Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-message-clears.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS inbox_cleared_at timestamptz`;
await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS broadcasts_cleared_at timestamptz`;

console.log("✓ players.inbox_cleared_at + broadcasts_cleared_at ready.");
