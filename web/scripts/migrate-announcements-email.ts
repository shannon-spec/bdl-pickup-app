/**
 * Phase-2 migration — add `channels` to announcements so email
 * broadcasts can layer on top of the in-app inbox.
 *
 * Run with: `npm run db:migrate:announcements:email`
 *
 * Idempotent. Safe to re-run.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("== announcements: add channels column ==\n");

  console.log("1/2 add channels text[] column…");
  await sql`
    ALTER TABLE announcements
      ADD COLUMN IF NOT EXISTS channels text[]
      NOT NULL DEFAULT ARRAY['inbox']::text[]
  `;

  console.log("2/2 verify…");
  const cols = (await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='announcements' AND column_name='channels'
  `) as { column_name: string; data_type: string }[];
  console.log(`   ${cols[0]?.column_name ?? "(missing!)"} ${cols[0]?.data_type ?? ""}`);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
