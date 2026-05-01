/**
 * One-shot migration — make players.email unique (partial, non-null).
 *
 * Phase 2 of the email-or-username login. With no current
 * duplicates in prod, the constraint can be added without any data
 * cleanup. Multiple null emails are still allowed (legacy imported
 * names that have no contact email yet).
 *
 * Run with: `npm run db:migrate:unique-email`
 *
 * Idempotent + safe to re-run. Verifies no duplicates exist before
 * touching indexes; aborts loudly if any are found so we don't
 * blow up the migration mid-flight.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("== players.email → unique partial index ==\n");

  // 1. Pre-flight — refuse to proceed if any duplicates exist.
  console.log("1/4 verifying no duplicate emails…");
  const dupes = (await sql`
    SELECT lower(email) AS email, count(*)::int AS n
    FROM players
    WHERE email IS NOT NULL
    GROUP BY lower(email)
    HAVING count(*) > 1
  `) as { email: string; n: number }[];
  if (dupes.length > 0) {
    console.error(`   Aborting: ${dupes.length} duplicate email(s) found:`);
    for (const r of dupes) console.error(`     ${r.email} (${r.n})`);
    console.error(
      "   Resolve duplicates first (merge accounts or null one) before re-running.",
    );
    process.exit(1);
  }
  console.log("   no duplicates");

  // 2. Drop the legacy non-unique index — its job is now covered
  //    by the new unique partial index, which is also a fast
  //    lookup index on email.
  console.log("2/4 drop legacy non-unique players_email_idx…");
  await sql`DROP INDEX IF EXISTS players_email_idx`;

  // 3. Create the new unique partial index. Postgres' default NULL
  //    handling already permits multiple NULLs in a UNIQUE index,
  //    but the partial WHERE makes the intent explicit and keeps
  //    the index smaller.
  console.log("3/4 create unique partial index players_email_uq…");
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS players_email_uq
      ON players (email)
      WHERE email IS NOT NULL
  `;

  // 4. Verify the index exists and is unique.
  console.log("4/4 verify…");
  const idx = (await sql`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'players' AND indexname = 'players_email_uq'
  `) as { indexname: string; indexdef: string }[];
  if (idx.length === 0) {
    console.error("   ! Index not found after creation — investigate.");
    process.exit(1);
  }
  console.log(`   ${idx[0].indexdef}`);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
