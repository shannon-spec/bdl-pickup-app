/**
 * BDL database schema (Drizzle + Postgres).
 *
 * Mirrors the legacy localStorage shape so Phase 3 can translate
 * existing browser data into row inserts without re-modeling.
 *
 * Conventions:
 *   - UUID primary keys (uuid_generate_v4 via gen_random_uuid)
 *   - snake_case columns; camelCase TypeScript field names via Drizzle
 *   - createdAt / updatedAt on every entity
 *   - Junction tables for many-to-many (league ↔ player, game roster, etc.)
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  real,
  doublePrecision,
  boolean,
  timestamp,
  date,
  time,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ============== ENUMS ============== */

export const playerStatusEnum = pgEnum("player_status", [
  "Active",
  "Inactive",
  "IR",
]);

export const playerLevelEnum = pgEnum("player_level", [
  "Not Rated",
  "Novice",
  "Intermediate",
  "Advanced",
  "Game Changer",
  "Pro",
]);

export const gameFormatEnum = pgEnum("game_format", [
  "5v5",
  "5v5-series",
  "3v3",
  "3v3-series",
  "series",
]);

export const winTeamEnum = pgEnum("win_team", ["A", "B", "Tie"]);

// Distinguishes intra-league games from standalone team-vs-team games.
export const gameTypeEnum = pgEnum("game_type", [
  "league",
  "exhibition",
  "tournament",
]);

// Multi-context model: a Context is a League/Tournament/Team/Community, and a
// Membership ties a player to one with a contextual role. Roles live on the
// membership, never on the user.
export const contextTypeEnum = pgEnum("context_type", [
  "LEAGUE",
  "TOURNAMENT",
  "TEAM",
  "COMMUNITY",
]);
export const membershipRoleEnum = pgEnum("membership_role", [
  "PLAYER",
  "CAPTAIN",
  "COACH",
  "COMMISSIONER",
  "DIRECTOR",
  "MEMBER",
  "FAN",
]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "invited",
  "inactive",
]);

export const adminRoleEnum = pgEnum("admin_role", ["owner", "super_admin"]);

/* ----- Organize Console enums ----- */
export const playStyleEnum = pgEnum("play_style", [
  "PICKUP_AUTOBALANCE",
  "FIXED_TEAMS",
]);
export const tournamentFormatEnum = pgEnum("tournament_format", [
  "SINGLE_ELIM",
  "DOUBLE_ELIM",
  "ROUND_ROBIN",
  "POOL_TO_BRACKET",
]);
export const registrationModeEnum = pgEnum("registration_mode", [
  "OPEN",
  "INVITE",
]);
export const registrationStatusEnum = pgEnum("registration_status", [
  "pending",
  "confirmed",
  "waitlist",
]);
export const divisionAgeBandEnum = pgEnum("division_age_band", [
  "youth",
  "hs",
  "open",
  "o35",
  "custom",
]);
export const organizeInvitationStatusEnum = pgEnum(
  "organize_invitation_status",
  ["pending", "accepted", "revoked", "expired"],
);
export const joinRequestStatusEnum = pgEnum("join_request_status", [
  "pending",
  "accepted",
  "denied",
  "hold",
]);
export const contextVisibilityEnum = pgEnum("context_visibility", [
  "OPEN",
  "CLOSED",
  "PRIVATE",
]);
export const sponsorStatusEnum = pgEnum("sponsor_status", [
  "pending",
  "accepted",
  "declined",
  "hold",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "expired",
]);

// Game-level invite state machine, distinct from the league-level
// invite_status enum above.
export const gameInviteStateEnum = pgEnum("game_invite_state", [
  "queued",
  "pending",
  "confirmed",
  "declined",
  "expired",
  "cancelled",
  "superseded",
]);

export const gameInviteModeEnum = pgEnum("game_invite_mode", [
  "single",
  "group",
  "fcfs",
  "backfill",
]);

export const gameInviteAssignedTeamEnum = pgEnum(
  "game_invite_assigned_team",
  ["A", "B", "unassigned"],
);

