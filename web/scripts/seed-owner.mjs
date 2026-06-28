#!/usr/bin/env node
/**
 * Make a given email an OWNER (full access). Idempotent.
 * Matches the OTP login elevation (which is by email), so no player link or
 * ENCRYPTION_KEY is needed — the player auto-links on first sign-in.
 *   node --env-file=.env.local scripts/seed-owner.mjs shannon@d17.com [First] [Last]
 */
import { neon } from "@neondatabase/serverless";

const email = (process.argv[2] || "").trim().toLowerCase();
const first = process.argv[3] || "Shannon";
const last = process.argv[4] || "";
if (!email) {
  console.error("Usage: seed-owner.mjs <email> [first] [last]");
  process.exit(1);
}

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const sql = neon(conn);

async function main() {
  const [existing] = await sql`SELECT id, role FROM super_admins WHERE lower(email) = ${email} LIMIT 1`;
  if (existing) {
    await sql`UPDATE super_admins SET role = 'owner' WHERE id = ${existing.id}`;
    console.log("updated super_admin", existing.id, `(${existing.role} → owner)`);
  } else {
    const [row] = await sql`
      INSERT INTO super_admins (username, email, first_name, last_name, role)
      VALUES (${email}, ${email}, ${first}, ${last}, 'owner')
      RETURNING id`;
    console.log("created super_admin", row.id, "→ owner");
  }
  console.log(`\n✅ ${email} is OWNER. Sign in with the email code to get full access.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
