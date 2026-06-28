#!/usr/bin/env node
/**
 * Join policy / visibility on contexts. Additive + idempotent.
 *   node --env-file=.env.local scripts/migrate-visibility.mjs
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
    `DO $$ BEGIN CREATE TYPE context_visibility AS ENUM ('OPEN','CLOSED','PRIVATE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  );
  console.log("enum context_visibility ok");

  for (const t of ["leagues", "teams", "tournaments", "communities"]) {
    await sql.query(
      `ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS visibility context_visibility NOT NULL DEFAULT 'OPEN'`,
    );
    console.log(`${t}.visibility ok`);
  }

  console.log("\n✅ migrate-visibility complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
