CREATE TYPE "public"."admin_role" AS ENUM('owner', 'super_admin');--> statement-breakpoint
CREATE TYPE "public"."game_format" AS ENUM('5v5', '5v5-series', '3v3', '3v3-series');--> statement-breakpoint
CREATE TYPE "public"."game_roster_side" AS ENUM('A', 'B', 'invited');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."player_level" AS ENUM('Not Rated', 'Novice', 'Intermediate', 'Advanced', 'Game Changer', 'Pro');--> statement-breakpoint
CREATE TYPE "public"."player_status" AS ENUM('Active', 'Inactive', 'IR');--> statement-breakpoint
CREATE TYPE "public"."win_team" AS ENUM('A', 'B', 'Tie');--> statement-breakpoint
CREATE TABLE "game_roster" (
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"side" "game_roster_side" NOT NULL,
	CONSTRAINT "game_roster_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid,
	"league_name" text,
	"game_date" date,
	"game_time" time,
	"venue" text,
	"format" "game_format" DEFAULT '5v5' NOT NULL,
	"team_a_name" text DEFAULT 'White' NOT NULL,
	"team_b_name" text DEFAULT 'Dark' NOT NULL,
	"score_a" integer,
	"score_b" integer,
	"win_team" "win_team",
	"game_winner" uuid,
	"locked" boolean DEFAULT false NOT NULL,
	"auto_scheduled" boolean DEFAULT false NOT NULL,
	"num_invites" integer DEFAULT 10 NOT NULL,
	"series_id" uuid,
	"series_best_of" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid,
	"league_name" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"cell" text,
	"invited_by" uuid,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"player_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_commissioners" (
	"league_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	CONSTRAINT "league_commissioners_league_id_player_id_pk" PRIMARY KEY("league_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "league_players" (
	"league_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"team_name" text,
	"league_level" "player_level",
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "league_players_league_id_player_id_pk" PRIMARY KEY("league_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"season" text,
	"description" text,
	"format" "game_format" DEFAULT '5v5' NOT NULL,
	"league_type" text,
	"schedule" text,
	"location" text,
	"start_date" date,
	"end_date" date,
	"start_time" time,
	"start_time_type" text,
	"days" integer[],
	"max_players" integer,
	"team_a_name" text DEFAULT 'White' NOT NULL,
	"team_b_name" text DEFAULT 'Dark' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"cell" text,
	"address" text,
	"city" text,
	"state" varchar(2),
	"zip" text,
	"college" text,
	"sport" text,
	"position" text,
	"birthday" date,
	"height_ft" integer,
	"height_in" integer,
	"height_no_shoes" boolean DEFAULT false NOT NULL,
	"weight" integer,
	"level" "player_level" DEFAULT 'Not Rated' NOT NULL,
	"highest_level" text,
	"status" "player_status" DEFAULT 'Active' NOT NULL,
	"status_date" date,
	"status_note" text,
	"status_indefinite" boolean DEFAULT false NOT NULL,
	"injury_location" text,
	"cell_private" boolean DEFAULT false NOT NULL,
	"email_private" boolean DEFAULT false NOT NULL,
	"address_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "super_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"first_name" text,
	"last_name" text,
	"role" "admin_role" DEFAULT 'super_admin' NOT NULL,
	"player_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "super_admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "game_roster" ADD CONSTRAINT "game_roster_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_roster" ADD CONSTRAINT "game_roster_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_game_winner_players_id_fk" FOREIGN KEY ("game_winner") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_players_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_commissioners" ADD CONSTRAINT "league_commissioners_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_commissioners" ADD CONSTRAINT "league_commissioners_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_players" ADD CONSTRAINT "league_players_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_players" ADD CONSTRAINT "league_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_roster_player_idx" ON "game_roster" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "game_roster_side_idx" ON "game_roster" USING btree ("game_id","side");--> statement-breakpoint
CREATE INDEX "games_league_date_idx" ON "games" USING btree ("league_id","game_date");--> statement-breakpoint
CREATE INDEX "games_date_idx" ON "games" USING btree ("game_date");--> statement-breakpoint
CREATE INDEX "games_series_idx" ON "games" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "invites_status_idx" ON "invites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invites_league_idx" ON "invites" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX "lp_player_idx" ON "league_players" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "players_last_first_idx" ON "players" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "players_email_idx" ON "players" USING btree ("email");