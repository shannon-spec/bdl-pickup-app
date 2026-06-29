#!/usr/bin/env node
/**
 * Add a 'TBD' value to the game_roster_side enum so players can be added to a
 * game roster before being slotted to a team. Additive + idempotent.
 *   node --env-file=.env.local scripts/migrate-roster-tbd.mjs
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
    `ALTER TYPE game_roster_side ADD VALUE IF NOT EXISTS 'TBD'`,
  );
  console.log("enum game_roster_side += 'TBD' ok");
  console.log("\n✅ migrate-roster-tbd complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
