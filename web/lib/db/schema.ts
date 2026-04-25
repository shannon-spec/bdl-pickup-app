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
  boolean,
  timestamp,
  date,
  time,
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
]);

export const winTeamEnum = pgEnum("win_team", ["A", "B", "Tie"]);

export const adminRoleEnum = pgEnum("admin_role", ["owner", "super_admin"]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "expired",
]);

/* ============== PLAYERS ============== */

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    cell: text("cell"),
    address: text("address"),
    city: text("city"),
    state: varchar("state", { length: 2 }),
    zip: text("zip"),
    college: text("college"),
    sport: text("sport"),
    position: text("position"),
    birthday: date("birthday"),
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
    // Optional player-side credentials. Players without these can only
    // be reached via invite link or admin impersonation. Username stored
    // lowercased for case-insensitive lookup.
    username: text("username"),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("players_last_first_idx").on(t.lastName, t.firstName),
    index("players_email_idx").on(t.email),
    uniqueIndex("players_username_idx").on(t.username),
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
  teamAName: text("team_a_name").notNull().default("White"),
  teamBName: text("team_b_name").notNull().default("Dark"),
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

/* ============== GAMES ============== */

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id").references(() => leagues.id, { onDelete: "set null" }),
    leagueName: text("league_name"),
    gameDate: date("game_date"),
    gameTime: time("game_time"),
    venue: text("venue"),
    format: gameFormatEnum("format").notNull().default("5v5"),
    teamAName: text("team_a_name").notNull().default("White"),
    teamBName: text("team_b_name").notNull().default("Dark"),
    scoreA: integer("score_a"),
    scoreB: integer("score_b"),
    winTeam: winTeamEnum("win_team"),
    gameWinner: uuid("game_winner").references(() => players.id, { onDelete: "set null" }),
    locked: boolean("locked").notNull().default(false),
    autoScheduled: boolean("auto_scheduled").notNull().default(false),
    numInvites: integer("num_invites").notNull().default(10),
    seriesId: uuid("series_id"),
    seriesBestOf: integer("series_best_of"),
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

/* ============== JUNCTIONS: GAME ROSTER + INVITES ============== */

// Single roster table with a `side` column instead of 3 separate tables.
export const gameRosterSideEnum = pgEnum("game_roster_side", [
  "A",
  "B",
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
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type SuperAdmin = typeof superAdmins.$inferSelect;
export type NewSuperAdmin = typeof superAdmins.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;

// Suppress an unused-symbol warning when this file is imported as types-only.
export const __schemaSqlMarker = sql`/* schema */`;