/* ============== PLAYERS ============== */

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    /**
     * AES-256-GCM ciphertext (v1: prefix). Use `decryptOptional` from
     * lib/crypto/secrets when reading; `encryptOptional` when writing.
     * Plaintext rows pre-migration pass through transparently.
     */
    email: text("email"),
    /** Deterministic HMAC of the lowercased email — used for unique
     *  login lookup since the encrypted email column has random IVs. */
    emailHash: text("email_hash"),
    /** Encrypted (see email). Also the phone used for OTP sign-in. */
    cell: text("cell"),
    /** Deterministic HMAC of the normalized phone digits — used for OTP
     *  login lookup since `cell` is encrypted with random IVs. */
    phoneHash: text("phone_hash"),
    address: text("address"),
    city: text("city"),
    state: varchar("state", { length: 2 }),
    zip: text("zip"),
    college: text("college"),
    sport: text("sport"),
    position: text("position"),
    /** Encrypted ISO date string (YYYY-MM-DD). Was `date`; now `text`
     *  so we can store ciphertext. Decrypt with `decryptOptional`. */
    birthday: text("birthday"),
    heightFt: integer("height_ft"),
    heightIn: real("height_in"),
    heightNoShoes: boolean("height_no_shoes").notNull().default(false),
    weight: integer("weight"),
    level: playerLevelEnum("level").notNull().default("Not Rated"),
    highestLevel: text("highest_level"),
    status: playerStatusEnum("status").notNull().default("Active"),
    statusDate: date("status_date"),
    statusNote: text("status_note"),
    statusIndefinite: boolean("status_indefinite").notNull().default(false),
    injuryLocation: text("injury_location"),
    cellPrivate: boolean("cell_private").notNull().default(false),
    emailPrivate: boolean("email_private").notNull().default(false),
    addressPrivate: boolean("address_private").notNull().default(false),
    // Public-blob URL for the player's headshot. Null = render initials.
    avatarUrl: text("avatar_url"),
    // Optional player-side credentials. Players without these can only
    // be reached via invite link or admin impersonation. Username stored
    // lowercased for case-insensitive lookup.
    username: text("username"),
    passwordHash: text("password_hash"),
    // Whoop OAuth tokens — stored per-player so each user connects
    // their own Whoop account. Null = not connected.
    whoopAccessToken: text("whoop_access_token"),
    whoopRefreshToken: text("whoop_refresh_token"),
    whoopTokenExpiry: timestamp("whoop_token_expiry", { withTimezone: true }),
    whoopUserId: text("whoop_user_id"),
    // Most recent successful Whoop backfill — surfaced as "Last synced"
    // on the profile and used by Sync Now to compute incremental deltas.
    whoopLastSyncAt: timestamp("whoop_last_sync_at", { withTimezone: true }),
    // Player-controlled toggle for whether Whoop strain/HR data may
    // appear in league comparison products (leaderboards, head-to-head
    // intensity charts, etc.). Defaults to private; the player has to
    // opt in explicitly. The self-view always sees their own data
    // regardless of this flag.
    whoopShareWithLeague: boolean("whoop_share_with_league")
      .notNull()
      .default(false),
    // Per-viewer soft-clear watermarks for the Message Center. Setting
    // either timestamp hides every item older than it from THIS viewer's
    // list — mirrors `conversations.aClearedAt`/`bClearedAt`. Other
    // recipients are unaffected; no rows are deleted.
    inboxClearedAt: timestamp("inbox_cleared_at", { withTimezone: true }),
    broadcastsClearedAt: timestamp("broadcasts_cleared_at", { withTimezone: true }),
    /** Soft-hide flag — null = visible everywhere; non-null = hidden
     *  from list views. Replaces destructive deletes for players;
     *  destructive `deletePlayer` is intentionally blocked at the
     *  action layer. Player records (and their game history, scores,
     *  etc.) are preserved so historical data is never lost. */
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("players_last_first_idx").on(t.lastName, t.firstName),
    // Email uniqueness is enforced on the deterministic emailHash, not
    // the encrypted ciphertext (which has random IVs and can't be
    // queried by equality). Partial index so multiple null emails are
    // allowed (legacy / no-email accounts).
    uniqueIndex("players_email_hash_uq")
      .on(t.emailHash)
      .where(sql`email_hash IS NOT NULL`),
    uniqueIndex("players_username_idx").on(t.username),
    index("players_phone_hash_idx").on(t.phoneHash),
  ],
);

/* ============== LEAGUES ============== */

export const leagues = pgTable("leagues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  season: text("season"),
  description: text("description"),
  format: gameFormatEnum("format").notNull().default("5v5"),
  leagueType: text("league_type"),
  schedule: text("schedule"),
  location: text("location"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  startTime: time("start_time"),
  startTimeType: text("start_time_type"),
  // Days of week as int[] (0=Sun..6=Sat). Drizzle maps to Postgres int[].
  days: integer("days").array(),
  maxPlayers: integer("max_players"),
  // League grade — borrows the player level enum so a single rating
  // vocabulary covers both individuals and league-wide skill targets.
  level: playerLevelEnum("level").notNull().default("Not Rated"),
  // Series-format extras. Null for non-series formats.
  seriesGameCount: integer("series_game_count"),
  seriesPointTarget: integer("series_point_target"),
  // Race-to-N target for non-series pickup games (e.g. 150). Caps the
  // projected winner score in the matchup-odds prediction.
  playToScore: integer("play_to_score"),
  // League-level kill switch for projected scores + spreads on the
  // upcoming-game UI. Win-probability bar still renders.
  showProjections: boolean("show_projections").notNull().default(true),
  teamAName: text("team_a_name").notNull().default("White"),
  teamBName: text("team_b_name").notNull().default("Dark"),
  // Invite Manager defaults inherited by every game in this league.
  // Game-level overrides live on `games` and fall back to these.
  inviteExpiryMinutes: integer("invite_expiry_minutes")
    .notNull()
    .default(120),
  inviteFcfsEnabled: boolean("invite_fcfs_enabled").notNull().default(false),
  inviteOverInviteCap: integer("invite_over_invite_cap")
    .notNull()
    .default(2),
  inviteAutoBackfill: boolean("invite_auto_backfill").notNull().default(false),
  inviteReminderLeadMinutes: integer("invite_reminder_lead_minutes")
    .notNull()
    .default(15),
  // text[] subset of {sms,email,push}
  inviteAllowedChannels: text("invite_allowed_channels")
    .array()
    .notNull()
    .default(sql`ARRAY['email']::text[]`),
  // League avatar — Apple Contact-poster style. Kind toggles between
  // initials over a color and a single emoji. The color key indexes
  // a preset palette in components/bdl/league-avatar.tsx.
  avatarKind: text("avatar_kind").notNull().default("monogram"),
  avatarColor: text("avatar_color").notNull().default("brand"),
  avatarEmoji: text("avatar_emoji"),
  // Venue — surfaced on the league detail page with a Google Maps
  // embed when an address is set. Court lets you disambiguate when a
  // gym has multiple floors (e.g. "Court 2 — North side").
  // Coordinates are an optional override for venues with large
  // footprints (campuses, parks) where the address pin lands far from
  // the actual gym entrance.
  venueName: text("venue_name"),
  venueCourt: text("venue_court"),
  venueAddress: text("venue_address"),
  venueLat: doublePrecision("venue_lat"),
  venueLng: doublePrecision("venue_lng"),
  /* ----- Organize Console (league config + community ownership) ----- */
  playStyle: playStyleEnum("play_style"),
  seasonLength: integer("season_length"),
  communityId: uuid("community_id").references(() => communities.id, {
    onDelete: "set null",
  }),
  published: boolean("published").notNull().default(true),
  visibility: contextVisibilityEnum("visibility").notNull().default("OPEN"),
  /** Soft-hide flag — null = visible; non-null = hidden from list
   *  views. Replaces destructive deletes for leagues; destructive
   *  `deleteLeague` is intentionally blocked at the action layer.
   *  League data (games, rosters, scores) stays intact. */
  hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/* ============== JUNCTIONS: LEAGUE ↔ PLAYER ============== */

export const leaguePlayers = pgTable(
  "league_players",
  {
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    teamName: text("team_name"), // assigned team within this league
    leagueLevel: playerLevelEnum("league_level"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.leagueId, t.playerId] }),
    index("lp_player_idx").on(t.playerId),
  ],
);

