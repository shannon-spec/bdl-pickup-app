# Database (Drizzle + Neon Postgres)

## Files

- `schema.ts` — table definitions, enums, relations, inferred TS types.
- `index.ts` — lazy `db` client (Neon HTTP driver, throws on first query if `DATABASE_URL` is missing).
- `../../drizzle/` — generated SQL migrations (committed).
- `../../drizzle.config.ts` — drizzle-kit config.

## One-time setup

1. **Provision Neon** in the Vercel dashboard for the `bdl-web` project: Storage → Create Database → Neon → attach to all environments. This auto-populates `DATABASE_URL` and a few helper vars in the project env.
2. **Pull env locally:** `npm run db:pull-env` (runs `vercel env pull .env.local`). You'll be prompted to link the project the first time.
3. **Apply schema to Neon:** `npm run db:migrate` (uses the committed migration files).

## Day-to-day workflow

| Action | Command |
|---|---|
| Edit `schema.ts`, then generate a migration | `npm run db:generate` |
| Apply pending migrations to Neon | `npm run db:migrate` |
| Push schema directly without a migration (dev only) | `npm run db:push` |
| Open Drizzle Studio (browser GUI) | `npm run db:studio` |
| Refresh local `.env.local` from Vercel | `npm run db:pull-env` |

Always commit the generated SQL in `drizzle/`.

## Tables

- `players` — roster (name, contact, level, status, height/weight, privacy flags).
- `leagues` — league metadata (format, schedule, location, days, max players).
- `league_players` — junction (player ↔ league + assigned team + per-league level).
- `league_commissioners` — junction (player ↔ league as commissioner).
- `games` — game records (date, time, format, scores, winner team, locked, series).
- `game_roster` — junction with `side` enum (`A` / `B` / `invited`).
- `super_admins` — admin login usernames + optional player link + role.
- `invites` — pending/accepted league invitations.

## Notes

- UUID PKs via `gen_random_uuid()`.
- All timestamps `timestamp with time zone`, default `now()`.
- `updated_at` auto-updates via Drizzle `$onUpdate(() => new Date())`.
- One player can be linked to multiple super admin usernames.
- Junction tables use composite primary keys.
- Enums live in Postgres (`player_status`, `game_format`, `win_team`, etc.).
