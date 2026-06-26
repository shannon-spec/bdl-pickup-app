#!/usr/bin/env node
/**
 * Multi-context entry layer: communities, tournaments, venues (+ member
 * tables), phone OTP storage, and players.phone_hash. Idempotent.
 *
 * Usage: `node --env-file=.env.local scripts/migrate-contexts.mjs`
 */
import { neon } from "@neondatabase/serverless";

const conn = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!conn) {
  console.error("DATABASE_URL[_UNPOOLED] not set. Use --env-file=.env.local.");
  process.exit(1);
}
const sql = neon(conn);

// Enums (guarded — CREATE TYPE has no IF NOT EXISTS).
await sql`DO $$ BEGIN
  CREATE TYPE context_type AS ENUM ('LEAGUE','TOURNAMENT','TEAM','COMMUNITY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
await sql`DO $$ BEGIN
  CREATE TYPE membership_role AS ENUM ('PLAYER','CAPTAIN','COACH','COMMISSIONER','DIRECTOR','MEMBER','FAN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
await sql`DO $$ BEGIN
  CREATE TYPE membership_status AS ENUM ('active','invited','inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS phone_hash text`;
await sql`CREATE INDEX IF NOT EXISTS players_phone_hash_idx ON players(phone_hash)`;

await sql`
  CREATE TABLE IF NOT EXISTS communities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text,
    kind text,
    description text,
    avatar_kind text NOT NULL DEFAULT 'monogram',
    avatar_color text NOT NULL DEFAULT 'brand',
    avatar_emoji text,
    created_by uuid REFERENCES players(id) ON DELETE SET NULL,
    hidden_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS communities_slug_uq ON communities(slug) WHERE slug IS NOT NULL`;

await sql`
  CREATE TABLE IF NOT EXISTS community_members (
    community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    role membership_role NOT NULL DEFAULT 'MEMBER',
    status membership_status NOT NULL DEFAULT 'active',
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (community_id, player_id)
  )`;
await sql`CREATE INDEX IF NOT EXISTS cm_player_idx ON community_members(player_id)`;

await sql`
  CREATE TABLE IF NOT EXISTS tournaments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text,
    community_id uuid REFERENCES communities(id) ON DELETE SET NULL,
    format game_format NOT NULL DEFAULT '5v5',
    start_date date,
    description text,
    avatar_kind text NOT NULL DEFAULT 'monogram',
    avatar_color text NOT NULL DEFAULT 'brand',
    avatar_emoji text,
    created_by uuid REFERENCES players(id) ON DELETE SET NULL,
    hidden_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS tournaments_slug_uq ON tournaments(slug) WHERE slug IS NOT NULL`;

await sql`
  CREATE TABLE IF NOT EXISTS tournament_members (
    tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    role membership_role NOT NULL DEFAULT 'PLAYER',
    status membership_status NOT NULL DEFAULT 'active',
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tournament_id, player_id)
  )`;
await sql`CREATE INDEX IF NOT EXISTS tm_player_idx ON tournament_members(player_id)`;

await sql`
  CREATE TABLE IF NOT EXISTS venues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    address text,
    lat double precision,
    lng double precision,
    created_by uuid REFERENCES players(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;

await sql`
  CREATE TABLE IF NOT EXISTS auth_otp (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_hash text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    consumed_at timestamptz,
    request_ip text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
await sql`CREATE INDEX IF NOT EXISTS auth_otp_phone_idx ON auth_otp(phone_hash)`;
await sql`CREATE INDEX IF NOT EXISTS auth_otp_created_idx ON auth_otp(created_at)`;

console.log("✓ contexts (communities/tournaments/venues/auth_otp) + players.phone_hash ensured");