export const leagueCommissioners = pgTable(
  "league_commissioners",
  {
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.leagueId, t.playerId] })],
);

/* ============== TEAMS (travel teams) ============== */

/**
 * Standalone travel team — a permanent team with its own roster that
 * plays games against OTHER teams over time (Exhibition or Tournament).
 * Mirrors the leagues avatar/soft-delete conventions; per-game format
 * can still override the team default.
 */
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city"),
  state: text("state"),
  description: text("description"),
  defaultFormat: gameFormatEnum("default_format").notNull().default("5v5"),
  visibility: contextVisibilityEnum("visibility").notNull().default("OPEN"),
  // Avatar — same Apple Contact-poster pattern as leagues.
  avatarKind: text("avatar_kind").notNull().default("monogram"),
  avatarColor: text("avatar_color").notNull().default("brand"),
  avatarEmoji: text("avatar_emoji"),
  createdBy: uuid("created_by").references(() => players.id, {
    onDelete: "set null",
  }),
  hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const teamPlayers = pgTable(
  "team_players",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.playerId] }),
    index("tp_player_idx").on(t.playerId),
  ],
);

export const teamCommissioners = pgTable(
  "team_commissioners",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.playerId] })],
);

/* ============== CONTEXTS: COMMUNITIES / TOURNAMENTS / VENUES ============== */

/* COMMUNITY = a frat/campus/gym/club org that can own leagues & tournaments. */
export const communities = pgTable(
  "communities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug"),
    kind: text("kind"), // frat | campus | gym | club | other
    visibility: contextVisibilityEnum("visibility").notNull().default("OPEN"),
    description: text("description"),
    avatarKind: text("avatar_kind").notNull().default("monogram"),
    avatarColor: text("avatar_color").notNull().default("brand"),
    avatarEmoji: text("avatar_emoji"),
    createdBy: uuid("created_by").references(() => players.id, {
      onDelete: "set null",
    }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("communities_slug_uq").on(t.slug).where(sql`slug IS NOT NULL`)],
);

export const communityMembers = pgTable(
  "community_members",
  {
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("MEMBER"),
    status: membershipStatusEnum("status").notNull().default("active"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.communityId, t.playerId] }),
    index("cm_player_idx").on(t.playerId),
  ],
);

export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug"),
    communityId: uuid("community_id").references(() => communities.id, {
      onDelete: "set null",
    }),
    format: gameFormatEnum("format").notNull().default("5v5"),
    /* ----- Organize Console (tournament config) ----- */
    bracketFormat: tournamentFormatEnum("bracket_format"),
    teamSize: text("team_size"),
    registrationMode: registrationModeEnum("registration_mode")
      .notNull()
      .default("OPEN"),
    entryFeeCents: integer("entry_fee_cents"),
    endsAt: date("ends_at"),
    published: boolean("published").notNull().default(false),
    visibility: contextVisibilityEnum("visibility").notNull().default("OPEN"),
    startDate: date("start_date"),
    description: text("description"),
    avatarKind: text("avatar_kind").notNull().default("monogram"),
    avatarColor: text("avatar_color").notNull().default("brand"),
    avatarEmoji: text("avatar_emoji"),
    createdBy: uuid("created_by").references(() => players.id, {
      onDelete: "set null",
    }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("tournaments_slug_uq").on(t.slug).where(sql`slug IS NOT NULL`)],
);

export const tournamentMembers = pgTable(
  "tournament_members",
  {
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("PLAYER"),
    status: membershipStatusEnum("status").notNull().default("active"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tournamentId, t.playerId] }),
    index("tm_player_idx").on(t.playerId),
  ],
);

/* Physical court/venue with geo — powers "meet here to play" + Discover. */
export const venues = pgTable("venues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  createdBy: uuid("created_by").references(() => players.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/* ============== ORGANIZE CONSOLE ============== */

/* First-class division on a league or tournament (age band + skill tier). */
export const divisions = pgTable(
  "divisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contextType: contextTypeEnum("context_type").notNull(),
    contextId: uuid("context_id").notNull(),
    name: text("name").notNull(),
    ageBand: divisionAgeBandEnum("age_band").notNull().default("open"),
    ageBandCustom: text("age_band_custom"),
    skillTier: playerLevelEnum("skill_tier"),
    cap: integer("cap"),
    registrationOpen: boolean("registration_open").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("divisions_context_idx").on(t.contextType, t.contextId)],
);

/* A team/individual entry into a division. */
export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    divisionId: uuid("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    playerId: uuid("player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    teamName: text("team_name"),
    status: registrationStatusEnum("status").notNull().default("pending"),
    seed: integer("seed"),
    paid: boolean("paid").notNull().default(false),
    createdBy: uuid("created_by").references(() => players.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("registrations_division_idx").on(t.divisionId)],
);

