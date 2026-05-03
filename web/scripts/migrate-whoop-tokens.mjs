#!/usr/bin/env node
/**
 * Add the four Whoop OAuth columns on players that the schema
 * declares but were never migrated. Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-whoop-tokens.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS whoop_access_token text`;
await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS whoop_refresh_token text`;
await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS whoop_token_expiry timestamptz`;
await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS whoop_user_id text`;

const [{ count }] = await sql`SELECT count(*)::int AS count FROM players`;
console.log(`✓ players.whoop_* OAuth columns ensured (${count} rows)`);
