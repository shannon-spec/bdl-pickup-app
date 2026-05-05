#!/usr/bin/env node
/**
 * Add `hidden_at` to players and leagues — replaces destructive
 * delete with a soft-hide toggle. Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-hide-flags.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS hidden_at timestamptz`;
await sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS hidden_at timestamptz`;

console.log("✓ players.hidden_at + leagues.hidden_at ready.");