/* Bracket match. Entering a result advances the winner to next_match_id. */
export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    divisionId: uuid("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    slot: integer("slot").notNull(),
    homeRegistrationId: uuid("home_registration_id").references(
      () => registrations.id,
      { onDelete: "set null" },
    ),
    awayRegistrationId: uuid("away_registration_id").references(
      () => registrations.id,
      { onDelete: "set null" },
    ),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    winnerRegistrationId: uuid("winner_registration_id").references(
      () => registrations.id,
      { onDelete: "set null" },
    ),
    // Self-FK (handled in DB); left unreferenced here to avoid a circular type.
    nextMatchId: uuid("next_match_id"),
    nextSlotIsHome: boolean("next_slot_is_home"),
    // Double-elim: where the loser goes + which bracket this match is in.
    loserNextMatchId: uuid("loser_next_match_id"),
    loserNextSlotIsHome: boolean("loser_next_slot_is_home"),
    bracketGroup: text("bracket_group"), // 'W' | 'L' | 'GF' | null
    locked: boolean("locked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("matches_division_idx").on(t.divisionId)],
);

/* A court/time slot bound to a league game or a tournament match. */
export const scheduleSlots = pgTable(
  "schedule_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contextType: contextTypeEnum("context_type").notNull(),
    contextId: uuid("context_id").notNull(),
    venueId: uuid("venue_id").references(() => venues.id, {
      onDelete: "set null",
    }),
    court: text("court"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    gameId: uuid("game_id").references(() => games.id, { onDelete: "set null" }),
    matchId: uuid("match_id").references(() => matches.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("schedule_slots_context_idx").on(t.contextType, t.contextId)],
);

/* Co-organizer / role-grant invite for a context. */
export const organizeInvitations = pgTable(
  "organize_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contextType: contextTypeEnum("context_type").notNull(),
    contextId: uuid("context_id").notNull(),
    roleGranted: membershipRoleEnum("role_granted").notNull(),
    channel: text("channel").notNull(), // phone | email | link
    destination: text("destination"),
    token: varchar("token", { length: 64 }).notNull(),
    status: organizeInvitationStatusEnum("status").notNull().default("pending"),
    invitedBy: uuid("invited_by").references(() => players.id, {
      onDelete: "set null",
    }),
    acceptedBy: uuid("accepted_by").references(() => players.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("organize_invitations_token_uq").on(t.token),
    index("organize_invitations_context_idx").on(t.contextType, t.contextId),
  ],
);

/* Resumable create-wizard draft. */
export const eventDrafts = pgTable(
  "event_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    type: contextTypeEnum("type").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("event_drafts_creator_idx").on(t.createdBy)],
);

export type Division = typeof divisions.$inferSelect;
export type Registration = typeof registrations.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type ScheduleSlot = typeof scheduleSlots.$inferSelect;
export type OrganizeInvitation = typeof organizeInvitations.$inferSelect;
export type EventDraft = typeof eventDrafts.$inferSelect;

/* Player → league/team join request (Phase 2 onboarding queue). */
export const joinRequests = pgTable(
  "join_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    contextType: contextTypeEnum("context_type").notNull(),
    contextId: uuid("context_id").notNull(),
    message: text("message"),
    status: joinRequestStatusEnum("status").notNull().default("pending"),
    sponsorPlayerId: uuid("sponsor_player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    sponsorStatus: sponsorStatusEnum("sponsor_status"),
    sponsorGrade: playerLevelEnum("sponsor_grade"),
    decidedBy: uuid("decided_by").references(() => players.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("join_requests_ctx_idx").on(t.contextType, t.contextId, t.status),
    index("join_requests_player_idx").on(t.playerId),
  ],
);
export type JoinRequest = typeof joinRequests.$inferSelect;

/* Short-lived phone OTP codes for passwordless sign-in. */
export const authOtp = pgTable(
  "auth_otp",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phoneHash: text("phone_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    requestIp: text("request_ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("auth_otp_phone_idx").on(t.phoneHash),
    index("auth_otp_created_idx").on(t.createdAt),
  ],
);

export type Community = typeof communities.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type Venue = typeof venues.$inferSelect;

/* A league's named side (e.g. CPA League's "White") treated as a persistent
 * team: an optional info override + a managed "regular roster". Keyed by
 * (leagueId, side) where side is "A" / "B". */
export const leagueTeamMeta = pgTable(
  "league_team_meta",
  {
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    side: text("side").notNull(),
    name: text("name"),
    avatarKind: text("avatar_kind"),
    avatarColor: text("avatar_color"),
    avatarEmoji: text("avatar_emoji"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.leagueId, t.side] })],
);

export const leagueTeamPlayers = pgTable(
  "league_team_players",
  {
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    side: text("side").notNull(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.leagueId, t.side, t.playerId] }),
    index("ltp_player_idx").on(t.playerId),
  ],
);

