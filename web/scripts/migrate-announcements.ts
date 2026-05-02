/**
 * One-shot migration — create the announcements + announcement_recipients
 * tables for the v1 in-app inbox.
 *
 * Run with: `npm run db:migrate:announcements`
 *
 * Idempotent. Safe to re-run.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("== announcements + announcement_recipients ==\n");

  // 1. Enum
  console.log("1/6 create announcement_scope enum…");
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'announcement_scope') THEN
        CREATE TYPE announcement_scope AS ENUM ('global', 'league');
      END IF;
    END $$;
  `;

  // 2. announcements
  console.log("2/6 create announcements table…");
  await sql`
    CREATE TABLE IF NOT EXISTS announcements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      scope announcement_scope NOT NULL,
      league_id uuid REFERENCES leagues(id) ON DELETE CASCADE,
      author_id uuid REFERENCES players(id) ON DELETE SET NULL,
      headline text NOT NULL,
      body text NOT NULL,
      cta_label text,
      cta_url text,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `;

  // 3. announcement_recipients
  console.log("3/6 create announcement_recipients table…");
  await sql`
    CREATE TABLE IF NOT EXISTS announcement_recipients (
      announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      read_at timestamp with time zone,
      dismissed_at timestamp with time zone,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      PRIMARY KEY (announcement_id, player_id)
    )
  `;

  // 4. Indexes
  console.log("4/6 create announcement indexes…");
  await sql`CREATE INDEX IF NOT EXISTS announcements_league_created_idx ON announcements (league_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS announcements_author_created_idx ON announcements (author_id, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements (created_at)`;

  console.log("5/6 create recipient indexes…");
  await sql`
    CREATE INDEX IF NOT EXISTS announcement_recipients_player_read_idx
      ON announcement_recipients (player_id, read_at)
  `;

  // 6. Verify
  console.log("6/6 verify…");
  const tables = (await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN ('announcements', 'announcement_recipients')
  `) as { tablename: string }[];
  console.log(`   tables present: ${tables.map((t) => t.tablename).join(", ")}`);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
