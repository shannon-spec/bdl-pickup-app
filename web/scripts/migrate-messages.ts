/**
 * One-shot migration — create the conversations + messages tables for
 * 1:1 direct messages.
 *
 * Run with: `npm run db:migrate:messages`
 *
 * Idempotent. Safe to re-run.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("== conversations + messages ==\n");

  console.log("1/4 create conversations table…");
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      participant_a uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      participant_b uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      a_cleared_at timestamp with time zone,
      b_cleared_at timestamp with time zone,
      last_message_at timestamp with time zone NOT NULL DEFAULT now(),
      created_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS conversations_pair_uq
      ON conversations (participant_a, participant_b)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS conversations_a_last_idx
      ON conversations (participant_a, last_message_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS conversations_b_last_idx
      ON conversations (participant_b, last_message_at)
  `;

  console.log("2/4 create messages table…");
  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      body text NOT NULL,
      read_at timestamp with time zone,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS messages_convo_created_idx
      ON messages (conversation_id, created_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS messages_sender_idx
      ON messages (sender_id)
  `;

  console.log("3/4 sanity check pair canonicalization…");
  // Defensive — if any row was inserted with participantA > participantB
  // we'd have a parallel-thread bug. Flip them.
  const swapped = await sql`
    UPDATE conversations
    SET participant_a = participant_b, participant_b = participant_a
    WHERE participant_a > participant_b
    RETURNING id
  ` as { id: string }[];
  if (swapped.length > 0) {
    console.log(`   normalized ${swapped.length} rows`);
  }

  console.log("4/4 verify…");
  const tables = (await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN ('conversations', 'messages')
  `) as { tablename: string }[];
  console.log(`   tables present: ${tables.map((t) => t.tablename).join(", ")}`);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