/* ============== GAMES ============== */

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id").references(() => leagues.id, { onDelete: "set null" }),
    leagueName: text("league_name"),
    // Team-vs-team play. When set, leagueId is null and the two sides are
    // these teams (side A = teamA roster, side B = teamB roster).
    teamAId: uuid("team_a_id").references(() => teams.id, { onDelete: "set null" }),
    teamBId: uuid("team_b_id").references(() => teams.id, { onDelete: "set null" }),
    gameType: gameTypeEnum("game_type").notNull().default("league"),
    tournamentName: text("tournament_name"),
    tournamentRound: text("tournament_round"),
    gameDate: date("game_date"),
    gameTime: time("game_time"),
    venue: text("venue"),
    format: gameFormatEnum("format").notNull().default("5v5"),
    /** Scheduled game length in minutes (regulation clock). Null = unset. */
    gameLengthMinutes: integer("game_length_minutes"),
    teamAName: text("team_a_name").notNull().default("White"),
    teamBName: text("team_b_name").notNull().default("Dark"),
    scoreA: integer("score_a"),
    scoreB: integer("score_b"),
    winTeam: winTeamEnum("win_team"),
    gameWinner: uuid("game_winner").references(() => players.id, { onDelete: "set null" }),
    locked: boolean("locked").notNull().default(false),
    /** When this game most recently transitioned to locked. Drives the
     *  Whoop auto-sync — when a game locks, we wait 15 min for Whoop
     *  to finish processing the session, then backfill on the next
     *  profile visit. Null when the game has never been locked or has
     *  been unlocked since. */
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    autoScheduled: boolean("auto_scheduled").notNull().default(false),
    numInvites: integer("num_invites").notNull().default(10),
    seriesId: uuid("series_id"),
    seriesBestOf: integer("series_best_of"),
    // Invite Manager per-game overrides. NULL = inherit from league.
    targetSeats: integer("target_seats"),
    inviteExpiryMinutes: integer("invite_expiry_minutes"),
    inviteFcfsEnabled: boolean("invite_fcfs_enabled"),
    inviteOverInviteCap: integer("invite_over_invite_cap"),
    inviteAutoBackfill: boolean("invite_auto_backfill"),
    inviteReminderLeadMinutes: integer("invite_reminder_lead_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("games_league_date_idx").on(t.leagueId, t.gameDate),
    index("games_date_idx").on(t.gameDate),
    index("games_series_idx").on(t.seriesId),
  ],
);

/* ============== PLAYER GRADES (peer rating) ============== */

// One vote per (target, voter, league). Grades are per-league so a
// player can carry different grades in each league they're in (e.g.
// Game Changer in their home league, Intermediate in a stronger one).
//
// Voter must share THIS league with the target — enforced in the
// server action. The voter's bucket (peer vs commissioner) is derived
// at read time from league_commissioners scoped to this same league,
// so a commissioner of league A casting a vote in league B counts as
// a peer there.
// "Not Rated" is excluded from voting in the action validator.
export const playerGrades = pgTable(
  "player_grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetPlayerId: uuid("target_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    voterPlayerId: uuid("voter_player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    grade: playerLevelEnum("grade").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("player_grades_target_voter_league_uq").on(
      t.targetPlayerId,
      t.voterPlayerId,
      t.leagueId,
    ),
    index("player_grades_target_league_idx").on(t.targetPlayerId, t.leagueId),
  ],
);

/* ============== GAME INVITES (Invite Manager) ============== */

// Groups invites that were sent together (Single/Group/FCFS/Backfill).
// Useful for analytics and the activity feed.
export const gameInviteBatches = pgTable(
  "game_invite_batches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    mode: gameInviteModeEnum("mode").notNull(),
    createdBy: uuid("created_by").references(() => players.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("game_invite_batches_game_idx").on(t.gameId)],
);

// One row per (game, player, attempt). Resends mark the prior row as
// `superseded` and create a new row with a fresh claim_token.
export const gameInvites = pgTable(
  "game_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id").references(() => gameInviteBatches.id, {
      onDelete: "set null",
    }),
    mode: gameInviteModeEnum("mode").notNull(),
    state: gameInviteStateEnum("state").notNull().default("queued"),
    // text[] subset of {sms,email,push}
    channels: text("channels")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    assignedTeam: gameInviteAssignedTeamEnum("assigned_team")
      .notNull()
      .default("unassigned"),
    claimToken: varchar("claim_token", { length: 64 }).notNull().unique(),
    extendedCount: integer("extended_count").notNull().default(0),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => players.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("game_invites_game_state_idx").on(t.gameId, t.state),
    index("game_invites_state_expires_idx").on(t.state, t.expiresAt),
    index("game_invites_player_created_idx").on(t.playerId, t.createdAt),
  ],
);

// Append-only event log per invite (state changes, deliveries,
// commissioner actions). Drives the activity feed and audit log.
export const gameInviteEvents = pgTable(
  "game_invite_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inviteId: uuid("invite_id")
      .notNull()
      .references(() => gameInvites.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    actorId: uuid("actor_id").references(() => players.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("game_invite_events_game_idx").on(t.gameId, t.createdAt),
    index("game_invite_events_invite_idx").on(t.inviteId, t.createdAt),
  ],
);

/* ============== GAME SUBGAMES (series format) ============== */

// One row per individual game inside a series night. The parent
// `games` row stores the series tally (scoreA = side A's win count,
// scoreB = side B's win count, winTeam = whoever has more).
export const gameSubgames = pgTable(
  "game_subgames",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    gameIndex: integer("game_index").notNull(),
    scoreA: integer("score_a"),
    scoreB: integer("score_b"),
    winTeam: winTeamEnum("win_team"),
  },
  (t) => [
    index("game_subgames_game_idx").on(t.gameId, t.gameIndex),
  ],
);

/* ============== JUNCTIONS: GAME ROSTER + INVITES ============== */

// Single roster table with a `side` column instead of 3 separate tables.
export const gameRosterSideEnum = pgEnum("game_roster_side", [
  "A",
  "B",
  "TBD",
  "invited",
]);

export const gameRoster = pgTable(
  "game_roster",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    side: gameRosterSideEnum("side").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.playerId] }),
    index("game_roster_player_idx").on(t.playerId),
    index("game_roster_side_idx").on(t.gameId, t.side),
  ],
);

/* Per-player box-score stats for a game. One row per (game, player). All
 * counting fields are nullable so a partial line can be saved. */
