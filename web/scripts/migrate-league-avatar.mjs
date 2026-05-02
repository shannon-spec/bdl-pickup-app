#!/usr/bin/env node
/**
 * Add league avatar columns. Idempotent — run safely against any DB.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-league-avatar.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`
  ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS avatar_kind text NOT NULL DEFAULT 'monogram'
`;
await sql`
  ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS avatar_color text NOT NULL DEFAULT 'brand'
`;
await sql`
  ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS avatar_emoji text
`;

const [{ count }] = await sql`
  SELECT count(*)::int AS count FROM leagues
`;
console.log(`✓ leagues.avatar_kind/color/emoji ensured (${count} rows)`);
