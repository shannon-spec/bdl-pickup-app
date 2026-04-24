# BDL Pickup App

Pickup basketball tracker for leagues, rosters, and games.

## Repo layout

Two apps live side by side during the migration:

- **`web/`** — the new Next.js 16 app (TypeScript · Tailwind v4 · shadcn/ui). Active development.
- **`index.html` / `bdl-pickup-app.html`** — the legacy single-file React/CDN app. Still deployed at the site root until the new app reaches feature parity, at which point it will be deleted.
- **`api/`** — Vercel Functions shared by both apps (e.g. `api/send-admin-credentials.js`).

## Local development

### New app (`web/`)
```bash
cd web
npm install
npm run dev
# → http://localhost:3000
```

Build + typecheck:
```bash
cd web
npm run build
```

### Legacy app (root)
Open `index.html` directly in a browser, or:
```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploy

Pushes to `main` auto-deploy via Vercel. Currently the Vercel project root is the repo root (serving the legacy static HTML). When the new Next.js app is ready to take over, change **Vercel → Settings → General → Root Directory** to `web/`.

## Super Admin credential emails
The `/api/send-admin-credentials` Vercel Function sends login credentials to new Super Admins via [Resend](https://resend.com).

Set these environment variables in your Vercel project (Settings → Environment Variables):

- `RESEND_API_KEY` — create at https://resend.com/api-keys
- `ADMIN_FROM_EMAIL` — verified sender, e.g. `BDL Pickup <admin@yourdomain.com>` (the domain must be verified in Resend)
- `ADMIN_ALLOWED_ORIGIN` *(optional)* — lock the endpoint to a single origin, e.g. `https://bdl.example.com`

To test locally with `vercel dev`, mirror the same keys into `.env.local`.

## Migration phases

1. **Scaffold** ✓ — `web/` with Next.js + Tailwind + shadcn + BDL design tokens + primitives + shell + mocked dashboard.
2. **Database** — Drizzle + Neon schema (players, leagues, games, super_admins, invites).
3. **Data + auth** — port shared-password admin model to server-verified sessions; import seed from the legacy app.
4. **Screen port** — Login, Player Dashboard, Admin Dashboard, Roster, Leagues, Games, Standings, Leaderboard, Game Detail, Admin Settings, Player Profile.
5. **Switchover** — change Vercel Root Directory to `web/`, delete the legacy HTML.