export const gameStats = pgTable(
  "game_stats",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    minutes: integer("minutes"),
    points: integer("points"),
    rebounds: integer("rebounds"),
    oreb: integer("oreb"),
    dreb: integer("dreb"),
    assists: integer("assists"),
    steals: integer("steals"),
    blocks: integer("blocks"),
    turnovers: integer("turnovers"),
    fouls: integer("fouls"),
    fgm: integer("fgm"),
    fga: integer("fga"),
    tpm: integer("tpm"),
    tpa: integer("tpa"),
    ftm: integer("ftm"),
    fta: integer("fta"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.playerId] }),
    index("game_stats_player_idx").on(t.playerId),
  ],
);

export type GameStat = typeof gameStats.$inferSelect;

/* ============== SUPER ADMINS ============== */

export const superAdmins = pgTable("super_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: adminRoleEnum("role").notNull().default("super_admin"),
  // Optional link to a roster player (one player can be linked to many usernames)
  playerId: uuid("player_id").references(() => players.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ============== INVITES ============== */

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id").references(() => leagues.id, { onDelete: "cascade" }),
    leagueName: text("league_name"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    cell: text("cell"),
    invitedBy: uuid("invited_by").references(() => players.id, { onDelete: "set null" }),
    status: inviteStatusEnum("status").notNull().default("pending"),
    playerId: uuid("player_id").references(() => players.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invites_status_idx").on(t.status),
    index("invites_league_idx").on(t.leagueId),
  ],
);

/* ============== ANNOUNCEMENTS (in-app inbox) ============== */

export const announcementScopeEnum = pgEnum("announcement_scope", [
  "global",
  "league",
]);

// Authored by an admin or commissioner. Scope = global → fans out to
// every player; scope = league → fans out to that league's members
// (leagueId required). Channels beyond the in-app inbox (email, push,
// SMS) will layer on later — for v1 inbox is implicit.
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: announcementScopeEnum("scope").notNull(),
    leagueId: uuid("league_id").references(() => leagues.id, {
      onDelete: "cascade",
    }),
    authorId: uuid("author_id").references(() => players.id, {
      onDelete: "set null",
    }),
    headline: text("headline").notNull(),
    body: text("body").notNull(),
    ctaLabel: text("cta_label"),
    ctaUrl: text("cta_url"),
    // text[] subset of {inbox,email}. 'inbox' is implicit and always
    // included (an announcement without an inbox row would be invisible
    // post-send). Adding 'email' triggers a Resend broadcast at create
    // time; future channels (push, sms) plug in here.
    channels: text("channels")
      .array()
      .notNull()
      .default(sql`ARRAY['inbox']::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("announcements_league_created_idx").on(t.leagueId, t.createdAt),
    index("announcements_author_created_idx").on(t.authorId, t.createdAt),
    index("announcements_created_idx").on(t.createdAt),
  ],
);

// One row per (announcement, player) — the fan-out from a single
// announcement to its audience. Read state is per-recipient so the
// inbox can render unread counts and the badge.
export const announcementRecipients = pgTable(
  "announcement_recipients",
  {
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.announcementId, t.playerId] }),
    index("announcement_recipients_player_read_idx").on(t.playerId, t.readAt),
  ],
);

/* ============== DIRECT MESSAGES (1:1) ============== */

// One row per ordered pair of participants. We canonicalize by storing
// the lower UUID in `participantA` and the higher in `participantB` so
// that `(A, B)` is always unique regardless of who sent the first
// message — prevents two parallel threads between the same two people.
//
// `aClearedAt` / `bClearedAt` are per-viewer soft-clears. Setting one
// hides the conversation from THAT viewer's list and trims their
// thread view to messages newer than the cleared timestamp. Other
// participant is unaffected — no destructive deletes.
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantA: uuid("participant_a")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    participantB: uuid("participant_b")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    aClearedAt: timestamp("a_cleared_at", { withTimezone: true }),
    bClearedAt: timestamp("b_cleared_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("conversations_pair_uq").on(t.participantA, t.participantB),
    index("conversations_a_last_idx").on(t.participantA, t.lastMessageAt),
    index("conversations_b_last_idx").on(t.participantB, t.lastMessageAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("messages_convo_created_idx").on(t.conversationId, t.createdAt),
    index("messages_sender_idx").on(t.senderId),
  ],
);

/* ============== PASSWORD RESET TOKENS ============== */

// One-shot reset tokens emailed to players when they hit Forgot
// Password. Single-use (usedAt set on consumption), 30-min TTL.
// Cascades on player delete so we never orphan a stale token.
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    token: varchar("token", { length: 64 }).primaryKey(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("password_reset_player_idx").on(t.playerId)],
);

/* ============== WHOOP WORKOUTS ============== */

/**
 * Whoop workout records pulled via the Whoop developer API. We pull
 * every workout (not just basketball) because BDL pairs strain to its
 * own scheduled games by time-overlap, not by Whoop's sport tag —
 * users frequently fail to label sessions in the Whoop app, and the
 * scheduled BDL game window is the source of truth.
 *
 * Backfilled on first connect, then topped up by Sync Now. Idempotent
 * on (player_id, whoop_workout_id) so re-syncing is safe.
 */
export const whoopWorkouts = pgTable(
  "whoop_workouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    /** Whoop's own workout ID. V2 returns a UUID string. */
    whoopWorkoutId: text("whoop_workout_id").notNull(),
    /** Workout start timestamp from Whoop. */
    date: timestamp("date", { withTimezone: true }).notNull(),
    /** Workout end timestamp — used for time-overlap matching against
     *  scheduled BDL games. */
    endDate: timestamp("end_date", { withTimezone: true }),
    durationMin: integer("duration_min"),
    /** Whoop strain (0–21). Stored 1 decimal. */
    strain: real("strain"),
    avgHr: integer("avg_hr"),
    maxHr: integer("max_hr"),
    /** Calories computed from kilojoules at fetch time. */
    calories: integer("calories"),
    sportId: integer("sport_id"),
    sportName: text("sport_name"),
    /** Heart-rate zone durations in seconds. Whoop returns ms but we
     *  downscale to keep the integers small. Zones 0–5 map to
     *  Whoop's intensity bands (zone 0 ≈ <50% max HR, zone 5 ≈
     *  90%+). The sum across zones equals the workout duration. */
    zone0Sec: integer("zone0_sec"),
    zone1Sec: integer("zone1_sec"),
    zone2Sec: integer("zone2_sec"),
    zone3Sec: integer("zone3_sec"),
    zone4Sec: integer("zone4_sec"),
    zone5Sec: integer("zone5_sec"),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("whoop_workouts_player_workout_uq").on(
      t.playerId,
      t.whoopWorkoutId,
    ),
    index("whoop_workouts_player_date_idx").on(t.playerId, t.date),
  ],
);

/**
 * Whoop daily cycles. One row per (player, calendar day). Captures
 * "day strain" — the whole-day strain Whoop computes from heart-rate
 * elevation across all activity. Used as a fallback when no workout
 * record overlaps a scheduled BDL game.
 */
export const whoopCycles = pgTable(
  "whoop_cycles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    /** Whoop's cycle id. */
    whoopCycleId: text("whoop_cycle_id").notNull(),
    /** Calendar date the cycle ends on, in the cycle's local timezone.
     *  This is what BDL game dates align with. */
    date: date("date").notNull(),
    /** Cycle window — used if we ever need finer-grained matching. */
    cycleStart: timestamp("cycle_start", { withTimezone: true }),
    cycleEnd: timestamp("cycle_end", { withTimezone: true }),
    dayStrain: real("day_strain"),
    avgHr: integer("avg_hr"),
    maxHr: integer("max_hr"),
    calories: integer("calories"),
    /** Total steps for the calendar day as reported by Whoop's cycles
     *  endpoint (requires read:cycles scope). Null when the API didn't
     *  return a steps value for the cycle. */
    steps: integer("steps"),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("whoop_cycles_player_cycle_uq").on(
      t.playerId,
      t.whoopCycleId,
    ),
    // Non-unique: Whoop can emit multiple cycles per calendar day when
    // a sleep schedule shifts. Date is queried frequently by the
    // game-pairing join so we still want it indexed.
    index("whoop_cycles_player_date_idx").on(t.playerId, t.date),
  ],
);

/* ============== TRAINING (personal, gamified) ============== */

/** One row per player: cumulative XP for the Training feature. Level and
 *  tier are derived from `xp` in TS (lib/training/engine.ts), not stored.
 *  `streakFreezes` is a launch hook (unused at v0.1). */
export const trainingProfile = pgTable("training_profile", {
  playerId: uuid("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  xp: integer("xp").notNull().default(0),
  streakFreezes: integer("streak_freezes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** The player's training "cart": one row per exercise they've added,
 *  carrying its goals plus the gamified per-exercise state — streaks,
 *  best set, lifetime reps, and the current Mon–Sun week's per-day log
 *  flags. Date dedup columns keep one-time XP awards idempotent. */
export const trainingUserExercise = pgTable(
  "training_user_exercise",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    /** Exercise slug from the code catalog (lib/training/catalog.ts),
     *  e.g. "pushups" | "bench". Text, not a pgEnum, so new exercises
     *  drop in without a migration. */
    exerciseSlug: text("exercise_slug").notNull(),
    /** Current daily rep goal. Starts at baseRepGoal and steps up by
     *  weeklyIncrement after each completed week (weekly-step exercises). */
    repGoal: integer("rep_goal").notNull(),
    weightGoal: integer("weight_goal"),
    /** Player-set baseline (starting) daily goal. */
    baseRepGoal: integer("base_rep_goal").notNull().default(50),
    /** Player-set weekly step applied to repGoal after a completed week. */
    weeklyIncrement: integer("weekly_increment").notNull().default(0),
    /** Player-set days per Mon–Sun week required to complete it. */
    weeklyDayTarget: integer("weekly_day_target").notNull().default(5),
    /** Monday (YYYY-MM-DD) of the week `daysLoggedThisWeek` describes. */
    weekStart: date("week_start"),
    /** 7 flags, index 0 = Monday .. 6 = Sunday; 1 = logged that day. */
    daysLoggedThisWeek: integer("days_logged_this_week").array(),
    currentStreakWeeks: integer("current_streak_weeks").notNull().default(0),
    bestStreakWeeks: integer("best_streak_weeks").notNull().default(0),
    lifetimeReps: integer("lifetime_reps").notNull().default(0),
    bestSetReps: integer("best_set_reps"),
    bestSetWeight: integer("best_set_weight"),
    /** Dedup keys so once-per-day / once-per-week XP fires once: the days
     *  we last paid the log/rep-goal/PR bonuses, and the week we paid the
     *  weekly-consistency bonus. */
    lastLoggedDay: date("last_logged_day"),
    repGoalDay: date("rep_goal_day"),
    prDay: date("pr_day"),
    weeklyGoalHitWeek: date("weekly_goal_hit_week"),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.exerciseSlug] })],
);

/** Append-only log of individual sets. Powers weekly-volume charts and
 *  the days-logged heatmap on the Stats screen. */
export const trainingSets = pgTable(
  "training_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    exerciseSlug: text("exercise_slug").notNull(),
    reps: integer("reps").notNull(),
    /** Null for bodyweight exercises. */
    weight: integer("weight"),
    /** Local calendar day the set counts toward (YYYY-MM-DD). */
    performedDay: date("performed_day").notNull(),
    performedAt: timestamp("performed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("training_sets_player_ex_day_idx").on(
      t.playerId,
      t.exerciseSlug,
      t.performedDay,
    ),
  ],
);

/** Unlocked trophies — permanent, one row per (player, trophy). */
export const trainingTrophies = pgTable(
  "training_trophies",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    trophyId: text("trophy_id").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.trophyId] })],
);

/** Per-week completion record — one row per (player, exercise, week).
 *  The current week's row is upserted on each log; it's frozen once the
 *  week rolls over. Lets the Stats "weekly goal" chips stay accurate even
 *  as the daily goal progresses (past weeks' goals aren't otherwise kept). */
export const trainingWeekResults = pgTable(
  "training_week_results",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    exerciseSlug: text("exercise_slug").notNull(),
    weekStart: date("week_start").notNull(),
    /** Days that met this exercise's weekly qualifier that week. */
    qualifyingDays: integer("qualifying_days").notNull().default(0),
    dayTarget: integer("day_target").notNull(),
    dailyGoal: integer("daily_goal").notNull(),
    completed: boolean("completed").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.playerId, t.exerciseSlug, t.weekStart] }),
  ],
);

/* ============== RELATIONS ============== */

export const playersRelations = relations(players, ({ many }) => ({
  leagues: many(leaguePlayers),
  commissionerOf: many(leagueCommissioners),
  gameRosterEntries: many(gameRoster),
  superAdminLinks: many(superAdmins),
  invitesSent: many(invites, { relationName: "invitedBy" }),
}));

export const leaguesRelations = relations(leagues, ({ many }) => ({
  players: many(leaguePlayers),
  commissioners: many(leagueCommissioners),
  games: many(games),
  invites: many(invites),
}));

export const leaguePlayersRelations = relations(leaguePlayers, ({ one }) => ({
  league: one(leagues, { fields: [leaguePlayers.leagueId], references: [leagues.id] }),
  player: one(players, { fields: [leaguePlayers.playerId], references: [players.id] }),
}));

export const leagueCommissionersRelations = relations(
  leagueCommissioners,
  ({ one }) => ({
    league: one(leagues, {
      fields: [leagueCommissioners.leagueId],
      references: [leagues.id],
    }),
    player: one(players, {
      fields: [leagueCommissioners.playerId],
      references: [players.id],
    }),
  }),
);

export const gamesRelations = relations(games, ({ one, many }) => ({
  league: one(leagues, { fields: [games.leagueId], references: [leagues.id] }),
  winnerPlayer: one(players, {
    fields: [games.gameWinner],
    references: [players.id],
  }),
  roster: many(gameRoster),
}));

export const gameRosterRelations = relations(gameRoster, ({ one }) => ({
  game: one(games, { fields: [gameRoster.gameId], references: [games.id] }),
  player: one(players, { fields: [gameRoster.playerId], references: [players.id] }),
}));

export const superAdminsRelations = relations(superAdmins, ({ one }) => ({
  player: one(players, {
    fields: [superAdmins.playerId],
    references: [players.id],
  }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  league: one(leagues, { fields: [invites.leagueId], references: [leagues.id] }),
  player: one(players, { fields: [invites.playerId], references: [players.id] }),
  inviter: one(players, {
    fields: [invites.invitedBy],
    references: [players.id],
    relationName: "invitedBy",
  }),
}));

/* ============== INFERRED TYPES ============== */

export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type GameSubgame = typeof gameSubgames.$inferSelect;
export type NewGameSubgame = typeof gameSubgames.$inferInsert;
export type PlayerGrade = typeof playerGrades.$inferSelect;
export type NewPlayerGrade = typeof playerGrades.$inferInsert;
export type GameInvite = typeof gameInvites.$inferSelect;
export type NewGameInvite = typeof gameInvites.$inferInsert;
export type GameInviteBatch = typeof gameInviteBatches.$inferSelect;
export type NewGameInviteBatch = typeof gameInviteBatches.$inferInsert;
export type GameInviteEvent = typeof gameInviteEvents.$inferSelect;
export type NewGameInviteEvent = typeof gameInviteEvents.$inferInsert;
export type SuperAdmin = typeof superAdmins.$inferSelect;
export type NewSuperAdmin = typeof superAdmins.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
export type AnnouncementRecipient = typeof announcementRecipients.$inferSelect;
export type NewAnnouncementRecipient = typeof announcementRecipients.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type WhoopWorkout = typeof whoopWorkouts.$inferSelect;
export type NewWhoopWorkout = typeof whoopWorkouts.$inferInsert;
export type WhoopCycle = typeof whoopCycles.$inferSelect;
export type NewWhoopCycle = typeof whoopCycles.$inferInsert;
export type TrainingProfile = typeof trainingProfile.$inferSelect;
export type NewTrainingProfile = typeof trainingProfile.$inferInsert;
export type TrainingUserExercise = typeof trainingUserExercise.$inferSelect;
export type NewTrainingUserExercise = typeof trainingUserExercise.$inferInsert;
export type TrainingSet = typeof trainingSets.$inferSelect;
export type NewTrainingSet = typeof trainingSets.$inferInsert;
export type TrainingTrophy = typeof trainingTrophies.$inferSelect;
export type NewTrainingTrophy = typeof trainingTrophies.$inferInsert;
export type TrainingWeekResult = typeof trainingWeekResults.$inferSelect;
export type NewTrainingWeekResult = typeof trainingWeekResults.$inferInsert;

// Suppress an unused-symbol warning when this file is imported as types-only.
export const __schemaSqlMarker = sql`/* schema */`;
