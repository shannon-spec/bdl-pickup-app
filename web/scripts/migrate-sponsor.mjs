#!/usr/bin/env node
/**
 * Player-sponsor referral on join requests. Additive + idempotent.
 *   node --env-file=.env.local scripts/migrate-sponsor.mjs
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("No DATABASE_URL(_UNPOOLED).");
  process.exit(1);
}
const sql = neon(conn);

async function main() {
  await sql.query(
    `DO $$ BEGIN CREATE TYPE sponsor_status AS ENUM ('pending','accepted','declined'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  );
  console.log("enum sponsor_status ok");

  // 'hold' added later — safe to re-run.
  await sql`ALTER TYPE sponsor_status ADD VALUE IF NOT EXISTS 'hold'`;

  await sql`ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS sponsor_player_id uuid REFERENCES players(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS sponsor_status sponsor_status`;
  // Sponsor's optional grade of the player (reuses player_level), shown to the commissioner.
  await sql`ALTER TABLE join_requests ADD COLUMN IF NOT EXISTS sponsor_grade player_level`;
  await sql`CREATE INDEX IF NOT EXISTS join_requests_sponsor_idx ON join_requests(sponsor_player_id, sponsor_status)`;
  console.log("join_requests sponsor columns ok");

  console.log("\n✅ migrate-sponsor complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
