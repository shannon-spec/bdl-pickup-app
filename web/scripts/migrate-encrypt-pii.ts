/**
 * One-shot migration — encrypt cell, email, and birthday for every
 * player row, and backfill `email_hash` for unique-email lookups.
 *
 * Run with: `npm run db:migrate:encrypt-pii`
 *
 * Idempotent. Safe to re-run — already-encrypted values (those with
 * the `v1:` prefix) are detected and skipped.
 *
 * REQUIREMENTS
 *   - ENCRYPTION_KEY env var must be set (32 random bytes, base64).
 *   - Generate with: openssl rand -base64 32
 *   - Set the SAME value in .env.local (for this script) and Vercel
 *     env (for the running app). Do NOT change it after a successful
 *     run — rotating requires a planned re-encryption pass.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { encrypt, emailHash, isCiphertext } from "../lib/crypto/secrets";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Sanity-check the key up front.
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error(
      "ENCRYPTION_KEY env var is required for this migration. See lib/crypto/secrets.ts.",
    );
  }
  // Force the helper to validate the key before we touch any data.
  encrypt("__probe__");

  console.log("== Encrypt PII (cell / email / birthday) ==\n");

  console.log("1/5 ensure email_hash column…");
  await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS email_hash text`;

  console.log("2/5 swap unique index from email -> email_hash…");
  await sql`DROP INDEX IF EXISTS players_email_uq`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS players_email_hash_uq
      ON players (email_hash)
      WHERE email_hash IS NOT NULL
  `;

  console.log("3/5 convert birthday column from date to text…");
  // ALTER TYPE is a no-op when the column is already text. The USING
  // cast handles the date→text conversion on first run.
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'players' AND column_name = 'birthday' AND data_type = 'date'
      ) THEN
        ALTER TABLE players ALTER COLUMN birthday TYPE text USING birthday::text;
      END IF;
    END $$;
  `;

  console.log("4/5 encrypt existing rows + populate email_hash…");
  const rows = (await sql`
    SELECT id, email, cell, birthday, email_hash FROM players
  `) as Array<{
    id: string;
    email: string | null;
    cell: string | null;
    birthday: string | null;
    email_hash: string | null;
  }>;

  let touched = 0;
  for (const r of rows) {
    const updates: Record<string, string | null> = {};

    if (r.email && !isCiphertext(r.email)) {
      // Plaintext email → encrypt and compute hash.
      updates.email = encrypt(r.email);
      updates.email_hash = emailHash(r.email);
    } else if (r.email && isCiphertext(r.email) && !r.email_hash) {
      // Already encrypted but hash missing — leave alone. Re-hashing
      // requires the plaintext, which is no longer available. This
      // branch shouldn't happen for the first run; flag if it does.
      console.warn(
        `  ! player ${r.id} has encrypted email but no hash — manual fix required`,
      );
    }

    if (r.cell && !isCiphertext(r.cell)) {
      updates.cell = encrypt(r.cell);
    }

    if (r.birthday && !isCiphertext(r.birthday)) {
      updates.birthday = encrypt(r.birthday);
    }

    if (Object.keys(updates).length === 0) continue;

    // Build the UPDATE in pieces depending on which fields changed.
    // sql tagged-template can't take dynamic SETs cleanly, so we use
    // explicit branches — there are at most 4 columns to consider.
    if ("email" in updates && "email_hash" in updates) {
      if ("cell" in updates && "birthday" in updates) {
        await sql`UPDATE players SET email=${updates.email}, email_hash=${updates.email_hash}, cell=${updates.cell}, birthday=${updates.birthday} WHERE id=${r.id}`;
      } else if ("cell" in updates) {
        await sql`UPDATE players SET email=${updates.email}, email_hash=${updates.email_hash}, cell=${updates.cell} WHERE id=${r.id}`;
      } else if ("birthday" in updates) {
        await sql`UPDATE players SET email=${updates.email}, email_hash=${updates.email_hash}, birthday=${updates.birthday} WHERE id=${r.id}`;
      } else {
        await sql`UPDATE players SET email=${updates.email}, email_hash=${updates.email_hash} WHERE id=${r.id}`;
      }
    } else if ("cell" in updates && "birthday" in updates) {
      await sql`UPDATE players SET cell=${updates.cell}, birthday=${updates.birthday} WHERE id=${r.id}`;
    } else if ("cell" in updates) {
      await sql`UPDATE players SET cell=${updates.cell} WHERE id=${r.id}`;
    } else if ("birthday" in updates) {
      await sql`UPDATE players SET birthday=${updates.birthday} WHERE id=${r.id}`;
    }
    touched++;
  }

  console.log(`   encrypted ${touched} players`);

  console.log("5/5 verify…");
  const counts = (await sql`
    SELECT
      count(*)::int FILTER (WHERE email IS NOT NULL AND email LIKE 'v1:%') AS enc_email,
      count(*)::int FILTER (WHERE email IS NOT NULL AND email NOT LIKE 'v1:%') AS plain_email,
      count(*)::int FILTER (WHERE cell IS NOT NULL AND cell LIKE 'v1:%') AS enc_cell,
      count(*)::int FILTER (WHERE cell IS NOT NULL AND cell NOT LIKE 'v1:%') AS plain_cell,
      count(*)::int FILTER (WHERE birthday IS NOT NULL AND birthday LIKE 'v1:%') AS enc_bday,
      count(*)::int FILTER (WHERE birthday IS NOT NULL AND birthday NOT LIKE 'v1:%') AS plain_bday,
      count(*)::int FILTER (WHERE email_hash IS NOT NULL) AS hashed
    FROM players
  `) as Array<{
    enc_email: number;
    plain_email: number;
    enc_cell: number;
    plain_cell: number;
    enc_bday: number;
    plain_bday: number;
    hashed: number;
  }>;
  const c = counts[0];
  console.log(`   email:    ${c.enc_email} encrypted · ${c.plain_email} plaintext`);
  console.log(`   cell:     ${c.enc_cell} encrypted · ${c.plain_cell} plaintext`);
  console.log(`   birthday: ${c.enc_bday} encrypted · ${c.plain_bday} plaintext`);
  console.log(`   email_hash rows: ${c.hashed}`);
  if (c.plain_email + c.plain_cell + c.plain_bday > 0) {
    console.warn(
      "   WARN: some plaintext rows remain. Re-run after investigating.",
    );
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
