#!/usr/bin/env node
/**
 * Join-request system (Phase 2 onboarding). Additive + idempotent.
 *   node --env-file=.env.local scripts/migrate-join-requests.mjs
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
    `DO $$ BEGIN CREATE TYPE join_request_status AS ENUM ('pending','accepted','denied','hold'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  );
  console.log("enum join_request_status ok");

  await sql`CREATE TABLE IF NOT EXISTS join_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    context_type context_type NOT NULL,
    context_id uuid NOT NULL,
    message text,
    status join_request_status NOT NULL DEFAULT 'pending',
    decided_by uuid REFERENCES players(id) ON DELETE SET NULL,
    decided_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS join_requests_ctx_idx ON join_requests(context_type, context_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS join_requests_player_idx ON join_requests(player_id)`;
  // One active (pending/hold) request per player + context.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS join_requests_active_uq
    ON join_requests(player_id, context_type, context_id)
    WHERE status IN ('pending','hold')`;
  console.log("table join_requests ok");

  console.log("\n✅ migrate-join-requests complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
