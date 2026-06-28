#!/usr/bin/env node
/**
 * Organize Console migration — additive only (new enums, tables, columns).
 * Idempotent: safe to re-run. No backfill, nothing existing is dropped.
 *
 * Run: node --env-file=.env.local scripts/migrate-organize.mjs
 *  or: npm run db:migrate:organize
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("No DATABASE_URL(_UNPOOLED) in env.");
  process.exit(1);
}
const sql = neon(conn);

async function enum_(name, values) {
  const vals = values.map((v) => `'${v}'`).join(",");
  await sql.query(
    `DO $$ BEGIN CREATE TYPE ${name} AS ENUM (${vals}); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  );
  console.log("enum", name, "ok");
}

async function main() {
  /* ---------- enums ---------- */
  await enum_("play_style", ["PICKUP_AUTOBALANCE", "FIXED_TEAMS"]);
  await enum_("tournament_format", [
    "SINGLE_ELIM",
    "DOUBLE_ELIM",
    "ROUND_ROBIN",
    "POOL_TO_BRACKET",
  ]);
  await enum_("registration_mode", ["OPEN", "INVITE"]);
  await enum_("registration_status", ["pending", "confirmed", "waitlist"]);
  await enum_("division_age_band", ["youth", "hs", "open", "o35", "custom"]);
  await enum_("organize_invitation_status", [
    "pending",
    "accepted",
    "revoked",
    "expired",
  ]);

  /* ---------- column additions (leagues) ---------- */
  await sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS play_style play_style`;
  await sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS season_length integer`;
  await sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES communities(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE leagues ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true`;
  console.log("leagues columns ok");

  /* ---------- column additions (tournaments) ---------- */
  await sql`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bracket_format tournament_format`;
  await sql`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS team_size text`;
  await sql`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_mode registration_mode NOT NULL DEFAULT 'OPEN'`;
  await sql`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS entry_fee_cents integer`;
  await sql`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS ends_at date`;
  await sql`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false`;
  console.log("tournaments columns ok");

  /* ---------- divisions (first-class) ---------- */
  await sql`CREATE TABLE IF NOT EXISTS divisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    context_type context_type NOT NULL,
    context_id uuid NOT NULL,
    name text NOT NULL,
    age_band division_age_band NOT NULL DEFAULT 'open',
    age_band_custom text,
    skill_tier player_level,
    cap integer,
    registration_open boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS divisions_context_idx ON divisions(context_type, context_id)`;
  console.log("divisions ok");

  /* ---------- registrations ---------- */
  await sql`CREATE TABLE IF NOT EXISTS registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id uuid NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
    player_id uuid REFERENCES players(id) ON DELETE SET NULL,
    team_name text,
    status registration_status NOT NULL DEFAULT 'pending',
    seed integer,
    paid boolean NOT NULL DEFAULT false,
    created_by uuid REFERENCES players(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS registrations_division_idx ON registrations(division_id)`;
  console.log("registrations ok");

  /* ---------- matches (bracket) ---------- */
  await sql`CREATE TABLE IF NOT EXISTS matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id uuid NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    round integer NOT NULL,
    slot integer NOT NULL,
    home_registration_id uuid REFERENCES registrations(id) ON DELETE SET NULL,
    away_registration_id uuid REFERENCES registrations(id) ON DELETE SET NULL,
    home_score integer,
    away_score integer,
    winner_registration_id uuid REFERENCES registrations(id) ON DELETE SET NULL,
    next_match_id uuid REFERENCES matches(id) ON DELETE SET NULL,
    next_slot_is_home boolean,
    locked boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS matches_division_idx ON matches(division_id)`;
  // double-elim: loser routing + which bracket the match belongs to
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS loser_next_match_id uuid REFERENCES matches(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS loser_next_slot_is_home boolean`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS bracket_group text`;
  console.log("matches ok");

  /* ---------- schedule_slots ---------- */
  await sql`CREATE TABLE IF NOT EXISTS schedule_slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    context_type context_type NOT NULL,
    context_id uuid NOT NULL,
    venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
    court text,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz,
    game_id uuid REFERENCES games(id) ON DELETE SET NULL,
    match_id uuid REFERENCES matches(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS schedule_slots_context_idx ON schedule_slots(context_type, context_id)`;
  console.log("schedule_slots ok");

  /* ---------- organize_invitations (co-organizer / role grants) ---------- */
  await sql`CREATE TABLE IF NOT EXISTS organize_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    context_type context_type NOT NULL,
    context_id uuid NOT NULL,
    role_granted membership_role NOT NULL,
    channel text NOT NULL,
    destination text,
    token varchar(64) NOT NULL UNIQUE,
    status organize_invitation_status NOT NULL DEFAULT 'pending',
    invited_by uuid REFERENCES players(id) ON DELETE SET NULL,
    accepted_by uuid REFERENCES players(id) ON DELETE SET NULL,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS organize_invitations_context_idx ON organize_invitations(context_type, context_id)`;
  console.log("organize_invitations ok");

  /* ---------- event_drafts (resumable wizard) ---------- */
  await sql`CREATE TABLE IF NOT EXISTS event_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    type context_type NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS event_drafts_creator_idx ON event_drafts(created_by)`;
  console.log("event_drafts ok");

  console.log("\n✅ migrate-organize complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
