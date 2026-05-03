#!/usr/bin/env node
/**
 * Add players.whoop_share_with_league. Defaults to false — every
 * player starts private and must opt in via player edit settings.
 * Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-whoop-share.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`
  ALTER TABLE players
  ADD COLUMN IF NOT EXISTS whoop_share_with_league boolean NOT NULL DEFAULT false
`;

const [{ count }] = await sql`
  SELECT count(*)::int AS count FROM players WHERE whoop_share_with_league = TRUE
`;
console.log(`✓ players.whoop_share_with_league ready (${count} opted-in).`);
