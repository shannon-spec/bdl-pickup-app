/**
 * One-shot smoke test — lists the 8 expected tables with row counts.
 * Run with: `npm run db:verify`
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const rows = await sql<{ table_name: string; row_count: string }[]>`
    SELECT
      table_name,
      (xpath('/row/c/text()',
             query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), true, true, '')))[1]::text AS row_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  if (rows.length === 0) {
    console.error("No tables found in the public schema.");
    process.exit(1);
  }
  console.log("Tables in public schema:");
  for (const r of rows) console.log(`  ${r.table_name.padEnd(28)} ${r.row_count} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
