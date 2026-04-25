ALTER TABLE "players" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "password_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "players_username_idx" ON "players" USING btree ("username");